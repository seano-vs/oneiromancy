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
import { ExternalLink } from 'lucide-react';
import UserAvatar from '@/components/common/UserAvatar';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerMarketplace from '@/components/screens/PlayerMarketplace';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  computeTradePartners,
  dominantElements,
  elementRelation,
  sleeperLeagueUrl,
  statsPoints,
} from '@/lib/oracle';
import type { CompetitorTeam, CosmicPlayer, ElementType, RosterSlot } from '@/types/oneiromancy';

// Stable empty defaults so memo dependencies don't change every render.
const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

/**
 * Trades: who is short where you are deep. Partners are ranked by positional
 * need against your surplus; the celestial angle is each lineup's element mix.
 */
export const TradesScreen: React.FC = () => {
  const { draftState } = useOneiromancy();
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const [openTeam, setOpenTeam] = useState<number | null>(null);

  const partners = useMemo(() => computeTradePartners(teams, board, roster), [teams, board, roster]);
  const byId = useMemo(() => new Map(board.map((p) => [String(p.id), p])), [board]);
  const me = teams.find((t) => t.is_user);
  const myStarters = (me?.starters ?? []).map((id) => byId.get(String(id))).filter((p): p is CosmicPlayer => Boolean(p));
  const myMix = dominantElements(myStarters);
  const leagueUrl = sleeperLeagueUrl(draftState.isLive ? draftState.settings?.league_id : null);

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto">
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300/80">Divine Swaps</span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-100 tracking-wide">Trades</h2>
        <p className="text-xs text-slate-400 font-sans">
          Teams where a trade helps both lineups: one of your bench players would start for them, and one of
          theirs would start for you. Your starting lineup leans {myMix}.
        </p>
      </div>

      {partners.length === 0 ? (
        <p className="p-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-slate-300">
          No trade improves both lineups this week. Check back after waivers clear.
        </p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="trade-partners">
          {partners.map((p) => {
            const name = p.team.name.replace(/\s*\(You\)$/, '');
            const starters = (p.team.starters ?? [])
              .map((id) => byId.get(String(id)))
              .filter((x): x is CosmicPlayer => Boolean(x));
            const theirMix = dominantElements(starters);
            const relation = elementRelation(
              myMix.split(' & ')[0] as ElementType,
              theirMix.split(' & ')[0] as ElementType,
            );
            const isOpen = openTeam === p.team.roster_id;
            const rosterPlayers = (p.team.players ?? [])
              .map((id) => byId.get(String(id)))
              .filter((x): x is CosmicPlayer => Boolean(x))
              .sort((a, b) => a.position.localeCompare(b.position) || statsPoints(b) - statsPoints(a));
            return (
              <li key={p.team.roster_id} className="p-4 rounded-xl bg-slate-900/70 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    src={p.team.avatar_url || p.team.avatar}
                    alt={`${name} avatar`}
                    fallbackText={name}
                    size="sm"
                  />
                  <span className="text-base font-semibold text-slate-100">{name}</span>
                  {typeof p.team.wins === 'number' && (
                    <span className="text-xs font-mono text-slate-400">
                      {p.team.wins}-{p.team.losses}
                      {p.team.ties ? `-${p.team.ties}` : ''}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300">
                  {p.give && p.get ? 'Mutual lineup fit' : `Short at ${p.youCanOffer.join(' and ')}`}
                </span>
                {(p.give || p.get) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {p.give && (
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">You give</span>
                        <div className="text-slate-100 font-semibold">
                          {p.give.player.name}{' '}
                          <span className="font-mono font-normal text-slate-400">
                            {p.give.player.position} · {statsPoints(p.give.player).toFixed(1)} pts
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Would start over {p.give.replaces.name} (+{p.give.gain.toFixed(1)})
                        </div>
                      </div>
                    )}
                    {p.get && (
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">You get</span>
                        <div className="text-slate-100 font-semibold">
                          {p.get.player.name}{' '}
                          <span className="font-mono font-normal text-slate-400">
                            {p.get.player.position} · {statsPoints(p.get.player).toFixed(1)} pts
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Would start over your {p.get.replaces.name} (+{p.get.gain.toFixed(1)})
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <span className="text-sm text-slate-300">{p.summary}</span>
                <span className="text-xs font-mono text-slate-400">
                  Their lineup leans {theirMix} · {relation.toLowerCase()} with yours
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenTeam(isOpen ? null : p.team.roster_id)}
                    aria-expanded={isOpen}
                    className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-200 hover:border-cyan-400/60"
                  >
                    {isOpen ? 'Hide their roster' : 'See their roster'}
                  </button>
                  <a
                    href={leagueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300"
                  >
                    Propose in Sleeper <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {isOpen && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                    {rosterPlayers.map((pl) => (
                      <li key={pl.id} className="flex items-center gap-2 text-xs">
                        <PositionalBadge position={pl.position} size="sm" />
                        <span className="text-slate-200 truncate">{pl.name}</span>
                        <span className="ml-auto font-mono text-slate-400 tabular-nums">
                          {statsPoints(pl).toFixed(1)} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!draftState.isLive && (
        <section className="flex flex-col gap-2">
          <h3 className="font-serif text-lg font-bold text-slate-100">Sample Divine Swaps</h3>
          <PlayerMarketplace section="trades" />
        </section>
      )}
    </div>
  );
};

export default TradesScreen;
