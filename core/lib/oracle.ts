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

/**
 * Sleeper Point-Differential Lineup, Waiver, Trade & Matchup Engine.
 *
 * Every player surface displays three numbers in real fantasy points:
 * - Base:      Sleeper baseline projected points for the player's next game.
 * - Modifier:  Combined empirical point differential (+/- pts) across all 25
 *              pure esoteric predictive systems (194 discrete conditions)
 *              calibrated on 36,163 NFL regular-season games (2018-2026).
 * - Projected: Net forecast (Base + Modifier).
 *
 * Lineup checks, waiver moves, trade fits, and league standings rank players
 * and lineups by Base + Modifier (net projected points).
 */

import { isLocked } from './gameStatus';
import { hasNflWeekSchedule, teamGame } from './nflGames';
import {
  ALL_PREDICTOR_SYSTEM_IDS,
  calculateLoShuYearStar,
  CONDITION_EMPIRICAL_STATS,
  createPredictiveSystem,
  DEFAULT_CURATED_RIDGE_MODEL,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  evaluatePlayerPointDiff,
  extractOracularObservables,
  extractRosterDominantWuXing,
  extractUnitSynergy,
  formatSignedModifier,
  getMayanTzolkinKin,
  getPredictiveCategoriesWithSystems,
  getSexagenaryDayPillar,
  getZodiacFromDate,
  hasAuthoritativePlayerBirthDate,
  JOINT_RIDGE_MODEL,
  MODEL_PARAMETERS,
  normalizeNflTeamCode,
  PER_SYSTEM_RIDGE_MODELS,
  POINT_DIFF_STUDY_SUMMARY,
  POSITIONAL_RIDGE_MODELS,
  PREDICTOR_CATEGORIES,
  PREDICTOR_SYSTEM_META,
  predictPlayerGamePointDiff,
  resolvePlayerBirthDate,
  resolveTeamNextGame,
  TRAIN_SCREENED_RIDGE_MODEL,
  USABLE_SIGNAL_CATALOG,
  VALID_PREDICTOR_SYSTEM_IDS,
  WU_XING_PHASES,
  type ConditionEmpiricalStat,
  type CustomPredictiveSystemSpec,
  type MatchedConditionForecast,
  type MayanDirection,
  type PlayerPointDiffForecast,
  type PositionalModelBundle,
  type PositionalModelPosition,
  type PredictorCategoryId,
  type PredictorCategoryMeta,
  type PredictorSystemForecast,
  type PredictorSystemId,
  type PredictorSystemMeta,
  type RuntimePointDiffOptions,
  type RuntimePointDiffPrediction,
  type SerializedPointDiffModelParameters,
  type UsableEsotericSignal,
  type UsableSignalClass,
  type WuXingPhase,
} from './pointDiffEngine';
import type {
  CompetitorTeam,
  CosmicPlayer,
  ElementType,
  NFLPosition,
  RosterSlot,
} from '../types/oneiromancy';
import {
  calculateQuadBalanceBonus,
  calculateWesternTrinesBonus,
  clamp,
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_ORACLE_WEIGHTS,
  isNFLByeWeek,
  isPlayerOnByeWeek,
  isPlayerSigned,
  type HarmonyPart,
} from './scoring';
import { getSeasonContext } from './seasonContext';

export {
  ALL_PREDICTOR_SYSTEM_IDS,
  CONDITION_EMPIRICAL_STATS,
  createPredictiveSystem,
  DEFAULT_CHAOS_LAMBDA,
  DEFAULT_CURATED_RIDGE_MODEL,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  DEFAULT_ORACLE_WEIGHTS,
  evaluatePlayerPointDiff,
  formatSignedModifier,
  getPredictiveCategoriesWithSystems,
  JOINT_RIDGE_MODEL,
  MODEL_PARAMETERS,
  PER_SYSTEM_RIDGE_MODELS,
  POINT_DIFF_STUDY_SUMMARY,
  POSITIONAL_RIDGE_MODELS,
  PREDICTOR_CATEGORIES,
  PREDICTOR_SYSTEM_META,
  predictPlayerGamePointDiff,
  TRAIN_SCREENED_RIDGE_MODEL,
  USABLE_SIGNAL_CATALOG,
  VALID_PREDICTOR_SYSTEM_IDS,
  WU_XING_PHASES,
  type ConditionEmpiricalStat,
  type CustomPredictiveSystemSpec,
  type MatchedConditionForecast,
  type MayanDirection,
  type PlayerPointDiffForecast,
  type PositionalModelBundle,
  type PositionalModelPosition,
  type PredictorCategoryId,
  type PredictorCategoryMeta,
  type PredictorSystemForecast,
  type PredictorSystemId,
  type PredictorSystemMeta,
  type RuntimePointDiffOptions,
  type RuntimePointDiffPrediction,
  type SerializedPointDiffModelParameters,
  type UsableEsotericSignal,
  type UsableSignalClass,
  type WuXingPhase,
};

export const GITHUB_EMPIRICAL_STUDY_URL =
  'https://github.com/google/oneiromancy/blob/main/docs/SLEEPER_POINT_DIFF_ANALYSIS.md';

// ---------------------------------------------------------------------------
// Active Predictor System Selection & Pure Team-Unit Indexing
// ---------------------------------------------------------------------------

let activeEnabledSystems: readonly string[] = DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
let activeUnitByTeam: ReadonlyMap<string, CosmicPlayer[]> = new Map<string, CosmicPlayer[]>();
let activeUnitEpoch = 0;
let nextUnitMapStamp = 1;
const unitMapStamps = new WeakMap<ReadonlyMap<string, CosmicPlayer[]>, number>();

function getUnitMapStamp(map: ReadonlyMap<string, CosmicPlayer[]>): number {
  const existing = unitMapStamps.get(map);
  if (existing !== undefined) return existing;
  const assigned = nextUnitMapStamp++;
  unitMapStamps.set(map, assigned);
  return assigned;
}

/** Updates the fallback enabled predictor IDs for standalone non-UI callers. */
export function setActiveEnabledSystems(ids?: readonly string[] | null): void {
  if (!ids) {
    activeEnabledSystems = DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
    activeUnitEpoch += 1;
    return;
  }
  activeEnabledSystems = ids.filter((id) => VALID_PREDICTOR_SYSTEM_IDS.has(id));
  activeUnitEpoch += 1;
}

export function getActiveEnabledSystems(): readonly string[] {
  return activeEnabledSystems;
}

/**
 * Builds an immutable per-team map of up to 8 NFL skill starters from a board and roster pool.
 */
export function buildUnitMap(
  board: readonly CosmicPlayer[] = [],
  roster: readonly RosterSlot[] = [],
): ReadonlyMap<string, CosmicPlayer[]> {
  const byTeam = new Map<string, CosmicPlayer[]>();
  const seenByTeam = new Map<string, Set<string>>();

  const pushPlayer = (p?: CosmicPlayer | null): void => {
    if (!p || p.position === 'DEF' || p.position === 'K') return;
    const teamCode = normalizeNflTeamCode(p.team);
    if (!teamCode) return;
    let list = byTeam.get(teamCode);
    let seen = seenByTeam.get(teamCode);
    if (!list || !seen) {
      list = [];
      seen = new Set<string>();
      byTeam.set(teamCode, list);
      seenByTeam.set(teamCode, seen);
    }
    const key = String(p.id || p.name || '').toLowerCase();
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    list.push(p);
  };

  for (const s of roster) pushPlayer(s?.player);
  for (const p of board) pushPlayer(p);

  const compactUnits = new Map<string, CosmicPlayer[]>();
  byTeam.forEach((candidates, teamCode) => {
    const sorted = [...candidates].sort((a, b) => {
      const qbA =
        a.position === 'QB' && (a.depth_chart_order === 1 || !a.depth_chart_order) ? 400 : 0;
      const qbB =
        b.position === 'QB' && (b.depth_chart_order === 1 || !b.depth_chart_order) ? 400 : 0;
      const dA = a.depth_chart_order === 1 ? 120 : a.depth_chart_order === 2 ? 60 : 20;
      const dB = b.depth_chart_order === 1 ? 120 : b.depth_chart_order === 2 ? 60 : 20;
      return qbB + dB + statsPoints(b) - (qbA + dA + statsPoints(a));
    });
    const unit: CosmicPlayer[] = [];
    let qbIncluded = false;
    for (const c of sorted) {
      if (unit.length >= 8) break;
      if (c.position === 'QB') {
        if (qbIncluded) continue;
        qbIncluded = true;
      }
      unit.push(c);
    }
    compactUnits.set(teamCode, unit);
  });

  getUnitMapStamp(compactUnits);
  return compactUnits;
}

/**
 * Registers the current board/roster player pool for direct standalone callers.
 */
export function setActiveUnitPool(
  board: readonly CosmicPlayer[] = [],
  roster: readonly RosterSlot[] = [],
): void {
  activeUnitByTeam = buildUnitMap(board, roster);
  activeUnitEpoch += 1;
}

/** Resolves the up-to-8 skill starter unit for an NFL team code from a unit map. */
export function getActiveTeamUnit(
  team?: string | null,
  unitByTeam: ReadonlyMap<string, CosmicPlayer[]> = activeUnitByTeam,
): CosmicPlayer[] {
  const norm = normalizeNflTeamCode(team);
  if (!norm) return [];
  return unitByTeam.get(norm) || [];
}

/**
 * Returns the next NFL regular-season week w in [currentWeek + 1 .. 18] where
 * a bye-week team has a scheduled game. Returns null when not on bye in currentWeek.
 */
export function getNextPlayWeek(
  team?: string | null,
  currentWeek?: number | null,
  seasonByeWeeks?: Record<string, number> | null,
  playerByeWeek?: number | null,
): number | null {
  if (!team || typeof currentWeek !== 'number' || !Number.isFinite(currentWeek)) {
    return null;
  }
  const week = Math.trunc(currentWeek);
  if (week < 1) return null;

  const normalizedTeam = team.trim().toUpperCase();
  if (!normalizedTeam || !isPlayerSigned(normalizedTeam)) {
    return null;
  }
  if (!isPlayerOnByeWeek(week, playerByeWeek ?? undefined, normalizedTeam, seasonByeWeeks ?? undefined)) {
    return null;
  }

  for (let w = week + 1; w <= 18; w++) {
    if (hasNflWeekSchedule(w)) {
      if (teamGame(w, normalizedTeam) || teamGame(w, team)) {
        return w;
      }
      continue;
    }
    const byeForW =
      seasonByeWeeks?.[normalizedTeam] ?? seasonByeWeeks?.[team] ?? playerByeWeek ?? undefined;
    if (byeForW !== w) {
      return w;
    }
  }
  return null;
}

const STATUS_TEXT: Record<string, string> = {
  Out: 'out',
  IR: 'on injured reserve',
  PUP: 'on the PUP list',
  Sus: 'suspended',
  NA: 'not active',
  Questionable: 'questionable',
  Doubtful: 'doubtful',
};

/** Plain-English Sleeper injury status ("NA" -> "not active"). */
export function injuryStatusText(status?: string | null): string {
  const s = String(status ?? '');
  return STATUS_TEXT[s] ?? s.toLowerCase();
}

export const statusText = injuryStatusText;

export function statsPoints(p: Partial<CosmicPlayer> | null | undefined): number {
  if (!p) return 0;
  const n = Number(
    p.sleeper_projected_points ?? p.weekly_projected_points ?? p.projected_points ?? 0,
  );
  return Number.isFinite(n) ? n : 0;
}

export function averageProjectedPoints(p: Partial<CosmicPlayer> | null | undefined): number {
  if (!p) return 0;
  const avg = Number(p.average_projected_points);
  if (Number.isFinite(avg) && avg > 0) return Math.round(avg * 10) / 10;
  const base = Number(p.baseline_projected_points);
  if (Number.isFinite(base) && base > 0) return Math.round(base * 10) / 10;
  const season = Number(p.season_projected_points);
  if (Number.isFinite(season) && season > 0) return Math.round((season / 17) * 10) / 10;
  return 0;
}

export const INJURED_STATUSES = ['Out', 'IR', 'PUP', 'Doubtful', 'Sus', 'NA'] as const;

export function resolveContextWeek(currentWeek?: number): number | undefined {
  if (typeof currentWeek === 'number' && Number.isFinite(currentWeek) && currentWeek > 0) {
    return Math.trunc(currentWeek);
  }
  const seasonCtx = getSeasonContext();
  if (
    typeof seasonCtx?.currentWeek === 'number' &&
    Number.isFinite(seasonCtx.currentWeek) &&
    seasonCtx.currentWeek > 0
  ) {
    return Math.trunc(seasonCtx.currentWeek);
  }
  return undefined;
}

export function hasOraclePlaceholder(
  p: Partial<CosmicPlayer> | null | undefined,
  currentWeek?: number,
): boolean {
  if (!p) return false;
  const raw = statsPoints(p);
  if (raw > 0) return false;
  const avg = averageProjectedPoints(p);
  if (avg <= 0) return false;

  const week = resolveContextWeek(currentWeek);
  const isInjuredOrInactive = Boolean(
    (p.injury_status && (INJURED_STATUSES as readonly string[]).includes(p.injury_status)) ||
    p.status === 'Inactive' ||
    p.status === 'NA' ||
    p.injury_status === 'NA',
  );

  if (!week && !isInjuredOrInactive) {
    return false;
  }

  const seasonCtx = getSeasonContext();
  const onBye = week ? isPlayerOnByeWeek(week, p.bye_week, p.team, seasonCtx?.byeWeeks) : false;

  return onBye || isInjuredOrInactive;
}

export interface OraclePlaceholderInfo {
  hasPlaceholder: boolean;
  avgPoints: number;
  reason: string;
  tooltipText: string;
  statsTooltipText: string;
  markerExplainerText: string;
  statsMarkerExplainerText: string;
}

export function oraclePlaceholderInfo(
  p: Partial<CosmicPlayer> | null | undefined,
  currentWeek?: number,
): OraclePlaceholderInfo {
  if (!p || !hasOraclePlaceholder(p, currentWeek)) {
    return {
      hasPlaceholder: false,
      avgPoints: 0,
      reason: '',
      tooltipText: '',
      statsTooltipText: '',
      markerExplainerText: '',
      statsMarkerExplainerText: '',
    };
  }

  const avg = averageProjectedPoints(p);
  const week = resolveContextWeek(currentWeek);
  const seasonCtx = getSeasonContext();
  const onBye = week ? isPlayerOnByeWeek(week, p.bye_week, p.team, seasonCtx?.byeWeeks) : false;

  let reason = 'on bye';
  if (onBye) {
    reason = 'on bye';
  } else if (p.injury_status && (INJURED_STATUSES as readonly string[]).includes(p.injury_status)) {
    reason = injuryStatusText(p.injury_status);
  } else if (p.status === 'NA' || p.injury_status === 'NA') {
    reason = 'not active';
  } else if (p.status === 'Inactive') {
    reason = 'inactive';
  } else {
    reason = 'on bye or inactive';
  }

  const tooltipText = `Next-game baseline uses season average (${avg.toFixed(1)} pts) while ${reason}.`;
  const statsTooltipText = `0.0 pts (${reason}). Next-game baseline uses ${avg.toFixed(1)} pt season average.`;
  const markerExplainerText = `~ Next-game baseline: Weekly projection is 0.0 (${reason}), so the forecast uses the ${avg.toFixed(1)} pt season average instead of 0.0.`;
  const statsMarkerExplainerText = `~ Zero weekly stats (${reason}): 0.0 projected pts for this week (${avg.toFixed(1)} pt season average).`;

  return {
    hasPlaceholder: true,
    avgPoints: avg,
    reason,
    tooltipText,
    statsTooltipText,
    markerExplainerText,
    statsMarkerExplainerText,
  };
}

export function oracleEffectivePoints(
  p: Partial<CosmicPlayer> | null | undefined,
  currentWeek?: number,
  options?: { placeholder?: boolean },
): number {
  if (!p) return 0;
  const raw = statsPoints(p);
  if (options?.placeholder === false) {
    return raw;
  }
  if (raw > 0) {
    return raw;
  }
  if (hasOraclePlaceholder(p, currentWeek)) {
    const avg = averageProjectedPoints(p);
    return avg > 0 ? avg : raw;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Canonical Point-Differential Functions (Base + 25-System Modifier)
// ---------------------------------------------------------------------------

/** Explicit evaluation context threaded into oracle lineup, waiver, trade, and score helpers. */
export interface OracleEvalOptions {
  readonly currentWeek?: number;
  readonly placeholder?: boolean;
  readonly byeOnly?: boolean;
  readonly enabledSystems?: readonly string[];
  readonly unitByTeam?: ReadonlyMap<string, CosmicPlayer[]>;
}

export interface PlayerForecastOptions {
  readonly currentWeek?: number;
  readonly placeholder?: boolean;
  readonly nextGameLookahead?: boolean;
  readonly enabledSystems?: readonly string[];
  readonly useDefaultCurated?: boolean;
  readonly useTrainScreened?: boolean;
  readonly teamUnit?: readonly CosmicPlayer[];
  readonly opponentUnit?: readonly CosmicPlayer[];
  readonly unitByTeam?: ReadonlyMap<string, CosmicPlayer[]>;
}

const forecastMemo = new Map<string, PlayerPointDiffForecast>();

/**
 * Returns the player's Base projected points for their next game.
 */
export function basePoints(
  p: Partial<CosmicPlayer> | null | undefined,
  options?: { placeholder?: boolean; currentWeek?: number; nextGameLookahead?: boolean },
): number {
  if (!p) return 0;
  const week = resolveContextWeek(options?.currentWeek);
  const seasonCtx = getSeasonContext();
  const onBye = week ? isPlayerOnByeWeek(week, p.bye_week, p.team, seasonCtx?.byeWeeks) : false;

  if (onBye && options?.nextGameLookahead) {
    const lookahead = Number(p.next_week_projected_points);
    if (Number.isFinite(lookahead) && lookahead > 0) {
      return Math.round(lookahead * 100) / 100;
    }
    const avg = averageProjectedPoints(p);
    if (avg > 0) return avg;
  }

  return oracleEffectivePoints(p, week, { placeholder: options?.placeholder ?? false });
}

/**
 * Evaluates all 25 pure esoteric predictive systems for `player` and returns
 * the complete Base + Modifier forecast and historical condition breakdown.
 */
export function playerForecast(
  p: Partial<CosmicPlayer> | null | undefined,
  options?: PlayerForecastOptions,
): PlayerPointDiffForecast {
  if (!p) {
    return evaluatePlayerPointDiff({ id: '', name: 'Empty', position: 'WR', team: 'FA' }, { basePts: 0 });
  }

  const seasonCtx = getSeasonContext();
  const season = Number(seasonCtx?.season) || 2025;
  const rawWeek = resolveContextWeek(options?.currentWeek) ?? 2;
  const onBye = isPlayerOnByeWeek(rawWeek, p.bye_week, p.team, seasonCtx?.byeWeeks);
  const useLookahead = Boolean(options?.nextGameLookahead);

  const targetWeek =
    onBye && useLookahead
      ? (getNextPlayWeek(p.team, rawWeek, seasonCtx?.byeWeeks, p.bye_week) ??
          Math.min(18, rawWeek + 1))
      : rawWeek;

  const resolvedBase = basePoints(p, {
    currentWeek: rawWeek,
    placeholder: options?.placeholder ?? useLookahead,
    nextGameLookahead: useLookahead,
  });

  const enabled = options?.enabledSystems ?? activeEnabledSystems;
  const unitMap = options?.unitByTeam ?? activeUnitByTeam;
  const unitStamp = options?.unitByTeam ? `um${getUnitMapStamp(options.unitByTeam)}` : `ae${activeUnitEpoch}`;
  const useDefaultCurated = options?.useDefaultCurated;
  const useTrainScreened = Boolean(options?.useTrainScreened);
  const hasCustomUnits = Boolean(options?.teamUnit || options?.opponentUnit);

  const cacheKey = !hasCustomUnits
    ? `${unitStamp}|${season}|${targetWeek}|${onBye && !useLookahead && !options?.placeholder ? 'bye0' : 'act'}|${useDefaultCurated ? 'dc1' : 'dc0'}|${useTrainScreened ? 'ts1' : 'ts0'}|${p.id || p.name}|${p.team || ''}|${p.position || ''}|${p.birth_date || ''}|${p.jersey_number ?? ''}|${resolvedBase}|${enabled.join(',')}`
    : '';

  const cached = cacheKey ? forecastMemo.get(cacheKey) : undefined;
  if (cached) {
    return cached;
  }

  const normTeam = normalizeNflTeamCode(p.team);
  const nextGame = resolveTeamNextGame(normTeam, targetWeek, season);
  const teamUnit = options?.teamUnit ?? getActiveTeamUnit(normTeam, unitMap);
  const opponentUnit =
    options?.opponentUnit ?? (nextGame?.opponent ? getActiveTeamUnit(nextGame.opponent, unitMap) : []);

  const result = evaluatePlayerPointDiff(p, {
    basePts: resolvedBase,
    season,
    week: targetWeek,
    opponent: nextGame?.opponent ?? null,
    isHome: nextGame?.isHome ?? true,
    hostTeam: nextGame?.hostTeam ?? null,
    gameDate: nextGame?.gameDate ?? null,
    teamUnit,
    opponentUnit,
    enabledSystems: enabled,
    useDefaultCurated,
    useTrainScreened,
  });

  // If player is on bye in rawWeek and we are evaluating strictly for rawWeek (no lookahead/placeholder),
  // their active-week game modifier is 0.00 because they play no game in rawWeek.
  const finalResult: PlayerPointDiffForecast =
    onBye && !useLookahead && !options?.placeholder
      ? {
          ...result,
          basePts: 0,
          overallModifierPts: 0,
          adjustedPts: 0,
        }
      : result;

  if (cacheKey) {
    if (forecastMemo.size > 2500) forecastMemo.clear();
    forecastMemo.set(cacheKey, finalResult);
  }
  return finalResult;
}

/**
 * Returns the player's combined 25-system point differential (+/- pts).
 */
export function playerModifier(
  p: Partial<CosmicPlayer> | null | undefined,
  options?: PlayerForecastOptions,
): number {
  if (!p) return 0;
  return playerForecast(p, options).overallModifierPts;
}

/**
 * Returns `Base + Overall Modifier` (net projected points).
 */
export function projectedWithModifier(
  p: Partial<CosmicPlayer> | null | undefined,
  options?: PlayerForecastOptions,
): number {
  if (!p) return 0;
  return playerForecast(p, options).adjustedPts;
}

// Legacy function aliases retained for pure call-site compatibility, now returning
// pure point-differential metrics instead of 0-100 scores.
export function statsScore(
  p: Partial<CosmicPlayer> | null | undefined,
  options?: { placeholder?: boolean; currentWeek?: number },
): number {
  return basePoints(p, options);
}

export function starsScore(
  p: Partial<CosmicPlayer> | null | undefined,
  currentWeekOrOptions?: number | OracleEvalOptions,
): number {
  const options =
    typeof currentWeekOrOptions === 'number'
      ? { currentWeek: currentWeekOrOptions }
      : currentWeekOrOptions;
  return playerModifier(p, {
    currentWeek: options?.currentWeek,
    placeholder: options?.placeholder ?? true,
    nextGameLookahead: options?.placeholder !== false,
    enabledSystems: options?.enabledSystems,
    unitByTeam: options?.unitByTeam,
  });
}

export function oracleScore(
  p: Partial<CosmicPlayer> | null | undefined,
  _lambda?: number,
  options?: OracleEvalOptions,
): number {
  return projectedWithModifier(p, {
    placeholder: options?.placeholder ?? true,
    currentWeek: options?.currentWeek,
    nextGameLookahead: options?.placeholder !== false,
    enabledSystems: options?.enabledSystems,
    unitByTeam: options?.unitByTeam,
  });
}

export function currentWeekOracleScore(
  p: Partial<CosmicPlayer> | null | undefined,
  _lambda?: number,
  currentWeekOrOpts?: number | OracleEvalOptions,
): number {
  const opts =
    typeof currentWeekOrOpts === 'number'
      ? { currentWeek: currentWeekOrOpts }
      : currentWeekOrOpts;
  return projectedWithModifier(p, {
    placeholder: false,
    currentWeek: opts?.currentWeek,
    nextGameLookahead: false,
    enabledSystems: opts?.enabledSystems,
    unitByTeam: opts?.unitByTeam,
  });
}

export const MOCK_DEFAULT_ACTIVE_WEEK = 7;

export function resolveActiveWeek(
  draftState?: { isLive?: boolean; mode?: string; weekly_matchup?: { week?: number } } | null,
  overrideWeek?: number | null,
): number {
  if (typeof overrideWeek === 'number' && Number.isFinite(overrideWeek) && overrideWeek > 0) {
    return Math.trunc(overrideWeek);
  }
  const season = getSeasonContext();
  if (
    typeof season?.currentWeek === 'number' &&
    Number.isFinite(season.currentWeek) &&
    season.currentWeek > 0
  ) {
    return Math.trunc(season.currentWeek);
  }
  if (!draftState) {
    return 2;
  }
  const isMock = Boolean(!draftState.isLive && draftState.mode !== 'live');
  if (isMock && (draftState?.weekly_matchup?.week === 1 || !draftState?.weekly_matchup?.week)) {
    return MOCK_DEFAULT_ACTIVE_WEEK;
  }
  if (
    typeof draftState?.weekly_matchup?.week === 'number' &&
    Number.isFinite(draftState.weekly_matchup.week) &&
    draftState.weekly_matchup.week > 0
  ) {
    return Math.trunc(draftState.weekly_matchup.week);
  }
  return 2;
}

// ---------------------------------------------------------------------------
// Semantic Tone Scale for Signed Point Modifiers (+/- pts)
// ---------------------------------------------------------------------------

export type Tone = 'apex' | 'good' | 'neutral' | 'bad';

export function modifierTone(modPts: number): Tone {
  if (!Number.isFinite(modPts)) return 'neutral';
  if (modPts >= 0.25) return 'apex';
  if (modPts > 0.03) return 'good';
  if (modPts < -0.03) return 'bad';
  return 'neutral';
}

export function modifierTextColor(modPts: number): string {
  const tone = modifierTone(modPts);
  if (tone === 'apex' || tone === 'good') return 'text-emerald-300';
  if (tone === 'bad') return 'text-rose-300';
  return 'text-zinc-300';
}

export function favorabilityTone(scoreOrMod: number): Tone {
  return modifierTone(scoreOrMod);
}

export const TONE_LABEL: Record<Tone, string> = {
  apex: 'Strong positive modifier',
  good: 'Positive modifier',
  neutral: 'Neutral modifier',
  bad: 'Negative modifier',
};

export const TONE_PILL: Record<Tone, string> = {
  apex: 'bg-emerald-950/45 border-emerald-500/25 text-emerald-300',
  good: 'bg-emerald-950/35 border-emerald-500/20 text-emerald-300',
  neutral: 'bg-zinc-800/80 border-white/10 text-zinc-300',
  bad: 'bg-rose-950/45 border-rose-500/25 text-rose-300',
};

export const TONE_DOT: Record<Tone, string> = {
  apex: 'bg-emerald-300',
  good: 'bg-emerald-500',
  neutral: 'bg-amber-400',
  bad: 'bg-rose-400',
};

// ---------------------------------------------------------------------------
// Roster structure helpers
// ---------------------------------------------------------------------------

export function isStarterSlot(slot: RosterSlot): boolean {
  const id = String(slot.slot_id);
  return !id.startsWith('BN') && !id.startsWith('IR') && !id.startsWith('TAXI');
}

export function slotLabel(slot: RosterSlot): string {
  const id = String(slot.slot_id);
  if (id === 'SUPER_FLEX' || id === 'SUPERFLEX') return 'Superflex';
  if (id === 'FLEX') return 'Flex';
  return id.replace(/(\D+)(\d+)/, '$1$2');
}

function isSuperflexRoster(slots: readonly RosterSlot[]): boolean {
  return slots.some((s) => s.eligible_positions?.includes('QB') && s.eligible_positions.length > 1);
}

/** Minimum roster depth per position required before bench players become droppable or tradable. */
export function minimumDepth(slots: readonly RosterSlot[]): Partial<Record<NFLPosition, number>> {
  const dedicated: Partial<Record<NFLPosition, number>> = {};
  for (const s of slots.filter(isStarterSlot)) {
    if (s.eligible_positions?.length === 1) {
      const pos = s.eligible_positions[0];
      dedicated[pos] = (dedicated[pos] ?? 0) + 1;
    }
  }
  const depth: Partial<Record<NFLPosition, number>> = {};
  for (const [pos, n] of Object.entries(dedicated)) {
    depth[pos as NFLPosition] = (n ?? 0) + 1;
  }
  if (isSuperflexRoster(slots)) depth.QB = Math.max(depth.QB ?? 0, 3);
  return depth;
}

function countByPosition(players: readonly CosmicPlayer[]): Partial<Record<NFLPosition, number>> {
  const c: Partial<Record<NFLPosition, number>> = {};
  for (const p of players) c[p.position] = (c[p.position] ?? 0) + 1;
  return c;
}

// ---------------------------------------------------------------------------
// Lineup check (Ranked strictly by Base + Modifier in fantasy points)
// ---------------------------------------------------------------------------

export interface LineupSwap {
  slot: string;
  playerIn: CosmicPlayer;
  playerOut: CosmicPlayer | null;
  baseIn: number;
  baseOut: number;
  modifierIn: number;
  modifierOut: number;
  pointsGain: number;
  statsIn: number;
  statsOut: number;
  starsIn: number;
  starsOut: number;
  oracleGain: number;
  statsFavor: 'in' | 'out' | 'even';
  starsFavor: 'in' | 'out' | 'even';
  flipLambda: number | null;
  moved?: { player: CosmicPlayer; to: string } | null;
}

export function isUnavailable(p: Partial<CosmicPlayer> | null | undefined): boolean {
  if (!p) return false;
  return (
    (INJURED_STATUSES as readonly string[]).includes(String(p.injury_status ?? '')) ||
    p.status === 'Inactive' ||
    p.status === 'NA' ||
    p.injury_status === 'NA'
  );
}

export function optimalLineup(
  roster: readonly RosterSlot[],
  _lambda?: number,
  currentWeek?: number,
  options?: OracleEvalOptions,
): Map<string, CosmicPlayer | null> {
  const resolvedWeek = options?.currentWeek ?? currentWeek;
  const evalBase: OracleEvalOptions = {
    currentWeek: resolvedWeek,
    enabledSystems: options?.enabledSystems,
    unitByTeam: options?.unitByTeam,
  };
  const starters = roster.filter(isStarterSlot);
  const pool = roster
    .filter((s) => !(s.player && isLocked(s.player) && !isStarterSlot(s)))
    .map((s) => s.player)
    .filter((p): p is CosmicPlayer => Boolean(p));
  const used = new Set<string>();
  const best = new Map<string, CosmicPlayer | null>();
  for (const slot of starters) {
    if (slot.player && isLocked(slot.player)) {
      used.add(String(slot.player.id));
      best.set(String(slot.slot_id), slot.player);
    }
  }
  const order = [...starters]
    .filter((slot) => !best.has(String(slot.slot_id)))
    .sort((a, b) => (a.eligible_positions?.length ?? 9) - (b.eligible_positions?.length ?? 9));

  const scoreFn = (p: CosmicPlayer) => {
    if (isUnavailable(p)) return 0;
    if (options?.placeholder) {
      if (options?.byeOnly) {
        const week = resolveContextWeek(resolvedWeek);
        const seasonCtx = getSeasonContext();
        const onBye = week ? isPlayerOnByeWeek(week, p.bye_week, p.team, seasonCtx?.byeWeeks) : false;
        if (onBye && !isUnavailable(p)) {
          return projectedWithModifier(p, {
            ...evalBase,
            placeholder: true,
            nextGameLookahead: true,
          });
        }
        return currentWeekOracleScore(p, undefined, evalBase);
      }
      return projectedWithModifier(p, {
        ...evalBase,
        placeholder: true,
        nextGameLookahead: true,
      });
    }
    return currentWeekOracleScore(p, undefined, evalBase);
  };

  for (const slot of order) {
    const choice = pool
      .filter((p) => !used.has(String(p.id)) && slot.eligible_positions?.includes(p.position))
      .sort((a, b) => scoreFn(b) - scoreFn(a))[0];
    if (choice) used.add(String(choice.id));
    best.set(String(slot.slot_id), choice ?? null);
  }
  return best;
}

export function computeLineupCheck(
  roster: readonly RosterSlot[],
  _lambda?: number,
  currentWeek?: number,
  options?: OracleEvalOptions,
): LineupSwap[] {
  const resolvedWeek = options?.currentWeek ?? currentWeek;
  const evalOpts: OracleEvalOptions = {
    currentWeek: resolvedWeek,
    enabledSystems: options?.enabledSystems,
    unitByTeam: options?.unitByTeam,
  };
  const starters = roster.filter(isStarterSlot);
  const pool = roster.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p));
  if (starters.length === 0 || pool.length === 0) return [];

  const best = optimalLineup(roster, undefined, resolvedWeek, evalOpts);
  const used = new Set(
    Array.from(best.values())
      .filter((p): p is CosmicPlayer => Boolean(p))
      .map((p) => String(p.id)),
  );
  const slotOf = (id: string) =>
    starters.find((s) => {
      const p = best.get(String(s.slot_id));
      return Boolean(p && String(p.id) === id);
    });

  const currentIds = new Set(starters.map((s) => s.player && String(s.player.id)).filter(Boolean));
  const promoted = Array.from(used).filter((id) => !currentIds.has(id));
  const demotedSlots = starters.filter((s) => s.player && !used.has(String(s.player.id)));

  const swaps: LineupSwap[] = [];
  const takenOut = new Set<string>();
  for (const id of promoted) {
    const pIn = pool.find((p) => String(p.id) === id);
    if (!pIn) continue;
    const candidates = demotedSlots
      .filter(
        (s) =>
          s.player &&
          !takenOut.has(String(s.player.id)) &&
          s.eligible_positions?.includes(pIn.position),
      )
      .sort(
        (a, b) =>
          currentWeekOracleScore(a.player, undefined, evalOpts) -
          currentWeekOracleScore(b.player, undefined, evalOpts),
      );
    const directSlot = candidates[0];
    const outSlot =
      directSlot ?? demotedSlots.find((s) => s.player && !takenOut.has(String(s.player.id)));
    const pOut = outSlot?.player ?? null;
    if (pOut) takenOut.add(String(pOut.id));

    const inSlot = directSlot ? directSlot : slotOf(id);
    const shifted = !directSlot && inSlot?.player ? inSlot.player : null;
    const shiftedTo = shifted ? slotOf(String(shifted.id)) : undefined;

    const fIn = playerForecast(pIn, { ...evalOpts, placeholder: false, nextGameLookahead: false });
    const fOut = pOut
      ? playerForecast(pOut, { ...evalOpts, placeholder: false, nextGameLookahead: false })
      : { basePts: 0, overallModifierPts: 0, adjustedPts: 0 };

    const gain = fIn.adjustedPts - fOut.adjustedPts;
    if (gain < 0.25) continue;

    const favor = (d: number): 'in' | 'out' | 'even' =>
      Math.abs(d) < 0.05 ? 'even' : d > 0 ? 'in' : 'out';
    const roundedGain = Math.round(gain * 10) / 10;

    swaps.push({
      slot: inSlot ? slotLabel(inSlot) : outSlot ? slotLabel(outSlot) : 'Lineup',
      playerIn: pIn,
      playerOut: pOut,
      baseIn: fIn.basePts,
      baseOut: fOut.basePts,
      modifierIn: fIn.overallModifierPts,
      modifierOut: fOut.overallModifierPts,
      pointsGain: roundedGain,
      statsIn: fIn.basePts,
      statsOut: fOut.basePts,
      starsIn: fIn.overallModifierPts,
      starsOut: fOut.overallModifierPts,
      oracleGain: roundedGain,
      statsFavor: favor(fIn.basePts - fOut.basePts),
      starsFavor: favor(fIn.overallModifierPts - fOut.overallModifierPts),
      flipLambda: null,
      moved: shifted && shiftedTo ? { player: shifted, to: slotLabel(shiftedTo) } : null,
    });
  }
  return swaps.sort((a, b) => b.pointsGain - a.pointsGain);
}

// ---------------------------------------------------------------------------
// Waiver moves
// ---------------------------------------------------------------------------

export interface WaiverMove {
  add: CosmicPlayer;
  drop: CosmicPlayer;
  baseGain: number;
  modifierAdd: number;
  modifierDrop: number;
  pointsGain: number;
  statsGain: number;
  starsAdd: number;
  starsDrop: number;
  oracleGain: number;
  wouldStart: boolean;
  reason: string;
}

export function computeWaiverMoves(
  board: readonly CosmicPlayer[],
  roster: readonly RosterSlot[],
  _lambda?: number,
  currentWeek?: number,
  limit = 5,
  options?: OracleEvalOptions,
): WaiverMove[] {
  const resolvedWeek = options?.currentWeek ?? currentWeek;
  const evalOpts: OracleEvalOptions = {
    currentWeek: resolvedWeek,
    enabledSystems: options?.enabledSystems,
    unitByTeam: options?.unitByTeam,
  };
  const rosterPlayers = roster.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p));
  if (rosterPlayers.length === 0) return [];
  const rosterIds = new Set(rosterPlayers.map((p) => String(p.id)));
  const starterIds = new Set(
    roster
      .filter(isStarterSlot)
      .map((s) => s.player && String(s.player.id))
      .filter(Boolean) as string[],
  );
  for (const swap of computeLineupCheck(roster, undefined, resolvedWeek, evalOpts)) {
    starterIds.add(String(swap.playerIn.id));
  }
  const eligible = new Set(roster.flatMap((s) => s.eligible_positions ?? []));
  const depth = minimumDepth(roster);
  const counts = countByPosition(rosterPlayers);

  const rawDroppable = rosterPlayers
    .filter((p) => !starterIds.has(String(p.id)) && !isLocked(p))
    .filter(
      (p) =>
        !(
          resolvedWeek &&
          isPlayerOnByeWeek(resolvedWeek, p.bye_week, p.team, getSeasonContext()?.byeWeeks) &&
          !isUnavailable(p)
        ),
    )
    .filter((p) => (counts[p.position] ?? 0) > (depth[p.position] ?? 1));
  if (rawDroppable.length === 0) return [];

  const evalNext = (p: CosmicPlayer) =>
    playerForecast(p, { ...evalOpts, placeholder: true, nextGameLookahead: true });

  const dropForecasts = new Map(rawDroppable.map((d) => [String(d.id), evalNext(d)]));
  const droppable = [...rawDroppable].sort(
    (a, b) =>
      (dropForecasts.get(String(a.id))?.adjustedPts ?? 0) -
      (dropForecasts.get(String(b.id))?.adjustedPts ?? 0),
  );
  const unsignedDrops = droppable.filter((d) => !isPlayerSigned(d));
  const hasUnsignedDrop = unsignedDrops.length > 0;

  const best = optimalLineup(roster, undefined, resolvedWeek, evalOpts);
  const weakestStarterFor = (pos: NFLPosition): number => {
    const scores = roster
      .filter(isStarterSlot)
      .filter((s) => s.eligible_positions?.includes(pos))
      .map((s) => best.get(String(s.slot_id)))
      .filter((p): p is CosmicPlayer => Boolean(p))
      .map((p) => currentWeekOracleScore(p, undefined, evalOpts));
    return scores.length ? Math.min(...scores) : Infinity;
  };

  const available = board
    .filter((p) => p.draft_status === 'available' && !rosterIds.has(String(p.id)))
    .filter((p) => eligible.has(p.position) && !isUnavailable(p) && !isLocked(p))
    .map((p) => {
      const f = evalNext(p);
      return {
        p,
        forecast: f,
        currentNet: currentWeekOracleScore(p, undefined, evalOpts),
      };
    })
    .sort((a, b) => b.forecast.adjustedPts - a.forecast.adjustedPts);

  const signedCandidates = available.filter((c) => isPlayerSigned(c.p)).slice(0, 40);
  const unsignedCandidates = hasUnsignedDrop
    ? available.filter((c) => !isPlayerSigned(c.p)).slice(0, unsignedDrops.length)
    : [];
  const candidates = [...signedCandidates, ...unsignedCandidates].sort(
    (a, b) => b.forecast.adjustedPts - a.forecast.adjustedPts,
  );

  const moves: WaiverMove[] = [];
  const usedDrops = new Set<string>();

  for (const cand of candidates) {
    if (usedDrops.size >= droppable.length) break;
    const chosenDrop = isPlayerSigned(cand.p)
      ? droppable.find((d) => !usedDrops.has(String(d.id)))
      : unsignedDrops.find((d) => !usedDrops.has(String(d.id)));
    if (!chosenDrop) continue;

    const dropF = dropForecasts.get(String(chosenDrop.id)) ?? evalNext(chosenDrop);
    const gain = cand.forecast.adjustedPts - dropF.adjustedPts;
    if (gain <= 1.0) continue;

    const wouldStart = cand.currentNet > weakestStarterFor(cand.p.position);
    const isWeakest = String(chosenDrop.id) === String(droppable[0]?.id);
    const dropWhy = isUnavailable(chosenDrop)
      ? `${chosenDrop.name} is ${injuryStatusText(chosenDrop.injury_status)}`
      : statsPoints(chosenDrop) <= 0
        ? `${chosenDrop.name} has no active projection`
        : isWeakest
          ? `${chosenDrop.name} is your lowest-projected bench player`
          : !isPlayerSigned(chosenDrop)
            ? `${chosenDrop.name} is unsigned`
            : `${chosenDrop.name} is droppable bench depth`;

    const roundedGain = Math.round(gain * 10) / 10;
    const baseDelta = Math.round((cand.forecast.basePts - dropF.basePts) * 10) / 10;

    moves.push({
      add: cand.p,
      drop: chosenDrop,
      baseGain: baseDelta,
      modifierAdd: cand.forecast.overallModifierPts,
      modifierDrop: dropF.overallModifierPts,
      pointsGain: roundedGain,
      statsGain: baseDelta,
      starsAdd: cand.forecast.overallModifierPts,
      starsDrop: dropF.overallModifierPts,
      oracleGain: roundedGain,
      wouldStart,
      reason: `${dropWhy}. ${cand.p.name} ${wouldStart ? 'would start for you' : 'upgrades bench depth'} at ${cand.p.position}.`,
    });
    usedDrops.add(String(chosenDrop.id));
  }

  return moves
    .sort((a, b) => Number(b.wouldStart) - Number(a.wouldStart) || b.pointsGain - a.pointsGain)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Bye outlook & 18-Week Bye Coverage
// ---------------------------------------------------------------------------

export interface ByeWeekAlert {
  week: number;
  starters: CosmicPlayer[];
  bench: CosmicPlayer[];
}

export function computeByeOutlook(
  roster: RosterSlot[],
  fromWeek: number,
  weeksAhead = 3,
): ByeWeekAlert[] {
  const alerts: ByeWeekAlert[] = [];
  const season = getSeasonContext();
  for (let w = fromWeek + 1; w <= fromWeek + weeksAhead; w++) {
    if (!isNFLByeWeek(w)) continue;
    const starters = roster
      .filter(isStarterSlot)
      .map((s) => s.player)
      .filter((p): p is CosmicPlayer =>
        Boolean(p && isPlayerOnByeWeek(w, p.bye_week, p.team, season?.byeWeeks)),
      );
    const bench = roster
      .filter((s) => !isStarterSlot(s))
      .map((s) => s.player)
      .filter((p): p is CosmicPlayer =>
        Boolean(p && isPlayerOnByeWeek(w, p.bye_week, p.team, season?.byeWeeks)),
      );
    if (starters.length > 0) alerts.push({ week: w, starters, bench });
  }
  return alerts;
}

export interface ByeWeekSlot {
  week: number;
  players: CosmicPlayer[];
  starters: CosmicPlayer[];
  bench: CosmicPlayer[];
  severity: 'none' | 'normal' | 'cluster';
}

export function compute18WeekByeCoverage(roster: RosterSlot[]): ByeWeekSlot[] {
  const starterPlayers = roster
    .filter(isStarterSlot)
    .map((s) => s.player)
    .filter((p): p is CosmicPlayer => Boolean(p));
  const benchPlayers = roster
    .filter((s) => String(s.slot_id).startsWith('BN'))
    .map((s) => s.player)
    .filter((p): p is CosmicPlayer => Boolean(p));
  const season = getSeasonContext();
  const out: ByeWeekSlot[] = [];
  for (let week = 1; week <= 18; week++) {
    const isByeWk = isNFLByeWeek(week);
    const starters = isByeWk
      ? starterPlayers.filter((p) =>
          isPlayerOnByeWeek(week, p.bye_week, p.team, season?.byeWeeks),
        )
      : [];
    const bench = isByeWk
      ? benchPlayers.filter((p) =>
          isPlayerOnByeWeek(week, p.bye_week, p.team, season?.byeWeeks),
        )
      : [];
    const players = [...starters, ...bench];
    const severity =
      players.length >= 3 ? 'cluster' : players.length >= 1 ? 'normal' : 'none';
    out.push({ week, players, starters, bench, severity });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trade partners (Ranked strictly by Base + Modifier starter upgrades)
// ---------------------------------------------------------------------------

export interface TradePiece {
  player: CosmicPlayer;
  replaces: CosmicPlayer;
  gain: number;
}

export function describeValue(
  p: CosmicPlayer,
  _lambda?: number,
  opts?: OracleEvalOptions,
): string {
  const f = playerForecast(p, {
    currentWeek: opts?.currentWeek,
    enabledSystems: opts?.enabledSystems,
    unitByTeam: opts?.unitByTeam,
    placeholder: true,
    nextGameLookahead: true,
  });
  return `Base ${f.basePts.toFixed(1)} pts (${formatSignedModifier(f.overallModifierPts)} mod)`;
}

export interface TradePartner {
  team: CompetitorTeam;
  give: TradePiece | null;
  get: TradePiece | null;
  theyNeed: NFLPosition[];
  theyHaveSurplus: NFLPosition[];
  youCanOffer: NFLPosition[];
  counts: Partial<Record<NFLPosition, number>>;
  summary: string;
  score: number;
}

const POS_ORDER: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function bestUpgrade(
  fromBench: readonly CosmicPlayer[],
  toStarters: readonly CosmicPlayer[],
  canGive: (p: CosmicPlayer) => boolean,
  opts?: OracleEvalOptions,
): TradePiece | null {
  let best: TradePiece | null = null;
  const val = (p: CosmicPlayer) =>
    projectedWithModifier(p, {
      currentWeek: opts?.currentWeek,
      enabledSystems: opts?.enabledSystems,
      unitByTeam: opts?.unitByTeam,
      placeholder: true,
      nextGameLookahead: true,
    });
  for (const p of fromBench) {
    if (!canGive(p) || isUnavailable(p)) continue;
    const sameSpot = toStarters.filter((s) => s.position === p.position);
    if (sameSpot.length === 0) continue;
    const weakest = sameSpot.reduce((w, s) => (val(s) < val(w) ? s : w));
    const gain = val(p) - val(weakest);
    if (gain >= 0.4 && (!best || gain > best.gain)) {
      best = { player: p, replaces: weakest, gain: Math.round(gain * 10) / 10 };
    }
  }
  return best;
}

export function computeTradePartners(
  teams: readonly CompetitorTeam[],
  board: readonly CosmicPlayer[],
  roster: readonly RosterSlot[],
  _lambda?: number,
  opts?: OracleEvalOptions,
): TradePartner[] {
  const byId = new Map(board.map((p) => [String(p.id), p]));
  const depth = minimumDepth(roster);
  const me = teams.find((t) => t.is_user);
  if (!me) return [];
  const resolve = (ids?: string[] | null) =>
    (ids ?? []).map((id) => byId.get(String(id))).filter((p): p is CosmicPlayer => Boolean(p));
  const split = (t: CompetitorTeam) => {
    const all = resolve(t.players);
    const starterIds = new Set((t.starters ?? []).map(String));
    return {
      all,
      starters: all.filter((p) => starterIds.has(String(p.id))),
      bench: all.filter((p) => !starterIds.has(String(p.id))),
    };
  };
  const currentWeek = resolveContextWeek(opts?.currentWeek);
  const evalOpts: OracleEvalOptions = {
    currentWeek,
    enabledSystems: opts?.enabledSystems,
    unitByTeam: opts?.unitByTeam,
  };
  const bestIds = new Set(
    Array.from(
      optimalLineup(roster, undefined, currentWeek, {
        ...evalOpts,
        placeholder: true,
        byeOnly: true,
      }).values(),
    )
      .filter((p): p is CosmicPlayer => Boolean(p))
      .map((p) => String(p.id)),
  );
  const current = split(me);
  const mine = bestIds.size
    ? {
        all: current.all,
        starters: current.all.filter((p) => bestIds.has(String(p.id))),
        bench: current.all.filter((p) => !bestIds.has(String(p.id))),
      }
    : current;
  const myCounts = countByPosition(mine.all);
  const mySurplus = POS_ORDER.filter((pos) => (myCounts[pos] ?? 0) > (depth[pos] ?? 99));
  const isSuperflex = isSuperflexRoster(roster);
  const canGiveMine = (p: CosmicPlayer) => (myCounts[p.position] ?? 0) > (depth[p.position] ?? 1);

  const partners: TradePartner[] = [];
  for (const t of teams) {
    if (t.is_user) continue;
    const theirs = split(t);
    const counts = countByPosition(theirs.all);
    const theyNeed = POS_ORDER.filter(
      (pos) => depth[pos] !== undefined && (counts[pos] ?? 0) < (depth[pos] ?? 0),
    );
    const theyHaveSurplus = POS_ORDER.filter(
      (pos) => (counts[pos] ?? 0) > (depth[pos] ?? 99) + 1,
    );
    const youCanOffer = theyNeed.filter((pos) => mySurplus.includes(pos));
    const theirCanGive = (p: CosmicPlayer) => (counts[p.position] ?? 0) > (depth[p.position] ?? 1);

    const give = bestUpgrade(mine.bench, theirs.starters, canGiveMine, evalOpts);
    const get = bestUpgrade(theirs.bench, mine.starters, theirCanGive, evalOpts);
    if (!(give && get) && youCanOffer.length === 0) continue;

    const name = t.name.replace(/\s*\(You\)$/, '');
    const parts: string[] = [];
    if (give) {
      parts.push(
        `${name} starts ${give.replaces.name}, ${describeValue(give.replaces, undefined, evalOpts)}, at ${give.player.position}; your bench ${give.player.name} projects ${describeValue(give.player, undefined, evalOpts)}.`,
      );
    }
    if (get) {
      parts.push(
        `Their bench ${get.player.name}, ${describeValue(get.player, undefined, evalOpts)}, projects ahead of your ${get.replaces.name}, ${describeValue(get.replaces, undefined, evalOpts)}.`,
      );
    }
    if (youCanOffer.length) {
      parts.push(
        `They roster only ${youCanOffer
          .map(
            (pos) =>
              `${counts[pos] ?? 0} ${pos}${(counts[pos] ?? 0) === 1 ? '' : 's'}${pos === 'QB' && isSuperflex ? ' in a superflex league' : ''}`,
          )
          .join(' and ')}.`,
      );
    }
    partners.push({
      team: t,
      give,
      get,
      theyNeed,
      theyHaveSurplus,
      youCanOffer,
      counts,
      summary: parts.join(' '),
      score: (give?.gain ?? 0) + (get?.gain ?? 0) + youCanOffer.length * 2,
    });
  }
  return partners.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Derived elemental & team stack text
// ---------------------------------------------------------------------------

/** Counts classical four-element representation across a player list. */
export function elementMix(players: readonly CosmicPlayer[]): Record<ElementType, number> {
  const mix: Record<ElementType, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  for (const p of players) {
    const el = p.elemental_traits?.element;
    if (el) mix[el] += 1;
  }
  return mix;
}

/** Formats the top one or two classical elements represented in a player list. */
export function dominantElements(players: readonly CosmicPlayer[]): string {
  const mix = elementMix(players);
  const top = (Object.entries(mix) as [ElementType, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([el]) => el);
  return top.length ? top.join(' & ') : '-';
}

export function elementRelation(
  a?: ElementType,
  b?: ElementType,
): 'Same element' | 'Complementary' | 'Opposed' | '-' {
  if (!a || !b) return '-';
  if (a === b) return 'Same element';
  const pair = [a, b].sort().join('/');
  if (pair === 'Air/Fire' || pair === 'Earth/Water') return 'Complementary';
  return 'Opposed';
}

/** Formats active same-team QB + WR/TE stack labels across a player list. */
export function teamStacks(players: readonly CosmicPlayer[]): string[] {
  const out: string[] = [];
  const byTeam = new Map<string, CosmicPlayer[]>();
  for (const p of players) {
    if (!p.team) continue;
    let list = byTeam.get(p.team);
    if (!list) {
      list = [];
      byTeam.set(p.team, list);
    }
    list.push(p);
  }
  byTeam.forEach((ps, team) => {
    const qb = ps.find((p) => p.position === 'QB');
    const catchers = ps.filter((p) => p.position === 'WR' || p.position === 'TE');
    if (qb && catchers.length) {
      out.push(`${team}: ${qb.name} + ${catchers.map((c) => c.name).join(' & ')}`);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Team lineup projections (League): Base Total + Modifier Total = Net Total
// ---------------------------------------------------------------------------

export interface TeamOracle {
  team: CompetitorTeam;
  baseTotal: number;
  modifierTotal: number;
  projectedTotal: number;
  oracle: number;
  stars: number;
  points: number;
  starters: CosmicPlayer[];
  best: CosmicPlayer | null;
  worst: CosmicPlayer | null;
}

export function computeTeamOracles(
  teams: readonly CompetitorTeam[],
  board: readonly CosmicPlayer[],
  _lambda?: number,
  opts?: OracleEvalOptions,
): TeamOracle[] {
  const byId = new Map(board.map((p) => [String(p.id), p]));
  const out: TeamOracle[] = [];
  for (const team of teams) {
    const starters = (team.starters ?? [])
      .map((id) => byId.get(String(id)))
      .filter((p): p is CosmicPlayer => Boolean(p));
    if (starters.length === 0) continue;

    let baseSum = 0;
    let modSum = 0;
    for (const p of starters) {
      const f = playerForecast(p, {
        currentWeek: opts?.currentWeek,
        enabledSystems: opts?.enabledSystems,
        unitByTeam: opts?.unitByTeam,
        placeholder: false,
        nextGameLookahead: false,
      });
      baseSum += Number(f.basePts.toFixed(1));
      modSum += f.overallModifierPts;
    }
    const baseTotal = Math.round(baseSum * 10) / 10;
    const modifierTotal = Math.round(modSum * 100) / 100;
    const projectedTotal = Math.round((baseSum + modSum) * 10) / 10;

    const ranked = [...starters].sort(
      (a, b) =>
        currentWeekOracleScore(b, undefined, opts) -
        currentWeekOracleScore(a, undefined, opts),
    );
    out.push({
      team,
      baseTotal,
      modifierTotal,
      projectedTotal,
      oracle: projectedTotal,
      stars: modifierTotal,
      points: baseTotal,
      starters,
      best: ranked[0] ?? null,
      worst: ranked[ranked.length - 1] ?? null,
    });
  }
  return out.sort((a, b) => b.projectedTotal - a.projectedTotal);
}

// ---------------------------------------------------------------------------
// Player & Real NFL Team Elemental + Wu Xing Balance
// ---------------------------------------------------------------------------

export interface NFLTeamStackInfo {
  team: string;
  qb: CosmicPlayer;
  passCatchers: CosmicPlayer[];
  involvesPlayer: boolean;
}

export interface UnitMemberElementalProfile {
  player: CosmicPlayer;
  zodiacElement: ElementType | null;
  zodiacSign: string | null;
  arcanaElement: ElementType | null;
  arcanaCard: string | null;
  wuXingPhase: WuXingPhase | null;
  dayStem: string | null;
  loShuPhase: WuXingPhase | null;
  loShuStar: number | null;
  loShuGroup: 'EAST' | 'WEST' | null;
  mayanDirection: MayanDirection | null;
  mayanColor: 'Red' | 'White' | 'Black' | 'Yellow' | null;
  mayanNahual: string | null;
}

export interface PlayerTeamElementalBalance {
  teamCode: string;
  isFreeAgent: boolean;
  unitPlayers: CosmicPlayer[];
  teammates: CosmicPlayer[];
  unitMemberProfiles: UnitMemberElementalProfile[];
  playerProfile: UnitMemberElementalProfile;
  playerElement: ElementType | null;
  dominantElement: ElementType | null;
  dominantArcanaElement: ElementType | null;
  dominantCombinedFourElement: ElementType | null;
  dominantWuXing: WuXingPhase | null;
  dominantCombinedFivePhase: WuXingPhase | null;
  dominantMayanDirection: MayanDirection | null;
  elementalDistribution: Record<ElementType, number>;
  arcanaDistribution: Record<ElementType, number>;
  combinedFourElementDistribution: Record<ElementType, number>;
  wuXingDistribution: Record<WuXingPhase, number>;
  loShuPhaseDistribution: Record<WuXingPhase, number>;
  combinedFivePhaseDistribution: Record<WuXingPhase, number>;
  loShuGroupCounts: { EAST: number; WEST: number };
  mayanDirectionDistribution: Record<MayanDirection, number>;
  pairwiseCohesion: number;
  hasHighUnitSynergy: boolean;
  harmonyScore: number;
  parts: HarmonyPart[];
  activeStacks: NFLTeamStackInfo[];
  stackSummary: string;
  fourElementRadarNorms: {
    zodiac: readonly number[];
    arcana: readonly number[];
  };
  fivePhaseRadarNorms: {
    bazi: readonly number[];
    loShu: readonly number[];
  };
}

function shortSurname(p: CosmicPlayer): string {
  if (p.last_name && p.last_name.trim()) return p.last_name.trim();
  const parts = String(p.name || '').trim().split(/\s+/);
  return parts[parts.length - 1] || p.name || 'Player';
}

function buildMemberElementalProfile(
  u: CosmicPlayer,
  seasonYear: number,
): UnitMemberElementalProfile {
  const authoritative = hasAuthoritativePlayerBirthDate(u);
  const bd = resolvePlayerBirthDate(u);
  const z = bd ? getZodiacFromDate(bd) : null;
  const arcana = bd ? extractOracularObservables(bd, seasonYear, 1) : null;
  const dp = bd ? getSexagenaryDayPillar(bd) : null;
  const loShu = bd ? calculateLoShuYearStar(bd) : null;
  const mayan = bd ? getMayanTzolkinKin(bd) : null;
  return {
    player: u,
    zodiacElement: authoritative
      ? (z?.element ?? u.elemental_traits?.element ?? null)
      : (u.elemental_traits?.element ?? z?.element ?? null),
    zodiacSign: authoritative
      ? (z?.sign ?? u.elemental_traits?.sun_sign ?? null)
      : (u.elemental_traits?.sun_sign ?? z?.sign ?? null),
    arcanaElement: arcana?.tarotElement ?? null,
    arcanaCard: arcana?.tarotName ?? u.elemental_traits?.tarot_card ?? null,
    wuXingPhase: dp?.stem.phase ?? null,
    dayStem: dp?.stem.name ?? null,
    loShuPhase: loShu?.phase ?? null,
    loShuStar: loShu?.star ?? null,
    loShuGroup: loShu?.group ?? null,
    mayanDirection: mayan?.direction ?? null,
    mayanColor: mayan?.color ?? null,
    mayanNahual: mayan?.nahualName ?? null,
  };
}

export function computePlayerTeamElementalBalance(
  player: CosmicPlayer,
  teamPool: readonly CosmicPlayer[] = [],
): PlayerTeamElementalBalance {
  const rawTeam = String(player.team || '').trim().toUpperCase();
  const isFreeAgent = !isPlayerSigned(rawTeam);
  const teamCode = isFreeAgent ? 'FA' : rawTeam;

  const normName = (n?: string | null): string =>
    String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const candidates: CosmicPlayer[] = [];

  const pushUnique = (cand?: CosmicPlayer | null) => {
    if (!cand) return;
    if (!isFreeAgent && String(cand.team || '').trim().toUpperCase() !== teamCode) return;
    const isSelf = String(cand.id) === String(player.id);
    if (!isSelf && (cand.position === 'DEF' || cand.position === 'K')) return;
    const pid = String(cand.id || '').trim();
    const pname = normName(cand.name);
    if ((pid && seenIds.has(pid)) || (pname && seenNames.has(pname))) return;
    if (pid) seenIds.add(pid);
    if (pname) seenNames.add(pname);
    candidates.push(cand);
  };

  pushUnique(player);
  if (!isFreeAgent) {
    for (const c of teamPool) {
      pushUnique(c);
    }
  }

  const playerIdStr = String(player.id);
  const rankCandidate = (p: CosmicPlayer): number => {
    if (String(p.id) === playerIdStr) return 1_000_000;
    const qbBoost =
      p.position === 'QB' && (p.depth_chart_order === 1 || !p.depth_chart_order) ? 500 : 0;
    const depthBoost = p.depth_chart_order === 1 ? 200 : p.depth_chart_order === 2 ? 80 : 40;
    return qbBoost + depthBoost + statsPoints(p);
  };

  const sortedCandidates = [...candidates].sort((a, b) => rankCandidate(b) - rankCandidate(a));
  const unitPlayers: CosmicPlayer[] = [];
  let nonAnchorQbIncluded = false;
  for (const cand of sortedCandidates) {
    if (unitPlayers.length >= 8) break;
    const isSelf = String(cand.id) === playerIdStr;
    if (cand.position === 'QB' && !isSelf) {
      if (nonAnchorQbIncluded) continue;
      nonAnchorQbIncluded = true;
    }
    unitPlayers.push(cand);
  }
  const teammates = unitPlayers.filter((u) => String(u.id) !== playerIdStr);

  const seasonYear = Number(getSeasonContext()?.season) || 2025;
  const unitMemberProfiles = unitPlayers.map((u) => buildMemberElementalProfile(u, seasonYear));
  const playerProfile =
    unitMemberProfiles.find((m) => String(m.player.id) === playerIdStr) ??
    buildMemberElementalProfile(player, seasonYear);

  const unitInputs = unitMemberProfiles.map((m) => ({
    id: String(m.player.id),
    name: m.player.name,
    position: m.player.position,
    team: m.player.team,
    birthDate: resolvePlayerBirthDate(m.player),
    element: m.zodiacElement,
  }));

  const unitSynergy = extractUnitSynergy(unitInputs);
  const unitWuXing = extractRosterDominantWuXing(unitInputs);

  const elementalDistribution = unitSynergy.elementCounts;
  const arcanaDistribution: Record<ElementType, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const combinedFourElementDistribution: Record<ElementType, number> = {
    Fire: elementalDistribution.Fire,
    Earth: elementalDistribution.Earth,
    Air: elementalDistribution.Air,
    Water: elementalDistribution.Water,
  };
  const loShuPhaseDistribution: Record<WuXingPhase, number> = {
    Wood: 0,
    Fire: 0,
    Earth: 0,
    Metal: 0,
    Water: 0,
  };
  const combinedFivePhaseDistribution: Record<WuXingPhase, number> = {
    Wood: unitWuXing.counts.Wood,
    Fire: unitWuXing.counts.Fire,
    Earth: unitWuXing.counts.Earth,
    Metal: unitWuXing.counts.Metal,
    Water: unitWuXing.counts.Water,
  };
  const loShuGroupCounts = { EAST: 0, WEST: 0 };
  const mayanDirectionDistribution: Record<MayanDirection, number> = {
    East: 0,
    North: 0,
    West: 0,
    South: 0,
  };

  for (const m of unitMemberProfiles) {
    if (m.player.position === 'DEF') continue;
    if (m.arcanaElement) {
      arcanaDistribution[m.arcanaElement] += 1;
      combinedFourElementDistribution[m.arcanaElement] += 1;
    }
    if (m.loShuPhase) {
      loShuPhaseDistribution[m.loShuPhase] += 1;
      combinedFivePhaseDistribution[m.loShuPhase] += 1;
    }
    if (m.loShuGroup === 'EAST') loShuGroupCounts.EAST += 1;
    else if (m.loShuGroup === 'WEST') loShuGroupCounts.WEST += 1;
    if (m.mayanDirection) {
      mayanDirectionDistribution[m.mayanDirection] += 1;
    }
  }

  const pickTopKey = <K extends string>(
    counts: Record<K, number>,
    keys: readonly K[],
  ): K | null => {
    let best: K | null = null;
    let bestVal = 0;
    for (const k of keys) {
      if (counts[k] > bestVal) {
        bestVal = counts[k];
        best = k;
      }
    }
    return bestVal > 0 ? best : null;
  };

  const fourKeys: readonly ElementType[] = ['Fire', 'Earth', 'Air', 'Water'];
  const mayanKeys: readonly MayanDirection[] = ['East', 'North', 'West', 'South'];
  const dominantArcanaElement = pickTopKey(arcanaDistribution, fourKeys);
  const dominantCombinedFourElement = pickTopKey(combinedFourElementDistribution, fourKeys);
  const dominantCombinedFivePhase = pickTopKey(combinedFivePhaseDistribution, WU_XING_PHASES);
  const dominantMayanDirection = pickTopKey(mayanDirectionDistribution, mayanKeys);

  const playerElement: ElementType | null = playerProfile.zodiacElement;

  const activeStacks: NFLTeamStackInfo[] = [];
  let primaryQb: CosmicPlayer | null = null;
  let primaryQbId: string | null = null;
  let primaryPassCatchers: CosmicPlayer[] = [];
  if (!isFreeAgent) {
    const qbs = unitPlayers.filter((u) => u.position === 'QB');
    primaryQb = qbs.find((q) => String(q.id) !== playerIdStr) ?? qbs[0] ?? null;
    if (primaryQb) {
      primaryQbId = String(primaryQb.id);
      primaryPassCatchers = unitPlayers.filter(
        (u) =>
          (u.position === 'WR' || u.position === 'TE') &&
          String(u.id) !== primaryQbId,
      );
      for (const pc of primaryPassCatchers) {
        activeStacks.push({
          team: teamCode,
          qb: primaryQb,
          passCatchers: [pc],
          involvesPlayer:
            primaryQbId === playerIdStr || String(pc.id) === playerIdStr,
        });
      }
    }
  }

  const parts: HarmonyPart[] = [{ label: 'Base', points: 50 }];
  let rawHarmony = 50;
  if (!isFreeAgent && teammates.length > 0) {
    const trineBonus = calculateWesternTrinesBonus(elementalDistribution);
    if (trineBonus > 0) {
      rawHarmony += trineBonus;
      parts.push({ label: 'Western Trine', points: trineBonus });
    }
    const quadBonus = calculateQuadBalanceBonus(elementalDistribution);
    if (quadBonus > 0) {
      rawHarmony += quadBonus;
      parts.push({ label: 'All 4 elements', points: quadBonus });
    }
    const involvesPrimaryStack = activeStacks.some((s) => s.involvesPlayer);
    if (involvesPrimaryStack) {
      rawHarmony += 14;
      parts.push({ label: 'QB stack', points: 14 });
    }
    if (primaryQb && primaryQbId !== playerIdStr && playerElement) {
      const qbProfile = unitMemberProfiles.find(
        (m) => String(m.player.id) === primaryQbId,
      );
      const qbEl = qbProfile?.zodiacElement ?? primaryQb.elemental_traits?.element ?? null;
      const rel = elementRelation(playerElement, qbEl ?? undefined);
      if (rel === 'Same element' || rel === 'Complementary') {
        const fitPts = rel === 'Same element' ? 8 : 6;
        rawHarmony += fitPts;
        parts.push({ label: 'QB elemental fit', points: fitPts });
      }
    }
  }
  const harmonyScore = Math.round(clamp(rawHarmony, 0, 100));

  const stackSummary = isFreeAgent
    ? 'Unsigned free agent · no active NFL team corps'
    : primaryQb && primaryPassCatchers.length > 0
      ? `${teamCode} stack: ${shortSurname(primaryQb)} + ${primaryPassCatchers
          .slice(0, 4)
          .map(shortSurname)
          .join(', ')}`
      : `${teamCode} skill unit (${unitPlayers.length} players)`;

  const denom = Math.max(4, Math.ceil(unitPlayers.length / 2));
  const scaleElem = (count: number) => 0.15 + Math.min(1, count / denom) * 0.85;
  const stackNorm = Math.min(1.0, Math.max(0.2, (activeStacks.length / 4) * 0.8 + 0.2));
  const zodiacNorms = [
    scaleElem(elementalDistribution.Fire),
    scaleElem(elementalDistribution.Air),
    scaleElem(elementalDistribution.Water),
    scaleElem(elementalDistribution.Earth),
    stackNorm,
  ];
  const arcanaNorms = [
    scaleElem(arcanaDistribution.Fire),
    scaleElem(arcanaDistribution.Air),
    scaleElem(arcanaDistribution.Water),
    scaleElem(arcanaDistribution.Earth),
    stackNorm,
  ];
  const baziNorms = WU_XING_PHASES.map((ph) => scaleElem(unitWuXing.counts[ph]));
  const loShuNorms = WU_XING_PHASES.map((ph) => scaleElem(loShuPhaseDistribution[ph]));

  return {
    teamCode,
    isFreeAgent,
    unitPlayers,
    teammates,
    unitMemberProfiles,
    playerProfile,
    playerElement,
    dominantElement: unitSynergy.dominantElement,
    dominantArcanaElement,
    dominantCombinedFourElement,
    dominantWuXing: unitWuXing.dominantWuXing,
    dominantCombinedFivePhase,
    dominantMayanDirection,
    elementalDistribution,
    arcanaDistribution,
    combinedFourElementDistribution,
    wuXingDistribution: unitWuXing.counts,
    loShuPhaseDistribution,
    combinedFivePhaseDistribution,
    loShuGroupCounts,
    mayanDirectionDistribution,
    pairwiseCohesion: unitSynergy.pairwiseElementCohesion,
    hasHighUnitSynergy: unitSynergy.hasHighUnitSynergy,
    harmonyScore,
    parts,
    activeStacks,
    stackSummary,
    fourElementRadarNorms: {
      zodiac: zodiacNorms,
      arcana: arcanaNorms,
    },
    fivePhaseRadarNorms: {
      bazi: baziNorms,
      loShu: loShuNorms,
    },
  };
}
