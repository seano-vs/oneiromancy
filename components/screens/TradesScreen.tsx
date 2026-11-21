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
import UserAvatar from '@/components/common/UserAvatar';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import PositionalBadge from '@/components/common/PositionalBadge';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import GlassCard from '@/components/common/GlassCard';
import { DeltaBadge, HealthTag, StatTiles, Tag } from '@/components/common/PlayerTiles';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { stripUserSuffix } from '@/lib/scoring';
import {
  ALL_PREDICTOR_SYSTEM_IDS,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  TONE_PILL,
  basePoints,
  buildUnitMap,
  computeTradePartners,
  dominantElements,
  elementRelation,
  favorabilityTone,
  formatSignedModifier,
  oraclePlaceholderInfo,
  oracleScore,
  playerModifier,
  resolveActiveWeek,
} from '@/lib/oracle';
import { DEFAULT_CHAOS_LAMBDA, isPlayerSigned } from '@/lib/scoring';
import type { CompetitorTeam, CosmicPlayer, ElementType, RosterSlot } from '@/types/oneiromancy';

const ValueLine: React.FC<{
  p: CosmicPlayer;
  activeWeek?: number;
  enabledSystems?: readonly string[];
  unitByTeam?: ReadonlyMap<string, CosmicPlayer[]>;
}> = ({ p, activeWeek, enabledSystems, unitByTeam }) => {
  const base = basePoints(p, { currentWeek: activeWeek, placeholder: true, nextGameLookahead: true });
  const mod = playerModifier(p, {
    currentWeek: activeWeek,
    enabledSystems,
    unitByTeam,
    placeholder: true,
    nextGameLookahead: true,
  });
  const net = Math.max(0, base + mod);
  const placeholder = oraclePlaceholderInfo(p, activeWeek);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-mono tabular-nums text-[11px] text-zinc-400">
      <span
        className="text-zinc-200 font-medium inline-flex items-center"
        title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
      >
        Base {base.toFixed(1)}
        {placeholder.hasPlaceholder && (
          <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
        )}
      </span>
      <span className={`px-1 rounded border inline-flex items-center ${TONE_PILL[favorabilityTone(mod)]}`}>
        {formatSignedModifier(mod)} mod
      </span>
      <span className="text-amber-200 font-semibold inline-flex items-center">
        Proj {net.toFixed(1)}
        {placeholder.hasPlaceholder && (
          <OraclePlaceholderMarker placeholder={placeholder} />
        )}
      </span>
    </span>
  );
};

const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

export interface TradesScreenProps {
  positionFilter?: string;
  searchQuery?: string;
}

export const TradesScreen: React.FC<TradesScreenProps> = ({
  positionFilter = 'ALL',
  searchQuery = '',
}) => {
  const { draftState, enabledSystems } = useOneiromancy();
  const activeSystems = enabledSystems ?? DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const lambda = draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const activeWeek = resolveActiveWeek(draftState);
  const [openTeam, setOpenTeam] = useState<number | null>(null);
  const [inspected, setInspected] = useState<InspectTarget | null>(null);

  const unitByTeam = useMemo(() => buildUnitMap(board, roster), [board, roster]);

  const partners = useMemo(() => {
    return computeTradePartners(teams, board, roster, lambda, {
      currentWeek: activeWeek,
      enabledSystems: activeSystems,
      unitByTeam,
    }).filter((p) => {
      const givesSigned = p.give?.player ? isPlayerSigned(p.give.player) : false;
      const receivesUnsigned = p.get?.player ? !isPlayerSigned(p.get.player) : false;
      if (givesSigned && receivesUnsigned) return false;
      if (positionFilter && positionFilter !== 'ALL') {
        const givePos = p.give?.player?.position;
        const getPos = p.get?.player?.position;
        const matchPos = (pos?: string) =>
          positionFilter === 'FLEX'
            ? Boolean(pos && ['RB', 'WR', 'TE'].includes(pos))
            : pos === positionFilter;
        if (!matchPos(givePos) && !matchPos(getPos)) return false;
      }
      const q = (searchQuery || '').trim().toLowerCase();
      if (q) {
        const teamName = (p.team.name || '').toLowerCase();
        const giveName = (p.give?.player?.name || '').toLowerCase();
        const getName = (p.get?.player?.name || '').toLowerCase();
        if (!teamName.includes(q) && !giveName.includes(q) && !getName.includes(q)) return false;
      }
      return true;
    });
  }, [teams, board, roster, lambda, positionFilter, searchQuery, activeWeek, activeSystems, unitByTeam]);
  const byId = useMemo(() => new Map(board.map((p) => [String(p.id), p])), [board]);
  const me = teams.find((t) => t.is_user);
  const myStarters = (me?.starters ?? []).map((id) => byId.get(String(id))).filter((p): p is CosmicPlayer => Boolean(p));
  const myMix = dominantElements(myStarters);

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-sans text-lg sm:text-xl font-semibold text-zinc-100">Trades</h2>
        <span className="text-xs font-mono tabular-nums text-zinc-400">
          {activeSystems.length} of {ALL_PREDICTOR_SYSTEM_IDS.length} predictors
        </span>
      </div>

      {partners.length === 0 ? (
        <p className="p-5 rounded-xl bg-[#16181d] border border-white/[0.08] text-sm text-zinc-300">
          No mutual starting-lineup trade fits found this week.
        </p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="trade-partners">
          {partners.map((p) => {
            const name = stripUserSuffix(p.team.name, 'Team');
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
              .sort(
                (a, b) =>
                  a.position.localeCompare(b.position) ||
                  oracleScore(b, lambda, {
                    currentWeek: activeWeek,
                    enabledSystems: activeSystems,
                    unitByTeam,
                  }) -
                    oracleScore(a, lambda, {
                      currentWeek: activeWeek,
                      enabledSystems: activeSystems,
                      unitByTeam,
                    }),
              );
            const netGain = (p.give?.gain ?? 0) + (p.get?.gain ?? 0);
            const side = (
              kind: 'send' | 'receive',
              piece: NonNullable<typeof p.give>,
            ) => (
              <div
                className={`space-y-2 ${
                  kind === 'send'
                    ? 'pt-1 sm:pt-0 sm:pr-4'
                    : 'pt-3 sm:pt-0 sm:pl-4'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-sans font-medium ${kind === 'send' ? 'text-zinc-400' : 'text-amber-300'}`}>
                    {kind === 'send' ? 'You send' : 'You receive'}
                  </span>
                  <HealthTag player={piece.player} activeWeek={activeWeek} />
                </div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerHeadshot player={piece.player} size="trade" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PositionalBadge position={piece.player.position} size="sm" depth={piece.player.depth_chart_order} />
                      <span className="font-sans font-medium text-zinc-100 text-sm break-words">
                        <PlayerLink player={piece.player} vs={piece.replaces} onOpen={setInspected} />
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-zinc-400 flex flex-wrap items-center gap-1 min-w-0">
                      <TeamLogo team={piece.player.team} />
                      <span>{piece.player.team} · Bye {piece.player.bye_week || '-'}</span>
                    </div>
                  </div>
                </div>
                <StatTiles player={piece.player} lambda={lambda} />
                <div className="text-xs font-sans text-zinc-400">
                  Starts over {kind === 'receive' ? 'your ' : ''}
                  <PlayerLink player={piece.replaces} vs={piece.player} onOpen={setInspected} className="text-zinc-200 font-medium" />{' '}
                  <span className="text-emerald-300 font-mono tabular-nums font-semibold">(+{piece.gain.toFixed(1)} pts)</span>
                </div>
              </div>
            );
            return (
              <li key={p.team.roster_id}>
                <GlassCard variant="panel" className="p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        src={p.team.avatar_url || p.team.avatar}
                        alt={`${name} avatar`}
                        fallbackText={name}
                        size="sm"
                      />
                      <span className="font-sans font-semibold text-zinc-100 text-sm">{name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag tone="slate">{p.give && p.get ? 'Mutual starter fit' : `Needs ${p.youCanOffer.join(' & ')}`}</Tag>
                      {netGain > 0 && <DeltaBadge value={netGain} unit="PTS" tone="emerald" />}
                    </div>
                  </div>

                  {(p.give || p.get) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                      {p.give && side('send', p.give)}
                      {p.get && side('receive', p.get)}
                    </div>
                  )}

                  {!(p.give && p.get) && <p className="text-sm text-zinc-300">{p.summary}</p>}

                  <div className="flex flex-wrap justify-between items-center gap-2 font-sans text-xs pt-2 border-t border-white/[0.06]">
                    <span className="text-zinc-400">
                      Dominant element: <span className="text-zinc-200 font-medium">{theirMix}</span> ({relation})
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenTeam(isOpen ? null : p.team.roster_id)}
                      aria-expanded={isOpen}
                      className="px-2.5 py-1 rounded-md bg-zinc-900 border border-white/10 text-xs font-medium text-zinc-200 hover:border-white/25"
                    >
                      {isOpen ? 'Hide roster' : 'See roster'}
                    </button>
                  </div>

                  {isOpen && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-white/[0.06]">
                      {rosterPlayers.map((pl) => (
                        <li key={pl.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <PositionalBadge position={pl.position} size="sm" depth={pl.depth_chart_order} />
                          <PlayerLink player={pl} onOpen={setInspected} className="text-zinc-200 break-words min-w-0" />
                          <span className="ml-auto">
                            <ValueLine
                              p={pl}
                              activeWeek={activeWeek}
                              enabledSystems={activeSystems}
                              unitByTeam={unitByTeam}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </GlassCard>
              </li>
            );
          })}
        </ol>
      )}

      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={roster}
        activeWeek={activeWeek}
      />
    </div>
  );
};

export default TradesScreen;
