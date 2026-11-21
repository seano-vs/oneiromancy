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
import PositionalBadge from '@/components/common/PositionalBadge';
import RosterSlotBadge from '@/components/common/RosterSlotBadge';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import { type InspectTarget } from '@/components/common/PlayerLink';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import { HealthTag } from '@/components/common/PlayerTiles';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { mockCompetitorTeams, mockWeeklyMatchup } from '@/lib/mockData';
import { deriveWeeklyMatchup, getSeasonContext } from '@/lib/sleeper';
import { moonAt, neutralVenueCoords, planetaryHourAt, teamGame } from '@/lib/nflGames';
import {
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  buildUnitMap,
  compute18WeekByeCoverage,
  computeLineupCheck,
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';
import {
  hasUserSuffix,
  stripUserSuffix,
  isNFLByeWeek,
  isPlayerOnByeWeek,
} from '@/lib/scoring';
import type {
  CompetitorTeam,
  CosmicPlayer,
  DraftPickState,
  IdealDraftPick,
  RosterSlot,
} from '@/types/oneiromancy';
import { ArrowUpDown, Moon, Sparkles } from 'lucide-react';

export interface OneiromancyDashboardProps {
  recommendedPick?: CosmicPlayer | null;
  ascensionPath?: IdealDraftPick[];
  myRoster?: RosterSlot[];
  currentPick?: DraftPickState;
  onDraftPlayer?: (playerId: string) => void;
  onInspectPlayer?: (player: CosmicPlayer) => void;
  className?: string;
}

export const OneiromancyDashboard: React.FC<OneiromancyDashboardProps> = ({
  myRoster: propMyRoster,
  onInspectPlayer: propOnInspectPlayer,
  className = '',
}) => {
  const context = useOneiromancy();
  const draftState = context.draftState;
  const enabledSystems = context.enabledSystems ?? DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
  const [inspected, setInspected] = useState<InspectTarget | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const myRoster = useMemo(
    () => propMyRoster || draftState?.my_roster || [],
    [propMyRoster, draftState?.my_roster],
  );

  const weeklyMatchup = useMemo(() => {
    let raw = draftState?.weekly_matchup;
    if (!raw && draftState?.competitor_teams?.length) {
      const activeUserTeam = draftState.competitor_teams.find((t) => t.is_user);
      const activeRosterId = activeUserTeam?.roster_id ?? (draftState.settings?.user_slot || 7);
      const activeWk = getSeasonContext()?.currentWeek ?? 1;
      raw = deriveWeeklyMatchup(
        activeRosterId,
        draftState.competitor_teams,
        null,
        draftState.cosmic_board,
        draftState.my_roster,
        activeWk,
      );
    }
    return raw || (draftState?.isLive ? null : mockWeeklyMatchup);
  }, [draftState]);

  const starterSlots = useMemo(
    () => myRoster.filter((s) => !s.slot_id.startsWith('BN')),
    [myRoster],
  );
  const benchSlots = useMemo(
    () => myRoster.filter((s) => s.slot_id.startsWith('BN')),
    [myRoster],
  );
  const startingPlayers = useMemo(
    () => starterSlots.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p)),
    [starterSlots],
  );
  const byeSchedule = useMemo(
    () => compute18WeekByeCoverage(myRoster),
    [myRoster],
  );

  // Global Universe State at current kickoff window
  const universeState = useMemo(() => {
    const season = getSeasonContext();
    const activeWeek = resolveActiveWeek(draftState, selectedWeek);
    const starterGame = startingPlayers
      .map((p) => teamGame(activeWeek, p.team))
      .find((g) => Boolean(g?.kickoff || g?.date));
    const seasonYear = Number(season?.season) || 2025;
    const fallbackIso = new Date(
      Date.UTC(seasonYear, 8, 7 + Math.max(0, activeWeek - 1) * 7, 17, 0, 0),
    ).toISOString();
    const refDate = new Date(
      starterGame?.kickoff ||
        (starterGame?.date ? `${starterGame.date}T17:00:00Z` : fallbackIso),
    );
    const homeFav = starterGame?.home
      ? weeklyMatchup?.player_favorabilities?.find(
          (pf) => (pf.nfl_team || pf.team) === starterGame.home,
        )
      : undefined;
    const refLon =
      neutralVenueCoords(starterGame?.venue?.name)?.lon ??
      homeFav?.stadium?.longitude ??
      weeklyMatchup?.player_favorabilities?.find(
        (pf) => typeof pf.stadium?.longitude === 'number',
      )?.stadium?.longitude;
    const moon = moonAt(refDate);
    const hour = planetaryHourAt(
      refDate,
      typeof refLon === 'number' && Number.isFinite(refLon) ? refLon : 0,
    );
    return { moon, hour, activeWeek };
  }, [
    weeklyMatchup?.player_favorabilities,
    startingPlayers,
    selectedWeek,
    draftState,
  ]);

  const unitByTeam = useMemo(
    () => buildUnitMap(draftState?.cosmic_board ?? [], myRoster),
    [draftState?.cosmic_board, myRoster],
  );

  // Lineup swap recommendations (bench -> starter) by Base + Modifier
  const swaps = useMemo(
    () =>
      computeLineupCheck(myRoster, undefined, universeState.activeWeek, {
        currentWeek: universeState.activeWeek,
        enabledSystems,
        unitByTeam,
      }),
    [myRoster, universeState.activeWeek, enabledSystems, unitByTeam],
  );
  const swapByStarterId = useMemo(() => {
    const map = new Map<string, (typeof swaps)[number]>();
    for (const s of swaps) {
      if (s.playerOut) map.set(String(s.playerOut.id), s);
    }
    return map;
  }, [swaps]);
  const swapByBenchId = useMemo(() => {
    const map = new Map<string, (typeof swaps)[number]>();
    for (const s of swaps) {
      map.set(String(s.playerIn.id), s);
    }
    return map;
  }, [swaps]);

  const competitorTeams = useMemo<CompetitorTeam[]>(() => {
    if (draftState?.competitor_teams?.length) return draftState.competitor_teams;
    return draftState?.isLive ? [] : mockCompetitorTeams;
  }, [draftState?.competitor_teams, draftState?.isLive]);

  const userTeam = useMemo(
    () =>
      competitorTeams.find((t) => t.is_user === true) ||
      competitorTeams.find((t) => hasUserSuffix(t.name)) ||
      competitorTeams.find((t) => t.slot === (draftState?.settings?.user_slot || 7)) ||
      competitorTeams[0],
    [competitorTeams, draftState?.settings?.user_slot],
  );

  const handleOpenPlayer = (player: CosmicPlayer, vs: CosmicPlayer | null = null) => {
    if (propOnInspectPlayer && !vs) {
      propOnInspectPlayer(player);
      return;
    }
    setInspected({ player, vs });
  };

  const renderPlayerRow = (slot: RosterSlot, isBench: boolean) => {
    const p = slot.player;
    if (!p) {
      return (
        <div
          key={slot.slot_id}
          className="px-3 sm:px-4 py-3 flex items-center justify-between text-xs font-sans text-zinc-400"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <RosterSlotBadge slotId={slot.slot_id} slotName={slot.slot_name} size="sm" className="shrink-0" />
            <span>Empty Slot</span>
          </div>
          <span className="font-mono text-zinc-500">-</span>
        </div>
      );
    }
    const seasonCtx = getSeasonContext();
    const activeWk = universeState.activeWeek;
    const onBye = isPlayerOnByeWeek(activeWk, p.bye_week, p.team, seasonCtx?.byeWeeks);
    const placeholder = oraclePlaceholderInfo(p, activeWk);
    const forecast = playerForecast(p, {
      currentWeek: activeWk,
      enabledSystems,
      unitByTeam,
      placeholder: false,
      nextGameLookahead: false,
    });
    const benchLookahead =
      isBench && placeholder.hasPlaceholder
        ? playerForecast(p, {
            currentWeek: activeWk,
            enabledSystems,
            unitByTeam,
            placeholder: true,
            nextGameLookahead: true,
          })
        : null;
    const basePts = onBye ? 0 : forecast.basePts;
    const modPts = benchLookahead
      ? benchLookahead.overallModifierPts
      : onBye
        ? 0
        : forecast.overallModifierPts;
    const projPts = benchLookahead
      ? benchLookahead.adjustedPts
      : onBye
        ? 0
        : forecast.adjustedPts;
    const starterSwap = !isBench ? swapByStarterId.get(String(p.id)) : undefined;
    const benchSwap = isBench ? swapByBenchId.get(String(p.id)) : undefined;
    const compareTarget = starterSwap?.playerIn ?? benchSwap?.playerOut ?? null;
    const normalizedSlot = slot.slot_id.replace(/\d+$/, '').toUpperCase();
    const showPosBadge =
      isBench ||
      !['QB', 'RB', 'WR', 'TE'].includes(normalizedSlot) ||
      Boolean(p.depth_chart_order && p.depth_chart_order > 0);
    const hasNonHealthyStatus = Boolean(p.injury_status && p.injury_status !== 'Healthy');

    return (
      <div
        key={slot.slot_id}
        data-testid={`roster-card-${slot.slot_id}`}
        data-bye={onBye ? 'true' : undefined}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          if ((e.target as HTMLElement)?.closest?.('button, a, input, select, textarea')) return;
          handleOpenPlayer(p, compareTarget);
        }}
        className={`group relative px-3 sm:px-4 py-2.5 transition-colors cursor-pointer ${
          onBye
            ? 'opacity-50 grayscale hover:opacity-80 bg-zinc-950/40'
            : starterSwap
              ? 'bg-amber-500/[0.05] hover:bg-amber-500/[0.08]'
              : benchSwap
                ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]'
                : 'hover:bg-white/[0.025]'
        }`}
      >
        <button
          type="button"
          aria-label={`Inspect ${p.name}`}
          onClick={() => handleOpenPlayer(p, compareTarget)}
          className="absolute inset-0 z-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <RosterSlotBadge slotId={slot.slot_id} slotName={slot.slot_name} size="sm" className="shrink-0" />
            <div
              data-testid="player-divination-aura"
              title={`Modifier ${formatSignedModifier(modPts)} pts`}
              className="shrink-0"
            >
              <PlayerHeadshot player={p} size="roster" />
            </div>
            <div data-testid="roster-card-text-col" className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="font-sans font-medium text-sm text-zinc-100 break-words">{p.name}</span>
                {showPosBadge && !starterSwap && !benchSwap && (
                  <PositionalBadge position={p.position} size="sm" className="shrink-0" depth={p.depth_chart_order} />
                )}
                {starterSwap && (() => {
                  const gain = Number(starterSwap.pointsGain || 0).toFixed(1);
                  const title = `Swap alert: bench ${starterSwap.playerIn.name} leads by +${gain} pts`;
                  return (
                    <span
                      data-testid="lineup-swap-arrow"
                      title={title}
                      className="inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[10px] font-mono tabular-nums font-medium shrink-0"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                      <span>+{gain}<span className="hidden sm:inline"> pts</span></span>
                    </span>
                  );
                })()}
                {benchSwap && (() => {
                  const gain = Number(benchSwap.pointsGain || 0).toFixed(1);
                  const title = benchSwap.playerOut
                    ? `Start over ${benchSwap.playerOut.name} (+${gain} pts)`
                    : `Promote to empty slot (+${gain} pts)`;
                  return (
                    <span
                      title={title}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono tabular-nums font-medium shrink-0"
                    >
                      <span>Start +{gain} pts</span>
                    </span>
                  );
                })()}
                {(hasNonHealthyStatus || onBye) && (
                  <HealthTag player={p} activeWeek={activeWk} />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-sans text-zinc-400 mt-0.5">
                {showPosBadge && (starterSwap || benchSwap) && (
                  <PositionalBadge position={p.position} size="sm" className="shrink-0" depth={p.depth_chart_order} />
                )}
                <span className="font-mono tabular-nums text-[11px] shrink-0">
                  <TeamLogo team={p.team} className="mr-1" />
                  {p.team || 'FA'} · Bye {p.bye_week || '-'}
                </span>
                {!onBye && forecast.matchup.opponent && (
                  <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                    <span aria-hidden="true" className="mr-1.5">·</span>
                    <span>
                      {forecast.matchup.isHome ? 'vs' : '@'}{' '}
                      <TeamLogo team={forecast.matchup.opponent} className="mr-1" />
                      {forecast.matchup.opponent}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3 Aligned Tabular Columns: Base, Modifier & Projected */}
          <div className="flex items-center gap-2 sm:gap-5 shrink-0 self-end sm:self-auto font-mono tabular-nums text-right">
            <div
              className="w-10 sm:w-14 text-xs sm:text-sm font-medium text-zinc-100 inline-flex items-center justify-end"
              title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Projected base points for next game'}
            >
              {basePts.toFixed(1)}
              {placeholder.hasPlaceholder && (
                <span className="inline-flex pointer-events-auto relative z-20">
                  <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
                </span>
              )}
            </div>
            <div
              className={`w-12 sm:w-16 text-xs sm:text-sm font-semibold inline-flex items-center justify-end ${modifierTextColor(modPts)}`}
              title={`Combined modifier across ${enabledSystems.length} predictors`}
            >
              {formatSignedModifier(modPts)}
            </div>
            <div
              data-testid="roster-projected-cell"
              className="w-12 sm:w-16 text-xs sm:text-sm font-semibold text-amber-200 inline-flex items-center justify-end"
              title={`Projected net points (${basePts.toFixed(1)} base ${formatSignedModifier(modPts)} mod)`}
            >
              {projPts.toFixed(1)}
              {placeholder.hasPlaceholder && (
                <span className="inline-flex pointer-events-auto relative z-20">
                  <OraclePlaceholderMarker placeholder={placeholder} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-6 w-full max-w-5xl mx-auto ${className}`}>
      {/* 1. Editorial Page Header */}
      <div
        data-testid="universe-state-banner"
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-4"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              {stripUserSuffix(userTeam?.name, 'My Roster')}
            </h2>
            <select
              data-testid="dashboard-week-select"
              aria-label="Select active week"
              value={universeState.activeWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="bg-zinc-900 border border-white/10 hover:border-white/20 rounded-md px-2.5 py-1 text-xs font-mono tabular-nums text-zinc-200 focus:outline-none focus:border-amber-400/60 cursor-pointer"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((wk) => (
                <option key={wk} value={wk} className="bg-zinc-900 text-zinc-100">
                  Week {wk}{isNFLByeWeek(wk) ? ' · Byes' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs font-sans text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1 text-sky-200/90">
              <Moon className="w-3 h-3 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{universeState.moon}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-violet-200/90">
              <Sparkles className="w-3 h-3 text-violet-300 shrink-0" aria-hidden="true" />
              <span>{universeState.hour}</span>
            </span>
          </p>
        </div>

        <div className="text-xs font-sans text-zinc-400 sm:text-right space-y-0.5">
          {(() => {
            const seasonCtx = getSeasonContext();
            const activeWk = universeState.activeWeek;
            let baseSum = 0;
            let modSum = 0;
            for (const sl of starterSlots) {
              if (!sl.player) continue;
              if (isPlayerOnByeWeek(activeWk, sl.player.bye_week, sl.player.team, seasonCtx?.byeWeeks)) continue;
              const f = playerForecast(sl.player, {
                currentWeek: activeWk,
                enabledSystems,
                placeholder: false,
                nextGameLookahead: false,
              });
              baseSum += Number(f.basePts.toFixed(1));
              modSum += f.overallModifierPts;
            }
            const projSum = Math.max(0, baseSum + modSum);
            return (
              <div
                data-testid="roster-projected-total"
                className="font-mono tabular-nums text-xs text-zinc-300"
              >
                Projected <span className="text-amber-200 font-semibold">{projSum.toFixed(1)}</span> pts · Base{' '}
                {baseSum.toFixed(1)} · {formatSignedModifier(modSum)}
              </div>
            );
          })()}
          <div>
            {swaps.length > 0 ? (
              <span className="text-amber-300 font-medium">
                {swaps.length} lineup {swaps.length === 1 ? 'upgrade' : 'upgrades'} available
              </span>
            ) : (
              <span>Optimal lineup set for Week {universeState.activeWeek}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actionable Lineup Swap Callout */}
      {swaps.length > 0 && (
        <div
          data-testid="lineup-swap-banner"
          className="px-3.5 sm:px-4 py-2.5 rounded-lg border bg-amber-500/[0.06] border-amber-400/25 text-zinc-200 text-xs font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              {swaps[0].playerOut ? (
                <>
                  Start <strong className="text-zinc-100 font-semibold">{swaps[0].playerIn.name}</strong> · leads{' '}
                  <strong className="text-zinc-100 font-semibold">{swaps[0].playerOut.name}</strong>{' '}
                  (<span className="font-mono tabular-nums text-amber-300">+{Number(swaps[0].pointsGain || 0).toFixed(1)}</span> pts)
                </>
              ) : (
                <>
                  <strong className="text-zinc-100 font-semibold">{swaps[0].playerIn.name}</strong> can fill an empty slot{' '}
                  (<span className="font-mono tabular-nums text-amber-300">+{Number(swaps[0].pointsGain || 0).toFixed(1)}</span> pts)
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            data-testid="lineup-swap-banner-button"
            onClick={() => handleOpenPlayer(swaps[0].playerIn, swaps[0].playerOut ?? null)}
            className="text-xs font-medium text-amber-300 hover:text-amber-200 hover:underline shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Compare →
          </button>
        </div>
      )}

      {/* 2. Primary Feature: Starting Lineup & Bench */}
      <div className="space-y-5">
        <section
          aria-label="Active Starters"
          className="rounded-xl border border-white/[0.08] bg-[#16181d] overflow-hidden"
        >
          <div className="px-3 sm:px-4 py-2.5 bg-[#121418] border-b border-white/[0.08] flex items-center justify-between gap-2 sm:gap-3">
            <h3 className="font-sans text-xs font-semibold text-zinc-200">
              Starters <span className="text-zinc-400 font-normal font-mono tabular-nums">({starterSlots.length})</span>
            </h3>
            <div className="flex items-center gap-2 sm:gap-5 shrink-0 font-sans text-[11px] font-medium text-zinc-400 text-right">
              <span className="w-10 sm:w-14 text-zinc-300">Base</span>
              <span className="w-12 sm:w-16 text-zinc-300">Modifier</span>
              <span className="w-12 sm:w-16 text-amber-200/90">Projected</span>
            </div>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {starterSlots.map((slot) => renderPlayerRow(slot, false))}
          </div>
        </section>

        <section
          aria-label="Bench Depth"
          className="rounded-xl border border-white/[0.08] bg-[#16181d] overflow-hidden"
        >
          <div className="px-3 sm:px-4 py-2.5 bg-[#121418] border-b border-white/[0.08] flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-baseline gap-2">
              <h3 className="font-sans text-xs font-semibold text-zinc-300">
                Bench <span className="text-zinc-400 font-normal font-mono tabular-nums">({benchSlots.length})</span>
              </h3>
              <span className="hidden sm:inline text-[11px] text-zinc-400">Next-game forecast</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-5 shrink-0 font-sans text-[11px] font-medium text-zinc-400 text-right">
              <span className="w-10 sm:w-14 text-zinc-300">Base</span>
              <span className="w-12 sm:w-16 text-zinc-300">Modifier</span>
              <span className="w-12 sm:w-16 text-amber-200/90">Projected</span>
            </div>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {benchSlots.map((slot) => renderPlayerRow(slot, true))}
          </div>
        </section>
      </div>

      {/* 3. Supporting Context: 18-Week Bye Schedule */}
      <section
        data-testid="18-week-coverage-strip"
        aria-label="18-week bye coverage"
        className="rounded-xl border border-white/[0.08] bg-[#16181d] p-4 space-y-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <h3 className="font-sans text-sm font-semibold text-zinc-100">
            Bye Schedule
          </h3>
          <span className="text-xs font-sans text-zinc-400">
            Select a week to preview lineup byes
          </span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 font-mono tabular-nums text-[10px] text-center">
          {byeSchedule.map((w) => {
            const isSelected = w.week === universeState.activeWeek;
            const cls =
              w.severity === 'cluster'
                ? 'bg-rose-950/50 border-rose-500/35 text-rose-200 font-semibold'
                : w.severity === 'normal'
                  ? 'bg-zinc-800/90 border-white/15 text-zinc-200'
                  : 'bg-zinc-900/60 border-white/[0.06] text-zinc-400';
            const names = w.players.map((p) => `${p.name} (${p.position})`).join(', ');
            return (
              <button
                type="button"
                key={w.week}
                onClick={() => setSelectedWeek(selectedWeek === w.week ? null : w.week)}
                data-testid={`bye-week-cell-${w.week}`}
                title={names ? `Week ${w.week} byes: ${names}` : `Week ${w.week}: No players on bye`}
                className={`py-1.5 px-1 rounded-md border text-center transition-colors cursor-pointer ${cls} ${
                  isSelected ? 'ring-1 ring-amber-400 border-amber-400/60 text-amber-200' : 'hover:border-white/25'
                }`}
              >
                <span className="block text-[9px] text-zinc-400">W{w.week}</span>
                <span className="block text-xs font-semibold">{w.players.length}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-sans text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <span>Weeks 5-14 NFL byes · Weeks 15-17 playoffs</span>
          <span>3+ same-week byes highlighted</span>
        </div>
      </section>

      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={myRoster}
        activeWeek={universeState.activeWeek}
      />
    </div>
  );
};

export default OneiromancyDashboard;
