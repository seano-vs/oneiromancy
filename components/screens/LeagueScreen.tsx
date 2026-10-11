/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import React, { useMemo, useState } from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import UserAvatar from '@/components/common/UserAvatar';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  TONE_LABEL,
  TONE_PILL,
  computeTeamOracles,
  favorabilityTone,
  oracleScore,
  starsScore,
  statsPoints,
  type TeamOracle,
} from '@/lib/oracle';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import type { CompetitorTeam, CosmicPlayer, RosterSlot } from '@/types/oneiromancy';

// Stable empty defaults so memo dependencies don't change every render.
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

const SLOT_LABEL: Record<string, string> = { SUPER_FLEX: 'SF', FLEX: 'FLEX', REC_FLEX: 'FLEX', WRRB_FLEX: 'FLEX' };

type RankBy = 'oracle' | 'stars' | 'points';
const RANK_LABEL: Record<RankBy, string> = { oracle: 'Oracle', stars: 'Stars', points: 'Projected pts' };

/**
 * League: every team's current lineup rated by the user's own metrics (λ and
 * star weights). Sleeper already shows standings; this shows what it can't.
 */
const OracleRow: React.FC<{
  r: TeamOracle;
  rank: number;
  mine?: TeamOracle;
  lambda: number;
  selected: boolean;
  onSelect: () => void;
}> = ({ r, rank, mine, lambda, selected, onSelect }) => {
  const name = r.team.name.replace(/\s*\(You\)$/, '');
  const isMe = Boolean(r.team.is_user);
  const delta = mine && !isMe ? r.oracle - mine.oracle : null;
  const tone = favorabilityTone(r.stars);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full text-left p-3 rounded-xl border flex flex-col gap-1.5 transition-colors ${
          isMe
            ? 'bg-purple-950/40 border-purple-400/60'
            : selected
              ? 'bg-slate-900/90 border-cyan-400/50'
              : 'bg-slate-900/70 border-white/10 hover:border-white/25'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-6 shrink-0 text-xs font-mono text-slate-500">#{rank}</span>
          <UserAvatar src={r.team.avatar_url || r.team.avatar} alt={`${name} avatar`} fallbackText={name} size="sm" />
          <span className="min-w-0 truncate font-semibold text-slate-100">{name}</span>
          {isMe && (
            <span className="shrink-0 text-[9px] font-mono uppercase px-1 rounded bg-purple-500/20 text-purple-200 border border-purple-400/40">
              You
            </span>
          )}
          <span className="ml-auto shrink-0 text-right">
            <span className="block font-mono text-lg font-bold text-purple-100 tabular-nums leading-none">
              {r.oracle.toFixed(1)}
            </span>
            <span className="block text-[9px] font-mono uppercase text-slate-500">Oracle</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 text-[11px] font-mono text-slate-400">
          <span title={TONE_LABEL[tone]} className={`px-1 rounded border ${TONE_PILL[tone]}`}>
            Stars {r.stars.toFixed(1)}
          </span>
          <span>{r.points.toFixed(1)} proj pts</span>
          {delta !== null && (
            <span className={delta > 0 ? 'text-rose-300' : delta < 0 ? 'text-emerald-300' : 'text-slate-400'}>
              {delta > 0 ? `+${delta.toFixed(1)} over you` : delta < 0 ? `${delta.toFixed(1)} under you` : 'even with you'}
            </span>
          )}
          {typeof r.team.wins === 'number' && (
            <span className="text-slate-600">
              {r.team.wins}-{r.team.losses}
              {r.team.ties ? `-${r.team.ties}` : ''}
            </span>
          )}
        </div>
        {r.best && r.worst && (
          <div className="pl-8 text-[11px] text-slate-500">
            Strongest {r.best.name} ({oracleScore(r.best, lambda).toFixed(1)}) · weakest {r.worst.name} (
            {oracleScore(r.worst, lambda).toFixed(1)})
          </div>
        )}
      </button>
    </li>
  );
};

export const LeagueScreen: React.FC = () => {
  const { draftState } = useOneiromancy();
  const [rankBy, setRankBy] = useState<RankBy>('oracle');
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const byId = useMemo(() => new Map(board.map((p) => [String(p.id), p])), [board]);
  const me = teams.find((t) => t.is_user);
  const ratings = useMemo(() => computeTeamOracles(teams, board, lambda), [teams, board, lambda]);
  const ranked = useMemo(
    () => [...ratings].sort((a, b) => b[rankBy] - a[rankBy]),
    [ratings, rankBy],
  );
  const mine = ratings.find((r) => r.team.is_user);
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const team = teams.find((t) => t.roster_id === (selected ?? me?.roster_id)) ?? teams[0];
  const slots = (draftState.settings?.roster_positions || (draftState as any).roster_positions || []).filter(
    (s: string) => s !== 'BN' && s !== 'IR',
  );

  const starters = (team?.starters ?? []).map((id) => byId.get(String(id)) ?? null);
  const starterIds = new Set((team?.starters ?? []).map(String));
  const bench = (team?.players ?? [])
    .filter((id) => !starterIds.has(String(id)))
    .map((id) => byId.get(String(id)))
    .filter((p): p is CosmicPlayer => Boolean(p))
    .sort((a, b) => oracleScore(b, lambda) - oracleScore(a, lambda));

  const row = (p: CosmicPlayer | null, label: string, key: string) => {
    if (!p) {
      return (
        <li key={key} className="flex items-center gap-2 py-1.5 text-xs text-slate-500">
          <span className="w-8 sm:w-10 shrink-0 font-mono">{label}</span> Empty
        </li>
      );
    }
    const stars = starsScore(p);
    const tone = favorabilityTone(stars);
    return (
      <li key={key} className="flex items-center gap-2 py-1.5 text-xs">
        <span className="w-8 sm:w-10 shrink-0 font-mono text-slate-500">{label}</span>
        <PositionalBadge position={p.position} size="sm" />
        <span className="text-slate-100 min-w-0 truncate">{p.name}</span>
        <span className="hidden sm:inline font-mono text-slate-500 shrink-0">
          {p.team} · Bye {p.bye_week || '—'}
        </span>
        {p.injury_status && (
          <span className="text-[9px] font-mono px-1 rounded border border-amber-500/40 text-amber-300 shrink-0">
            {p.injury_status.toUpperCase()}
          </span>
        )}
        <span
          title={`Oracle at λ ${lambda.toFixed(2)}`}
          className="ml-auto font-mono font-semibold text-purple-200 tabular-nums shrink-0 w-10 text-right"
        >
          {oracleScore(p, lambda).toFixed(1)}
        </span>
        <span className="font-mono text-slate-400 tabular-nums shrink-0 w-9 sm:w-10 text-right">{statsPoints(p).toFixed(1)}</span>
        <span
          title={TONE_LABEL[tone]}
          className={`font-mono text-[11px] px-1 rounded border shrink-0 w-9 text-center ${TONE_PILL[tone]}`}
        >
          {stars.toFixed(0)}
        </span>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto">
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">
          Celestial Leaderboard
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">League</h2>
        <p className="text-xs text-slate-400 font-sans">
          Every team&apos;s current starting lineup, rated by your Oracle: stats and Stars blended at λ{' '}
          {lambda.toFixed(2)} with your star weights.{' '}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('oneiromancy:open-oracle'))}
            className="text-purple-300 underline hover:text-purple-200"
          >
            Adjust the Oracle
          </button>
        </p>
      </div>

      <section aria-labelledby="league-oracle-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="league-oracle-heading" className="font-serif text-xl font-bold text-slate-100">
            Oracle rankings
          </h3>
          <div role="group" aria-label="Rank teams by" className="flex gap-1">
            {(Object.keys(RANK_LABEL) as RankBy[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={rankBy === k}
                onClick={() => setRankBy(k)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border ${
                  rankBy === k
                    ? 'border-purple-400 bg-purple-950/60 text-purple-100'
                    : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {RANK_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        {ranked.length === 0 ? (
          <p className="p-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-slate-300">
            No lineups to rate yet. Lineups appear once rosters have starters.
          </p>
        ) : (
          <ol className="flex flex-col gap-2" data-testid="league-oracle-rankings">
            {ranked.map((r, i) => (
              <OracleRow
                key={r.team.roster_id}
                r={r}
                rank={i + 1}
                mine={mine}
                lambda={lambda}
                selected={r.team.roster_id === team?.roster_id}
                onSelect={() => {
                  setSelected(r.team.roster_id);
                  document.getElementById('league-rosters-heading')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="league-rosters-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="league-rosters-heading" className="font-serif text-xl font-bold text-slate-100">
            Lineup breakdown
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Competitor Rosters · by Oracle
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs font-mono text-slate-400">
          Team
          <select
            value={team?.roster_id ?? ''}
            onChange={(e) => setSelected(Number(e.target.value))}
            aria-label="Choose a team"
            className="flex-1 sm:flex-none p-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100"
          >
            {teams.map((t) => (
              <option key={t.roster_id} value={t.roster_id}>
                {t.name}
                {typeof t.wins === 'number' ? ` (${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''})` : ''}
              </option>
            ))}
          </select>
        </label>

        {team && (
          <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar src={team.avatar_url || team.avatar} alt={`${team.name} avatar`} fallbackText={team.name} size="md" />
              <div className="min-w-0">
                <div className="font-semibold text-slate-100 truncate">{team.name}</div>
                <div className="text-[11px] font-mono text-slate-400">
                  {team.owner_name ? `${team.owner_name} · ` : ''}
                  {typeof team.points_for === 'number' ? `${team.points_for.toFixed(1)} PF` : ''}
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest mb-1">
                <span className="text-cyan-300">Starters</span>
                <span className="ml-auto w-10 text-right text-purple-200">Oracle</span>
                <span className="w-9 sm:w-10 text-right text-slate-500">Pts</span>
                <span className="w-9 text-center text-slate-500">Stars</span>
              </div>
              <ul className="divide-y divide-white/5">
                {starters.length > 0
                  ? starters.map((p, i) => row(p, SLOT_LABEL[slots[i]] ?? slots[i] ?? '', `s-${i}`))
                  : (team.picks || []).slice(0, 8).map((pk, i) =>
                      row(byId.get(String(pk.player_id)) ?? null, `Rd ${pk.round}`, `p-${i}`),
                    )}
              </ul>
            </div>
            {bench.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-purple-300 mb-1">
                  Bench · by Oracle
                </div>
                <ul className="divide-y divide-white/5">{bench.map((p, i) => row(p, 'BN', `b-${i}`))}</ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default LeagueScreen;
