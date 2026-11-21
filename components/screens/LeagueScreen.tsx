/**
 * @license
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
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import RosterSlotBadge from '@/components/common/RosterSlotBadge';
import UserAvatar from '@/components/common/UserAvatar';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import { useOneiromancy } from '@/context/OneiromancyContext';
import CelestialLeaderboardGraph from '@/components/oneiromancy/CelestialLeaderboardGraph';
import {
  buildUnitMap,
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  oracleScore,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';
import { isPlayerOnByeWeek, stripUserSuffix } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import type { CompetitorTeam, CosmicPlayer } from '@/types/oneiromancy';

const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

export const LeagueScreen: React.FC = () => {
  const { draftState, enabledSystems } = useOneiromancy();
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const byId = useMemo(() => new Map(board.map((p) => [String(p.id), p])), [board]);
  const unitByTeam = useMemo(
    () => buildUnitMap(board, draftState.my_roster ?? []),
    [board, draftState.my_roster],
  );
  const me = teams.find((t) => t.is_user);
  const activeWeek = resolveActiveWeek(draftState);
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(null);
  const team = teams.find((t) => t.roster_id === (selected ?? me?.roster_id)) ?? teams[0];
  const slots = (draftState.settings?.roster_positions || draftState.roster_positions || []).filter(
    (s: string) => s !== 'BN' && s !== 'IR',
  );

  const starters = (team?.starters ?? []).map((id) => byId.get(String(id)) ?? null);
  const starterIds = new Set((team?.starters ?? []).map(String));
  const bench = (team?.players ?? [])
    .filter((id) => !starterIds.has(String(id)))
    .map((id) => byId.get(String(id)))
    .filter((p): p is CosmicPlayer => Boolean(p))
    .sort(
      (a, b) =>
        oracleScore(b, undefined, { currentWeek: activeWeek, enabledSystems, unitByTeam }) -
        oracleScore(a, undefined, { currentWeek: activeWeek, enabledSystems, unitByTeam }),
    );

  const row = (p: CosmicPlayer | null, label: string, key: string) => {
    if (!p) {
      return (
        <li key={key} className="flex items-center gap-2 py-2 text-xs font-sans text-zinc-400 px-3">
          <RosterSlotBadge slotId={label} size="sm" /> Empty
        </li>
      );
    }
    const onBye = isPlayerOnByeWeek(activeWeek, p.bye_week, p.team, getSeasonContext()?.byeWeeks);
    const placeholder = oraclePlaceholderInfo(p, activeWeek);
    const forecast = playerForecast(p, {
      currentWeek: activeWeek,
      enabledSystems,
      unitByTeam,
      placeholder: false,
      nextGameLookahead: false,
    });
    const byeWkLabel = p.bye_week || activeWeek;
    return (
      <li
        key={key}
        onClick={() => setInspectedPlayer(p)}
        className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 py-2 px-3 text-xs cursor-pointer hover:bg-white/[0.03] transition-colors ${onBye ? 'opacity-50 grayscale' : ''}`}
      >
        <button
          type="button"
          aria-label={`Inspect ${p.name}`}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setInspectedPlayer(p);
          }}
          className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-amber-400/70"
        />
        <div className="relative z-[1] flex items-center gap-2.5 min-w-0 flex-1">
          <RosterSlotBadge slotId={label} size="sm" className="shrink-0" />
          <PlayerHeadshot player={p} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="font-sans text-zinc-100 min-w-0 break-words font-medium">{p.name}</span>
              {p.injury_status && p.injury_status !== 'Healthy' && (
                <span className="text-[10px] font-mono px-1 rounded border border-amber-500/30 text-amber-300 shrink-0">
                  {p.injury_status.toUpperCase()}
                </span>
              )}
              {onBye && (
                <span className="text-[10px] font-mono px-1 rounded border border-amber-500/30 text-amber-300 shrink-0">
                  BYE WK {byeWkLabel}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-zinc-400 break-words">
              {p.position} · <TeamLogo team={p.team} className="mr-1" />
              {p.team} · Bye {p.bye_week || '-'}
            </div>
          </div>
        </div>
        <div className="relative z-[1] flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <span
            title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Projected base points'}
            className="font-mono text-zinc-200 tabular-nums shrink-0 w-10 text-right inline-flex items-center justify-end"
          >
            {(onBye ? 0 : forecast.basePts).toFixed(1)}
            {placeholder.hasPlaceholder && (
              <span className="relative z-10 inline-flex">
                <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
              </span>
            )}
          </span>
          <span
            title="Points added or subtracted by active predictors"
            className={`font-mono font-semibold tabular-nums shrink-0 w-12 text-right inline-flex items-center justify-end ${modifierTextColor(forecast.overallModifierPts)}`}
          >
            {formatSignedModifier(onBye ? 0 : forecast.overallModifierPts)}
          </span>
          <span
            data-testid="league-roster-projected-cell"
            title="Final projection (Base + Modifier)"
            className="font-mono font-semibold text-amber-200 tabular-nums shrink-0 w-12 text-right inline-flex items-center justify-end"
          >
            {(onBye ? 0 : forecast.adjustedPts).toFixed(1)}
            {placeholder.hasPlaceholder && (
              <span className="relative z-10 inline-flex">
                <OraclePlaceholderMarker placeholder={placeholder} />
              </span>
            )}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.08] pb-4">
        <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">League</h2>
        <span className="text-xs font-mono tabular-nums text-zinc-400">
          {teams.length} teams · Week {activeWeek}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5 items-start">
        <CelestialLeaderboardGraph
          competitorTeams={teams}
          cosmicBoard={board}
          selectedRosterId={team?.roster_id}
          onSelectTeam={(rid) => setSelected(rid)}
        />

        <section aria-labelledby="league-rosters-heading" className="rounded-xl border border-white/[0.08] bg-[#16181d] overflow-hidden">
          <div className="px-4 py-3 bg-[#121418] border-b border-white/[0.08] flex items-center justify-between gap-2">
            <h3 id="league-rosters-heading" className="font-sans text-sm font-semibold text-zinc-100">
              Roster Inspection
            </h3>
            <select
              value={team?.roster_id ?? ''}
              onChange={(e) => setSelected(Number(e.target.value))}
              aria-label="Choose a team"
              className="px-2.5 py-1 rounded-md bg-zinc-900 border border-white/10 text-xs text-zinc-100 font-sans focus:outline-none focus:border-amber-400/60 cursor-pointer"
            >
              {teams.map((t) => (
                <option key={t.roster_id} value={t.roster_id}>
                  {stripUserSuffix(t.name, 'Team')}
                  {typeof t.wins === 'number' ? ` (${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''})` : ''}
                </option>
              ))}
            </select>
          </div>

          {team && (() => {
            const cleanTeamName = stripUserSuffix(team.name, 'Team');
            return (
              <div
                data-testid={team.is_user ? 'user-competitor-card' : 'competitor-card'}
                className="flex flex-col"
              >
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
                  <UserAvatar src={team.avatar_url || team.avatar} alt={`${cleanTeamName} avatar`} fallbackText={cleanTeamName} size="md" isUser={team.is_user} />
                  <div className="min-w-0">
                    <div className="font-sans font-semibold text-sm text-zinc-100 break-words">{cleanTeamName}</div>
                    <div className="text-xs font-sans text-zinc-400">
                      {team.owner_name ? `${team.owner_name}` : 'Manager'}
                      {typeof team.points_for === 'number' ? <span className="font-mono tabular-nums">{` · ${team.points_for.toFixed(1)} PF`}</span> : ''}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="px-3 py-1.5 bg-[#121418]/60 border-b border-white/[0.05] flex items-center gap-2.5 text-[11px] font-sans font-medium text-zinc-400">
                    <span>Starters</span>
                    <span className="ml-auto w-10 text-right text-zinc-300">Base</span>
                    <span className="w-12 text-right text-zinc-300">Modifier</span>
                    <span className="w-12 text-right text-amber-200/90">Projected</span>
                  </div>
                  <ul className="divide-y divide-white/[0.05]">
                    {starters.length > 0
                      ? starters.map((p, i) => row(p, slots[i] ?? '', `s-${i}`))
                      : (team.picks || []).slice(0, 8).map((pk, i) =>
                          row(byId.get(String(pk.player_id)) ?? null, `Rd ${pk.round}`, `p-${i}`),
                        )}
                  </ul>
                </div>
                {bench.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-[#121418]/60 border-y border-white/[0.05] flex items-center gap-2.5 text-[11px] font-sans font-medium text-zinc-400">
                      <span>Bench</span>
                      <span className="ml-auto w-10 text-right text-zinc-300">Base</span>
                      <span className="w-12 text-right text-zinc-300">Modifier</span>
                      <span className="w-12 text-right text-amber-200/90">Projected</span>
                    </div>
                    <ul className="divide-y divide-white/[0.05]">{bench.map((p, i) => row(p, 'BN', `b-${i}`))}</ul>
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      </div>

      <PlayerDetailModal
        player={inspectedPlayer}
        isOpen={Boolean(inspectedPlayer)}
        roster={draftState.my_roster}
        activeWeek={activeWeek}
        onClose={() => setInspectedPlayer(null)}
      />
    </div>
  );
};

export default LeagueScreen;
