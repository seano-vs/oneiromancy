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

import BoardControls, { BoardModeFilter, BoardSortDirection, BoardSortField, PositionFilterValue } from '@/components/board/BoardControls';
import PlayerCardRow from '@/components/board/PlayerCardRow';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import GlassCard from '@/components/common/GlassCard';
import PositionalBadge from '@/components/common/PositionalBadge';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import { MAX_COMPARE_PLAYERS, useOneiromancy } from '@/context/OneiromancyContext';
import { DEFAULT_CHAOS_LAMBDA, isPlayerOnByeWeek, isPlayerSigned, stripUserSuffix } from '@/lib/scoring';
import { deriveEligiblePositions, getSeasonContext } from '@/lib/sleeper';
import {
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  buildUnitMap,
  computeTradePartners,
  computeWaiverMoves,
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  oracleScore,
  playerForecast,
  resolveActiveWeek,
  starsScore,
  statsPoints,
  type OracleEvalOptions,
} from '@/lib/oracle';
import { CosmicPlayer, NFLPosition, RosterSlot } from '@/types/oneiromancy';
import { RefreshCw, Scale } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface CosmicBoardProps {
  players?: CosmicPlayer[];
  onDraftPlayer?: (playerId: string) => void;
  onInspectPlayer?: (player: CosmicPlayer) => void;
  initialSearchQuery?: string;
  initialPositionFilter?: PositionFilterValue;
  initialSortField?: BoardSortField;
  initialHideDrafted?: boolean;
  initialFilter?: BoardModeFilter;
  className?: string;
}

export interface ComparePlayersOptions extends OracleEvalOptions {
  readonly direction?: BoardSortDirection;
  readonly lambda?: number;
}

export function comparePlayersForBoard(
  a: CosmicPlayer,
  b: CosmicPlayer,
  sortField: BoardSortField,
  options?: ComparePlayersOptions,
): number;
export function comparePlayersForBoard(
  a: CosmicPlayer,
  b: CosmicPlayer,
  sortField: BoardSortField,
  direction?: BoardSortDirection,
  lambda?: number,
  activeWeek?: number,
): number;
export function comparePlayersForBoard(
  a: CosmicPlayer,
  b: CosmicPlayer,
  sortField: BoardSortField,
  directionOrOptions: BoardSortDirection | ComparePlayersOptions = 'desc',
  legacyLambda: number = DEFAULT_CHAOS_LAMBDA,
  legacyActiveWeek?: number,
): number {
  const isOptionsBag = typeof directionOrOptions === 'object' && directionOrOptions !== null;
  const direction = isOptionsBag ? (directionOrOptions.direction ?? 'desc') : directionOrOptions;
  const lambda = isOptionsBag ? (directionOrOptions.lambda ?? DEFAULT_CHAOS_LAMBDA) : legacyLambda;
  const multiplier = direction === 'desc' ? -1 : 1;
  let primaryDiff = 0;
  const evalOptions: OracleEvalOptions = isOptionsBag
    ? {
        currentWeek: directionOrOptions.currentWeek,
        enabledSystems: directionOrOptions.enabledSystems,
        unitByTeam: directionOrOptions.unitByTeam,
      }
    : { currentWeek: legacyActiveWeek };

  switch (sortField) {
    case 'oracle':
    case 'draft_score':
      primaryDiff =
        oracleScore(a, lambda, evalOptions) -
        oracleScore(b, lambda, evalOptions);
      break;
    case 'stars':
    case 'favorability_score':
    case 'spirit_score':
      primaryDiff =
        starsScore(a, evalOptions) -
        starsScore(b, evalOptions);
      break;
    case 'projected_points':
      primaryDiff = statsPoints(a) - statsPoints(b);
      break;
    case 'market_vor':
      primaryDiff = a.market_vor - b.market_vor;
      break;
    case 'harmony_score':
      primaryDiff = a.harmony_score - b.harmony_score;
      break;
    case 'adp':
      primaryDiff = (b.adp || 999) - (a.adp || 999);
      break;
  }

  if (primaryDiff !== 0) return primaryDiff * multiplier;
  if (b.market_vor !== a.market_vor) return b.market_vor - a.market_vor;
  if (a.adp !== b.adp) return a.adp - b.adp;
  return a.name.localeCompare(b.name);
}

const NO_COMPARED_IDS: string[] = [];
const NO_MY_ROSTER: RosterSlot[] = [];

export const CosmicBoard: React.FC<CosmicBoardProps> = ({
  players: propPlayers,
  onDraftPlayer: propOnDraftPlayer,
  onInspectPlayer: propOnInspectPlayer,
  initialSearchQuery = '',
  initialPositionFilter = 'ALL',
  initialSortField = 'oracle',
  initialHideDrafted = false,
  initialFilter = 'all',
  className = '',
}) => {
  const context = useOneiromancy();

  const allPlayers = useMemo(
    () => propPlayers || context.draftState?.cosmic_board || [],
    [propPlayers, context.draftState?.cosmic_board],
  );

  const [modeFilter, setModeFilter] = useState<BoardModeFilter>(initialFilter);
  useEffect(() => {
    setModeFilter(initialFilter);
  }, [initialFilter]);

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [positionFilter, setPositionFilter] = useState<PositionFilterValue>(
    initialPositionFilter,
  );
  const [sortField, setSortField] = useState<BoardSortField>(initialSortField);
  const [sortDirection, setSortDirection] = useState<BoardSortDirection>('desc');
  const [hideDrafted, setHideDrafted] = useState(initialHideDrafted);
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const enabledSystems = context.enabledSystems ?? DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, positionFilter, modeFilter]);

  const [inspectedPlayer, setInspectedPlayer] = useState<CosmicPlayer | null>(null);
  const [inspectedVs, setInspectedVs] = useState<CosmicPlayer | null>(null);

  const leagueEligiblePositions = useMemo(
    () =>
      deriveEligiblePositions(
        context.draftState?.roster_positions || context.draftState?.settings?.roster_positions,
        context.draftState?.my_roster,
      ),
    [context.draftState?.roster_positions, context.draftState?.settings?.roster_positions, context.draftState?.my_roster],
  );

  const activeWeek = resolveActiveWeek(context.draftState);
  const comparedPlayerIds = context?.comparedPlayerIds ?? NO_COMPARED_IDS;
  const toggleComparePlayer = context?.toggleComparePlayer ?? (() => {});
  const clearComparedPlayers = context?.clearComparedPlayers ?? (() => {});

  const pinnedPlayers = useMemo(() => {
    const byId = new Map(allPlayers.map((p) => [String(p.id), p]));
    return comparedPlayerIds
      .map((id) => byId.get(String(id)))
      .filter((p): p is CosmicPlayer => Boolean(p));
  }, [allPlayers, comparedPlayerIds]);

  const myRoster = context.draftState?.my_roster ?? NO_MY_ROSTER;
  const unitByTeam = useMemo(
    () => buildUnitMap(allPlayers, myRoster),
    [allPlayers, myRoster],
  );
  const evalOptions = useMemo<OracleEvalOptions>(
    () => ({ currentWeek: activeWeek, enabledSystems, unitByTeam }),
    [activeWeek, enabledSystems, unitByTeam],
  );

  const waiverMap = useMemo(() => {
    const moves = computeWaiverMoves(
      allPlayers,
      myRoster,
      undefined,
      activeWeek,
      40,
      evalOptions,
    );
    const map = new Map<string, { drop: CosmicPlayer; oracleGain: number; wouldStart: boolean }>();
    for (const m of moves) {
      if (!leagueEligiblePositions.includes(m.add.position as NFLPosition)) continue;
      map.set(String(m.add.id), {
        drop: m.drop,
        oracleGain: m.pointsGain,
        wouldStart: m.wouldStart,
      });
    }
    return map;
  }, [allPlayers, myRoster, activeWeek, leagueEligiblePositions, evalOptions]);

  const tradeMap = useMemo(() => {
    const partners = computeTradePartners(
      context.draftState?.competitor_teams || [],
      allPlayers,
      myRoster,
      undefined,
      evalOptions,
    );
    const map = new Map<
      string,
      { partnerName: string; give?: CosmicPlayer; giveName?: string; gain?: number; oracleGain?: number }
    >();
    for (const p of partners) {
      const givesSigned = p.give?.player ? isPlayerSigned(p.give.player) : false;
      const receivesUnsigned = p.get?.player ? !isPlayerSigned(p.get.player) : false;
      if (givesSigned && receivesUnsigned) continue;
      if (p.get?.player) {
        map.set(String(p.get.player.id), {
          partnerName: stripUserSuffix(p.team?.name),
          give: p.give?.player,
          giveName: p.give?.player?.name,
          gain: p.get.gain,
        });
      }
    }
    for (const tp of context.draftState?.trade_proposals || []) {
      const rec = tp.receive_players?.[0];
      const give = tp.give_players?.[0];
      if (!rec || map.has(String(rec.player_id))) continue;
      const recPlayer = allPlayers.find((p) => String(p.id) === String(rec.player_id));
      const givePlayer =
        allPlayers.find((p) => String(p.id) === String(give?.player_id)) ||
        myRoster.find((s) => String(s.player?.id) === String(give?.player_id))?.player ||
        undefined;
      map.set(String(rec.player_id), {
        partnerName: stripUserSuffix(recPlayer?.drafted_by || tp.target_team_name),
        give: givePlayer,
        giveName: givePlayer?.name || (give as { name?: string } | undefined)?.name,
        gain: tp.net_vor_delta,
      });
    }
    return map;
  }, [context.draftState?.competitor_teams, context.draftState?.trade_proposals, myRoster, allPlayers, evalOptions]);

  const handleDraft = useCallback(
    (playerId: string) => {
      if (propOnDraftPlayer) {
        propOnDraftPlayer(playerId);
      } else {
        context.draftPlayer(playerId);
      }
    },
    [propOnDraftPlayer, context],
  );

  const handleInspect = useCallback(
    (player: CosmicPlayer, vs?: CosmicPlayer | null) => {
      if (propOnInspectPlayer) {
        propOnInspectPlayer(player);
      } else {
        setInspectedVs(vs ?? null);
        setInspectedPlayer(player);
        context.selectPlayer(player);
      }
    },
    [propOnInspectPlayer, context],
  );

  const positionCounts = useMemo(() => {
    const counts: Record<PositionFilterValue, number> = { ALL: allPlayers.length, QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
    for (const p of allPlayers) {
      if (p.position === 'QB') counts.QB++;
      if (p.position === 'RB') { counts.RB++; counts.FLEX++; }
      if (p.position === 'WR') { counts.WR++; counts.FLEX++; }
      if (p.position === 'TE') { counts.TE++; counts.FLEX++; }
    }
    return counts;
  }, [allPlayers]);

  const processedPlayers = useMemo(() => {
    let list = allPlayers;
    if (modeFilter === 'my_team') {
      list = list.filter((p) => p.draft_status === 'my_team');
    } else if (modeFilter === 'waivers') {
      list = list.filter((p) => p.draft_status === 'available' && leagueEligiblePositions.includes(p.position as NFLPosition) && isPlayerSigned(p));
    } else if (modeFilter === 'trades') {
      list = list.filter((p) => p.draft_status === 'drafted' && leagueEligiblePositions.includes(p.position as NFLPosition));
    } else if (hideDrafted) {
      list = list.filter((p) => p.draft_status === 'available');
    }
    if (positionFilter !== 'ALL') {
      list = positionFilter === 'FLEX' ? list.filter((p) => p.position === 'RB' || p.position === 'WR' || p.position === 'TE') : list.filter((p) => p.position === positionFilter);
    }
    const safeQuery = (searchQuery || '').trim().toLowerCase();
    if (safeQuery) {
      list = list.filter((p) => {
        const name = (p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
        return name.includes(safeQuery) || (p.team || '').toLowerCase().includes(safeQuery) || (p.drafted_by || '').toLowerCase().includes(safeQuery);
      });
    }
    return [...list].sort((a, b) => {
      if (modeFilter === 'waivers' && sortField === 'oracle') {
        const wA = waiverMap.get(String(a.id))?.oracleGain ?? -Infinity;
        const wB = waiverMap.get(String(b.id))?.oracleGain ?? -Infinity;
        if (wA !== wB) return wB - wA;
      }
      if (modeFilter === 'trades' && sortField === 'oracle') {
        const tA = tradeMap.get(String(a.id))?.gain ?? -Infinity;
        const tB = tradeMap.get(String(b.id))?.gain ?? -Infinity;
        if (tA !== tB) return tB - tA;
      }
      return comparePlayersForBoard(a, b, sortField, {
        direction: sortDirection,
        lambda: DEFAULT_CHAOS_LAMBDA,
        ...evalOptions,
      });
    });
  }, [allPlayers, modeFilter, hideDrafted, leagueEligiblePositions, positionFilter, searchQuery, sortField, sortDirection, waiverMap, tradeMap, evalOptions]);

  const processedIdSet = useMemo(
    () => new Set(processedPlayers.map((p) => String(p.id))),
    [processedPlayers],
  );
  const pinnedInFilter = useMemo(
    () => pinnedPlayers.filter((p) => processedIdSet.has(String(p.id))),
    [pinnedPlayers, processedIdSet],
  );
  const pinnedOutsideFilter = useMemo(
    () => pinnedPlayers.filter((p) => !processedIdSet.has(String(p.id))),
    [pinnedPlayers, processedIdSet],
  );

  const unpinnedProcessedPlayers = useMemo(() => {
    const pinnedSet = new Set(comparedPlayerIds.map(String));
    return processedPlayers.filter((p) => !pinnedSet.has(String(p.id)));
  }, [processedPlayers, comparedPlayerIds]);
  const pagePlayers = unpinnedProcessedPlayers.slice(0, visibleCount);

  return (
    <div className={`flex flex-col gap-4 w-full max-w-5xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
          Players
        </h2>
        <span className="text-xs font-mono tabular-nums text-zinc-400">
          Week {activeWeek} · {enabledSystems.length} predictors
        </span>
      </div>

      {/* Board Interactive Controls */}
      <BoardControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, dir) => {
          setSortField(field);
          if (dir) setSortDirection(dir);
        }}
        hideDrafted={hideDrafted}
        onToggleHideDrafted={setHideDrafted}
        modeFilter={modeFilter}
        onModeFilterChange={setModeFilter}
        positionCounts={positionCounts}
        totalVisibleCount={processedPlayers.length}
      />

      {context.isLoading && processedPlayers.length === 0 ? (
        <GlassCard
          variant="panel"
          className="p-8 text-center space-y-2 border border-white/10">
          <div className="flex items-center justify-center gap-2 text-zinc-300 text-sm font-sans">
            <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
            <span>Loading player directory...</span>
          </div>
        </GlassCard>
      ) : processedPlayers.length === 0 && pinnedPlayers.length === 0 ? (
        <GlassCard variant="panel" className="p-8 text-center space-y-1.5">
          <p className="text-sm font-sans font-medium text-zinc-200">
            No players match these filters
          </p>
          <p className="text-xs text-zinc-400 font-sans">
            Clear your search or select another position tab.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Mobile Card-Row List (<768px) */}
          <div className="rounded-xl border border-white/[0.08] bg-[#16181d] divide-y divide-white/[0.06] overflow-hidden md:hidden">
            {pinnedPlayers.map((player, idx) => (
              <PlayerCardRow
                key={`pinned-${player.id}`}
                player={player}
                rank={idx + 1}
                activeWeek={activeWeek}
                isCompared={true}
                onToggleCompare={toggleComparePlayer}
                onInspect={(p) => handleInspect(p)}
                onDraft={handleDraft}
              />
            ))}
            {pagePlayers.map((player, idx) => {
              const wHint = waiverMap.get(String(player.id));
              const tHint = tradeMap.get(String(player.id));
              return (
                <PlayerCardRow
                  key={`${player.id}-${player.draft_status}-${idx}`}
                  player={player}
                  rank={pinnedPlayers.length + idx + 1}
                  activeWeek={activeWeek}
                  isCompared={false}
                  isCompareDisabled={pinnedPlayers.length >= MAX_COMPARE_PLAYERS}
                  onToggleCompare={toggleComparePlayer}
                  onInspect={(p) => handleInspect(p, wHint?.drop ?? tHint?.give ?? null)}
                  onDraft={handleDraft}
                  waiverHint={
                    wHint
                      ? {
                          dropName: wHint.drop.name,
                          oracleGain: wHint.oracleGain,
                          wouldStart: wHint.wouldStart,
                        }
                      : undefined
                  }
                  tradeHint={tHint}
                />
              );
            })}
          </div>

          {/* Desktop Table (>=768px) */}
          <div className="hidden md:block rounded-xl border border-white/[0.08] bg-[#16181d] overflow-clip">
            <table
              data-testid="cosmic-board-table"
              className="w-full table-fixed text-left font-mono text-xs border-collapse">
              <thead className="sticky top-14 z-10 bg-[#121418]">
                <tr className="border-b border-white/[0.08] bg-[#121418] text-zinc-400 font-sans text-xs font-medium">
                  <th data-testid="compare-col-header" className="py-2.5 px-1 w-8 text-center tracking-normal" title="Compare">
                    <Scale aria-hidden="true" className="w-3.5 h-3.5 inline-block" />
                    <span className="sr-only">Compare</span>
                  </th>
                  <th className="py-2.5 px-1.5 w-9 lg:w-10 text-center">#</th>
                  <th className="py-2.5 px-4">Player</th>
                  <th className="py-2.5 px-2 w-14">Pos</th>
                  <th className="py-2.5 px-2 w-28 lg:w-32">Team</th>
                  <th
                    data-testid="board-base-col-header"
                    aria-sort={
                      sortField === 'projected_points'
                        ? sortDirection === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                    className="py-2.5 px-2 w-16 lg:w-20 text-right"
                    title="Projected base points for next game from Sleeper"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sortField === 'projected_points') {
                          setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
                        } else {
                          setSortField('projected_points');
                          setSortDirection('desc');
                        }
                      }}
                      className={`inline-flex items-center justify-end gap-1 cursor-pointer hover:text-zinc-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 rounded-xs ${
                        sortField === 'projected_points' ? 'text-amber-200 font-semibold' : 'text-zinc-300'
                      }`}
                    >
                      <span>Base</span>
                      {sortField === 'projected_points' && (
                        <span aria-hidden="true" className="text-[10px] font-mono">
                          {sortDirection === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th
                    data-testid="board-modifier-col-header"
                    aria-sort={
                      sortField === 'stars'
                        ? sortDirection === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                    className="py-2.5 px-2 w-20 lg:w-24 text-right"
                    title="Combined +/- point differential across active prediction systems"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sortField === 'stars') {
                          setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
                        } else {
                          setSortField('stars');
                          setSortDirection('desc');
                        }
                      }}
                      className={`inline-flex items-center justify-end gap-1 cursor-pointer hover:text-zinc-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 rounded-xs ${
                        sortField === 'stars' ? 'text-amber-200 font-semibold' : 'text-zinc-300'
                      }`}
                    >
                      <span>Modifier</span>
                      {sortField === 'stars' && (
                        <span aria-hidden="true" className="text-[10px] font-mono">
                          {sortDirection === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th
                    data-testid="board-projected-col-header"
                    aria-sort={
                      sortField === 'oracle' || sortField === 'draft_score'
                        ? sortDirection === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                    className="py-2.5 px-2 w-20 lg:w-24 text-right"
                    title="Projected net points (Base + Modifier)"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (sortField === 'oracle' || sortField === 'draft_score') {
                          setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
                        } else {
                          setSortField('oracle');
                          setSortDirection('desc');
                        }
                      }}
                      className={`inline-flex items-center justify-end gap-1 cursor-pointer hover:text-zinc-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 rounded-xs ${
                        sortField === 'oracle' || sortField === 'draft_score'
                          ? 'text-amber-200 font-semibold'
                          : 'text-zinc-300'
                      }`}
                    >
                      <span>Projected</span>
                      {(sortField === 'oracle' || sortField === 'draft_score') && (
                        <span aria-hidden="true" className="text-[10px] font-mono">
                          {sortDirection === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 w-28 lg:w-36 text-right">Roster</th>
                </tr>
              </thead>
              {pinnedPlayers.length > 0 && (
                <tbody data-testid="compare-pinned" className="divide-y divide-amber-500/20 bg-amber-500/[0.04]">
                  {pinnedPlayers.map((player, idx) => {
                    const isAvailable = player.draft_status === 'available';
                    const isMyTeam = player.draft_status === 'my_team';
                    const seasonCtx = getSeasonContext();
                    const onBye = isPlayerOnByeWeek(activeWeek, player.bye_week, player.team, seasonCtx?.byeWeeks);
                    const placeholder = oraclePlaceholderInfo(player, activeWeek);
                    const forecast = playerForecast(player, {
                      currentWeek: activeWeek,
                      enabledSystems,
                      unitByTeam,
                      placeholder: true,
                      nextGameLookahead: true,
                    });
                    const basePts = onBye ? 0 : forecast.basePts;
                    const modPts = forecast.overallModifierPts;
                    return (
                      <tr
                        key={`pinned-${player.id}`}
                        onClick={() => handleInspect(player)}
                        data-bye={onBye ? 'true' : undefined}
                        className={`bg-amber-500/[0.06] hover:bg-amber-500/[0.1] border-b border-amber-500/20 transition-colors cursor-pointer ${
                          onBye ? 'opacity-50 grayscale' : ''
                        }`}
                      >
                        <td className="py-2.5 px-1 text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => {}}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              toggleComparePlayer(String(player.id));
                            }}
                            aria-label={`Compare ${player.name}`}
                            className="checkbox-matte cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center text-amber-300 font-semibold tabular-nums">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-sans font-medium text-zinc-100">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PlayerHeadshot player={player} size="sm" />
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleInspect(player);
                                }}
                                className="text-left cursor-pointer hover:text-amber-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 rounded-xs break-words"
                              >
                                {player.name}
                              </button>
                              <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30 shrink-0">
                                Pinned
                              </span>
                              {player.injury_status && player.injury_status !== 'Healthy' && (
                                <span
                                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                                    ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status)
                                      ? 'text-rose-300 bg-rose-950/50 border-rose-500/30'
                                      : 'text-amber-300 bg-amber-950/50 border-amber-500/30'
                                  }`}
                                >
                                  {player.injury_status.toUpperCase()}
                                </span>
                              )}
                              {onBye && (
                                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 text-amber-300 bg-amber-950/50 border-amber-500/30">
                                  {`BYE WK ${player.bye_week || activeWeek}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <PositionalBadge position={player.position} size="sm" depth={player.depth_chart_order} />
                        </td>
                        <td className="py-2.5 px-2 text-zinc-400 tabular-nums whitespace-nowrap">
                          <TeamLogo team={player.team} className="mr-1.5" />
                          {player.team} · Bye {player.bye_week || '-'}
                        </td>
                        <td
                          data-testid="board-base-cell"
                          className="py-2.5 px-2 text-right font-medium text-zinc-100 tabular-nums whitespace-nowrap"
                          title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
                        >
                          {basePts.toFixed(1)}
                          {placeholder.hasPlaceholder && (
                            <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
                          )}
                        </td>
                        <td
                          data-testid="board-modifier-cell"
                          className={`py-2.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap ${modifierTextColor(modPts)}`}
                          title="Combined +/- point differential across active predictors"
                        >
                          {formatSignedModifier(modPts)}
                        </td>
                        <td
                          data-testid="board-projected-cell"
                          className={`py-2.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                            sortField === 'oracle' || sortField === 'draft_score'
                              ? 'text-amber-200'
                              : 'text-zinc-100'
                          }`}
                          title={`Projected net points (${forecast.basePts.toFixed(1)} base ${formatSignedModifier(modPts)} mod)`}
                        >
                          {forecast.adjustedPts.toFixed(1)}
                          {placeholder.hasPlaceholder && (
                            <OraclePlaceholderMarker placeholder={placeholder} />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans text-xs whitespace-nowrap">
                          <span
                            className={
                              isMyTeam
                                ? 'text-amber-300 font-medium'
                                : isAvailable
                                ? 'text-emerald-300'
                                : 'text-zinc-400'
                            }
                          >
                            {isMyTeam ? 'My Roster' : isAvailable ? 'Free agent' : stripUserSuffix(player.drafted_by, 'Rostered')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
              <tbody data-testid="cosmic-board-body" className="divide-y divide-white/[0.05]">
                {pagePlayers.map((player, idx) => {
                  const isAvailable = player.draft_status === 'available';
                  const isMyTeam = player.draft_status === 'my_team';
                  const wHint = waiverMap.get(String(player.id));
                  const tHint = tradeMap.get(String(player.id));
                  const tradeGiveName = tHint?.give?.name || tHint?.giveName;
                  const tradeGain = tHint ? (tHint.gain ?? tHint.oracleGain) : undefined;
                  const tradeSummary = tHint
                    ? [
                        tradeGiveName ? `Send ${tradeGiveName}` : '',
                        stripUserSuffix(tHint.partnerName),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : '';
                  const seasonCtx = getSeasonContext();
                  const onBye = isPlayerOnByeWeek(activeWeek, player.bye_week, player.team, seasonCtx?.byeWeeks);
                  const placeholder = oraclePlaceholderInfo(player, activeWeek);
                  const forecast = playerForecast(player, {
                    currentWeek: activeWeek,
                    enabledSystems,
                    unitByTeam,
                    placeholder: true,
                    nextGameLookahead: true,
                  });
                  const basePts = onBye ? 0 : forecast.basePts;
                  const modPts = forecast.overallModifierPts;
                  return (
                    <tr
                      key={`${player.id}-${player.draft_status}-${idx}`}
                      onClick={() => handleInspect(player, wHint?.drop ?? tHint?.give ?? null)}
                      data-bye={onBye ? 'true' : undefined}
                      className={`hover:bg-white/[0.025] transition-colors cursor-pointer ${
                        isMyTeam ? 'bg-amber-500/[0.03]' : ''
                      } ${onBye ? 'opacity-50 grayscale' : ''}`}>
                      <td className="py-2.5 px-1 text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={pinnedPlayers.length >= MAX_COMPARE_PLAYERS}
                          title={pinnedPlayers.length >= MAX_COMPARE_PLAYERS ? `Maximum of ${MAX_COMPARE_PLAYERS} players compared` : undefined}
                          onChange={() => {}}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (pinnedPlayers.length < MAX_COMPARE_PLAYERS) {
                              toggleComparePlayer(String(player.id));
                            }
                          }}
                          aria-label={`Compare ${player.name}`}
                          className={`checkbox-matte ${
                            pinnedPlayers.length >= MAX_COMPARE_PLAYERS ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center text-zinc-400 tabular-nums">{pinnedPlayers.length + idx + 1}</td>
                      <td className="py-2.5 px-4 font-sans font-medium text-zinc-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PlayerHeadshot player={player} size="sm" />
                          <div className="min-w-0 flex-1 flex flex-col">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleInspect(player, wHint?.drop ?? tHint?.give ?? null);
                                }}
                                className="text-left cursor-pointer hover:text-amber-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 rounded-xs break-words"
                              >
                                {player.name}
                              </button>
                              {player.injury_status && player.injury_status !== 'Healthy' && (
                                <span
                                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                                    ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status)
                                      ? 'text-rose-300 bg-rose-950/50 border-rose-500/30'
                                      : 'text-amber-300 bg-amber-950/50 border-amber-500/30'
                                  }`}>
                                  {player.injury_status.toUpperCase()}
                                </span>
                              )}
                              {onBye && (
                                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 text-amber-300 bg-amber-950/50 border-amber-500/30">
                                  {`BYE WK ${player.bye_week || activeWeek}`}
                                </span>
                              )}
                            </div>
                            {isAvailable && wHint && (
                              <span className="text-[11px] font-sans font-normal text-emerald-300 leading-snug break-words">
                                {`Drop ${wHint.drop.name} `}
                                <span className="font-mono tabular-nums ml-0.5">(+{wHint.oracleGain.toFixed(1)} pts)</span>
                              </span>
                            )}
                            {!isAvailable && !isMyTeam && tHint && tradeSummary && (
                              <span className="text-[11px] font-sans font-normal text-zinc-400 leading-snug break-words">
                                {tradeSummary}
                                {tradeGain ? ` (+${tradeGain.toFixed(1)} pts)` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <PositionalBadge position={player.position} size="sm" depth={player.depth_chart_order} />
                      </td>
                      <td className="py-2.5 px-2 text-zinc-400 tabular-nums whitespace-nowrap">
                        <TeamLogo team={player.team} className="mr-1.5" />
                        {player.team} · Bye {player.bye_week || '-'}
                      </td>
                      <td
                        data-testid="board-base-cell"
                        className="py-2.5 px-2 text-right font-medium text-zinc-100 tabular-nums whitespace-nowrap"
                        title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
                      >
                        {basePts.toFixed(1)}
                        {placeholder.hasPlaceholder && (
                          <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
                        )}
                      </td>
                      <td
                        data-testid="board-modifier-cell"
                        className={`py-2.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap ${modifierTextColor(modPts)}`}
                        title="Combined +/- point differential across active predictors"
                      >
                        {formatSignedModifier(modPts)}
                      </td>
                      <td
                        data-testid="board-projected-cell"
                        className={`py-2.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                          sortField === 'oracle' || sortField === 'draft_score'
                            ? 'text-amber-200'
                            : 'text-zinc-100'
                        }`}
                        title={`Projected net points (${forecast.basePts.toFixed(1)} base ${formatSignedModifier(modPts)} mod)`}
                      >
                        {forecast.adjustedPts.toFixed(1)}
                        {placeholder.hasPlaceholder && (
                          <OraclePlaceholderMarker placeholder={placeholder} />
                        )}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-sans text-xs whitespace-nowrap"
                        title={
                          isMyTeam
                            ? 'My Roster'
                            : isAvailable
                            ? 'Free agent'
                            : stripUserSuffix(player.drafted_by) || stripUserSuffix(tHint?.partnerName) || 'Rostered'
                        }
                      >
                        <span
                          className={
                            isMyTeam
                              ? 'text-amber-300 font-medium'
                              : isAvailable
                              ? 'text-emerald-300'
                              : 'text-zinc-400'
                          }
                        >
                          {isMyTeam
                            ? 'My Roster'
                            : isAvailable
                            ? 'Free agent'
                            : stripUserSuffix(player.drafted_by) || stripUserSuffix(tHint?.partnerName) || 'Rostered'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="text-xs font-sans text-zinc-400">
              Showing <span className="font-mono tabular-nums text-zinc-300">{pinnedInFilter.length + pagePlayers.length}</span> of <span className="font-mono tabular-nums text-zinc-300">{processedPlayers.length}</span> players
              {pinnedOutsideFilter.length > 0 && ` (+${pinnedOutsideFilter.length} pinned across filters)`}
            </span>
            {unpinnedProcessedPlayers.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="self-center px-4 py-2 rounded-lg bg-[#16181d] border border-white/10 text-xs font-sans font-medium text-zinc-200 hover:border-white/25 transition-colors">
                Show {Math.min(PAGE_SIZE, unpinnedProcessedPlayers.length - visibleCount)} more
              </button>
            )}
          </div>
        </>
      )}

      {/* Comparison Action Bar */}
      {pinnedPlayers.length > 0 && (
        <div
          data-testid="compare-action-bar"
          className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#16181d] border border-amber-400/35 shadow-xl font-sans text-xs"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-zinc-100 font-medium">
              Comparing <span className="font-mono tabular-nums text-amber-300">{pinnedPlayers.length} of {MAX_COMPARE_PLAYERS}</span> players
            </span>
          </div>
          <button
            type="button"
            data-testid="clear-compare-btn"
            onClick={clearComparedPlayers}
            className="text-zinc-300 hover:text-zinc-100 underline cursor-pointer font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Inspection Modal */}
      <PlayerDetailModal
        player={inspectedPlayer}
        compareWith={inspectedVs}
        isOpen={Boolean(inspectedPlayer)}
        roster={context.draftState?.my_roster}
        activeWeek={activeWeek}
        onClose={() => {
          setInspectedPlayer(null);
          setInspectedVs(null);
          context.selectPlayer(null);
        }}
      />
    </div>
  );
};

export default CosmicBoard;
