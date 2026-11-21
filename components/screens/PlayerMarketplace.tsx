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

import GlassCard from '@/components/common/GlassCard';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import { DeltaBadge, HealthTag, StatTiles, Tag } from '@/components/common/PlayerTiles';
import { useOneiromancy } from '@/context/OneiromancyContext';
import {
  mockCosmicBoard,
  mockMyRoster,
} from '@/lib/mockData';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';
import { deriveEligiblePositions } from '@/lib/sleeper';
import {
  ALL_PREDICTOR_SYSTEM_IDS,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  buildUnitMap,
  computeWaiverMoves,
  elementRelation,
  resolveActiveWeek,
} from '@/lib/oracle';
import {
  CosmicPlayer,
  NFLPosition,
  RosterSlot,
} from '@/types/oneiromancy';
import React, { useCallback, useMemo, useState } from 'react';

export type MarketplaceSubTab = 'waivers' | 'trades' | 'all';

export interface PlayerMarketplaceProps {
  myRoster?: RosterSlot[];
  rosterPositions?: string[];
  className?: string;
  section?: 'waivers' | 'trades' | 'both';
  positionFilter?: string;
  searchQuery?: string;
}

export const PlayerMarketplace: React.FC<PlayerMarketplaceProps> = ({
  myRoster: propMyRoster,
  rosterPositions: propRosterPositions,
  className = '',
  section = 'waivers',
  positionFilter = 'ALL',
  searchQuery = '',
}) => {
  const context = useOneiromancy();
  const activeWeek = resolveActiveWeek(context.draftState);
  const isLiveMode = Boolean(
    context.draftState?.isLive || context.draftState?.mode === 'live',
  );

  const allPlayers = useMemo(
    () => context.draftState?.cosmic_board || (isLiveMode ? [] : mockCosmicBoard),
    [context.draftState?.cosmic_board, isLiveMode],
  );

  const allRoster = useMemo(
    () =>
      propMyRoster ||
      context.draftState?.my_roster ||
      (isLiveMode ? [] : mockMyRoster),
    [propMyRoster, context.draftState?.my_roster, isLiveMode],
  );

  const rawRosterPositions = useMemo(
    () =>
      propRosterPositions ||
      context.draftState?.roster_positions ||
      context.draftState?.settings?.roster_positions ||
      null,
    [
      propRosterPositions,
      context.draftState?.roster_positions,
      context.draftState?.settings?.roster_positions,
    ],
  );

  const leagueEligiblePositions = useMemo(
    () => deriveEligiblePositions(rawRosterPositions, allRoster),
    [rawRosterPositions, allRoster],
  );

  const oracleLambda = context.draftState?.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA;
  const activeSystems = context.enabledSystems ?? DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
  const unitByTeam = useMemo(
    () => buildUnitMap(allPlayers, allRoster),
    [allPlayers, allRoster],
  );
  const waiverMoves = useMemo(
    () =>
      computeWaiverMoves(allPlayers, allRoster, oracleLambda, activeWeek, 40, {
        currentWeek: activeWeek,
        enabledSystems: activeSystems,
        unitByTeam,
      }),
    [allPlayers, allRoster, oracleLambda, activeWeek, activeSystems, unitByTeam],
  );

  const visibleMoves = useMemo(
    () =>
      waiverMoves
        .filter((m) => leagueEligiblePositions.includes(m.add.position as NFLPosition))
        .filter((m) => {
          if (positionFilter && positionFilter !== 'ALL') {
            if (positionFilter === 'FLEX') {
              if (!['RB', 'WR', 'TE'].includes(m.add.position)) return false;
            } else if (m.add.position !== positionFilter) {
              return false;
            }
          }
          const q = (searchQuery || '').trim().toLowerCase();
          if (q) {
            const addName = (m.add.name || '').toLowerCase();
            const dropName = (m.drop.name || '').toLowerCase();
            const addTeam = (m.add.team || '').toLowerCase();
            if (!addName.includes(q) && !dropName.includes(q) && !addTeam.includes(q)) return false;
          }
          return true;
        })
        .slice(0, 6),
    [waiverMoves, leagueEligiblePositions, positionFilter, searchQuery],
  );

  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(null);
  const [inspectedVs, setInspectedVs] = useState<CosmicPlayer | null>(null);
  const openTarget = useCallback((t: InspectTarget) => {
    setInspectedVs(t.vs);
    setInspectedPlayer(t.player);
  }, []);

  return (
    <div className={`flex flex-col gap-4 w-full max-w-5xl mx-auto ${className}`}>
      <div className="flex justify-between items-baseline">
        {section !== 'trades' && (
          <h3 className="font-sans text-lg font-semibold text-zinc-100">
            Waiver Upgrades
          </h3>
        )}
        <span className="text-xs font-mono tabular-nums text-zinc-400">
          {activeSystems.length} of {ALL_PREDICTOR_SYSTEM_IDS.length} predictors
        </span>
      </div>

      <div className="space-y-3">
        {visibleMoves.length === 0 ? (
          <GlassCard variant="panel" className="p-6 text-center">
            <p className="text-sm font-sans text-zinc-300">No waiver move beats your current bench.</p>
          </GlassCard>
        ) : (
          <ol className="flex flex-col gap-3">
            {visibleMoves.map((move, idx) => (
              <li key={`${move.add.id}-${move.drop.id}`}>
                <GlassCard variant="panel" className="p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/[0.06] pb-2.5">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono tabular-nums text-xs text-zinc-400">
                        #{idx + 1}
                      </span>
                      <Tag tone={move.wouldStart ? 'amber' : 'slate'}>
                        {move.wouldStart ? 'Would start' : 'Bench depth'}
                      </Tag>
                      <PositionalBadge position={move.add.position} size="sm" depth={move.add.depth_chart_order} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DeltaBadge value={move.pointsGain} unit="PTS" tone="emerald" />
                      <DeltaBadge
                        value={move.modifierAdd}
                        unit="MOD"
                        tone={move.modifierAdd >= 0 ? 'amber' : 'slate'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
                    <div className="space-y-2 pt-1 md:pt-0 md:pr-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-sans text-zinc-400">
                          Drop from bench
                        </span>
                        <HealthTag player={move.drop} activeWeek={activeWeek} />
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerHeadshot player={move.drop} size="trade" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-sans font-medium text-zinc-200 text-sm break-words">
                              <PlayerLink player={move.drop} vs={move.add} onOpen={openTarget} />
                            </span>
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-zinc-400 flex items-center gap-1 whitespace-nowrap">
                            <TeamLogo team={move.drop.team} />
                            <span>{move.drop.team} · Bye {move.drop.bye_week || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <StatTiles player={move.drop} lambda={oracleLambda} muted />
                    </div>

                    <div className="space-y-2 pt-3 md:pt-0 md:pl-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-sans font-medium text-emerald-300">
                          Add free agent
                        </span>
                        <HealthTag player={move.add} activeWeek={activeWeek} />
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerHeadshot player={move.add} size="trade" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-sans font-medium text-zinc-100 text-sm break-words">
                              <PlayerLink player={move.add} vs={move.drop} onOpen={openTarget} />
                            </span>
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-zinc-400 flex items-center gap-1 whitespace-nowrap">
                            <TeamLogo team={move.add.team} />
                            <span>{move.add.team} · Bye {move.add.bye_week || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <StatTiles player={move.add} lambda={oracleLambda} />
                    </div>
                  </div>

                  <p className="text-xs font-sans text-zinc-400 pt-1 border-t border-white/[0.06]">
                    {move.reason}{' '}
                    {(() => {
                      const rel = elementRelation(
                        move.add.elemental_traits?.element,
                        move.drop.elemental_traits?.element,
                      );
                      return rel === '-' ? null : `(${rel})`;
                    })()}
                  </p>
                </GlassCard>
              </li>
            ))}
          </ol>
        )}
      </div>

      <PlayerDetailModal
        player={inspectedPlayer}
        compareWith={inspectedVs}
        isOpen={Boolean(inspectedPlayer)}
        activeWeek={activeWeek}
        onClose={() => {
          setInspectedPlayer(null);
          setInspectedVs(null);
        }}
      />
    </div>
  );
};

export default PlayerMarketplace;
