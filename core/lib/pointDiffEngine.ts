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
 * Sleeper Point-Differential 25-System Pure Esoteric Prediction Engine.
 *
 * Evaluates a player's next-game Sleeper baseline projection alongside the combined
 * empirical point differential (+/- pts) across all 25 astrological, divinatory,
 * mystical, and witchcraft systems (194 discrete conditions) calibrated on 36,163
 * NFL regular-season player-games (2018-2026).
 *
 * Zero 0-100 heuristic scores, percentage weights, external NFL scoreboard APIs,
 * or mundane stadium/turf/weather features are used.
 */

import type { CosmicPlayer, ElementType, NFLPosition } from '../types/oneiromancy';
import {
  CELTIC_OGHAM_TREES,
  ELDER_FUTHARK_RUNES,
  GEOMANTIC_FIGURES,
  KABBALAH_SEPHIROTH,
  PTOLEMAIC_SIGN_RULERS,
  VEDIC_NAKSHATRAS,
  ZODIAC_SIGN_LIST,
  castGeomanticShieldFromMothers,
  computeAgrippaGematria,
  computeChaldeanPlanetaryHour,
  computeCompletedSolarAge,
  computeGeocentricPlanetsAtJd,
  computeKongWangVoidBranches,
  computeSexagenaryDayPillar,
  computeSexagenaryYearPillar,
  computeSiderealStateForDate,
  dateToJulianDayNumber,
  extractAnnualProfectionObservables,
  extractArabicManazilSectObservables,
  extractContestHoraryObservables,
  extractCosmobiologyObservables,
  extractDecanModalityObservables,
  extractFixedStarObservables,
  extractKabbalahGematriaObservables,
  extractMedievalGeomancyObservables,
  extractPlanetarySynastryObservables,
  extractRokuyoTenchusatsuObservables,
  extractRunesOghamObservables,
  extractSecondaryProgressionObservables,
  extractVedicJyotishObservables,
  extractWitchcraftObservables,
  getTropicalZodiac,
  parseStrictUtcDate,
  shortestAngularDistance,
  type AnnualProfectionObservables,
  type ArabicManazilSectObservables,
  type ContestHoraryObservables,
  type CosmobiologyObservables,
  type DecanModalityObservables,
  type FixedStarObservables,
  type KabbalahGematriaObservables,
  type MedievalGeomancyObservables,
  type PlanetarySynastryObservables,
  type RokuyoTenchusatsuObservables,
  type RunesOghamObservables,
  type SecondaryProgressionObservables,
  type SexagenaryPillar,
  type VedicJyotishObservables,
  type WitchcraftObservables,
  type WuXingPhase,
  type ZodiacSignInfo,
} from './esotericObservables';
import { teamGame } from './nflGames';
import { computeSleeperPointDiff, type SleeperScoringSettings } from './scoring';
import {
  CONDITION_EMPIRICAL_STATS,
  DEFAULT_CURATED_RIDGE_MODEL,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  JOINT_RIDGE_MODEL,
  KNOWN_SLEEPER_BIRTH_DATES_BY_ID,
  KNOWN_SLEEPER_BIRTH_DATES_BY_NAME,
  MODEL_PARAMETERS,
  PER_SYSTEM_RIDGE_MODELS,
  POINT_DIFF_STUDY_SUMMARY,
  POSITIONAL_MEAN_DIFF,
  POSITIONAL_RIDGE_MODELS,
  PREDICTOR_CATEGORIES,
  PREDICTOR_SYSTEM_META,
  TRAIN_SCREENED_RIDGE_MODEL,
  USABLE_SIGNAL_CATALOG,
  type ConditionEmpiricalStat,
  type FittedRidgeSubmodel,
  type PositionalModelBundle,
  type PositionalModelPosition,
  type PredictorCategoryId,
  type PredictorCategoryMeta,
  type PredictorSystemId,
  type PredictorSystemMeta,
  type SerializedPointDiffModelParameters,
  type UsableEsotericSignal,
  type UsableSignalClass,
} from './pointDiffWeights';

export {
  CELTIC_OGHAM_TREES,
  CONDITION_EMPIRICAL_STATS,
  DEFAULT_CURATED_RIDGE_MODEL,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  ELDER_FUTHARK_RUNES,
  GEOMANTIC_FIGURES,
  JOINT_RIDGE_MODEL,
  KABBALAH_SEPHIROTH,
  KNOWN_SLEEPER_BIRTH_DATES_BY_ID,
  KNOWN_SLEEPER_BIRTH_DATES_BY_NAME,
  MODEL_PARAMETERS,
  PER_SYSTEM_RIDGE_MODELS,
  POINT_DIFF_STUDY_SUMMARY,
  POSITIONAL_MEAN_DIFF,
  POSITIONAL_RIDGE_MODELS,
  PREDICTOR_CATEGORIES,
  PREDICTOR_SYSTEM_META,
  TRAIN_SCREENED_RIDGE_MODEL,
  USABLE_SIGNAL_CATALOG,
  VEDIC_NAKSHATRAS,
  castGeomanticShieldFromMothers,
  computeAgrippaGematria,
  computeChaldeanPlanetaryHour,
  computeCompletedSolarAge,
  computeKongWangVoidBranches,
  computeSiderealStateForDate,
  type ConditionEmpiricalStat,
  type FittedRidgeSubmodel,
  type PositionalModelBundle,
  type PositionalModelPosition,
  type PredictorCategoryId,
  type PredictorCategoryMeta,
  type PredictorSystemId,
  type PredictorSystemMeta,
  type SerializedPointDiffModelParameters,
  type UsableEsotericSignal,
  type UsableSignalClass,
  type WuXingPhase,
};

export const ALL_PREDICTOR_SYSTEM_IDS: readonly PredictorSystemId[] = PREDICTOR_SYSTEM_META.map(
  (m) => m.id,
);

/** Canonical set of all 25 predictor system identifiers for O(1) validation. */
export const VALID_PREDICTOR_SYSTEM_IDS: ReadonlySet<string> = new Set<string>(
  ALL_PREDICTOR_SYSTEM_IDS,
);

/**
 * Returns the 6 cosmic/divinatory categories paired with their member `PredictorSystemMeta` entries.
 */
export function getPredictiveCategoriesWithSystems(
  systems: readonly PredictorSystemMeta[] = PREDICTOR_SYSTEM_META,
): ReadonlyArray<PredictorCategoryMeta & { readonly systems: readonly PredictorSystemMeta[] }> {
  return PREDICTOR_CATEGORIES.map((cat) => {
    const matching = [...systems.filter((s) => s.categoryId === cat.id)].sort((a, b) => {
      if (a.defaultEnabled !== b.defaultEnabled) {
        return a.defaultEnabled ? -1 : 1;
      }
      return b.oosQuintileSpreadPts - a.oosQuintileSpreadPts;
    });
    return {
      ...cat,
      systemIds: matching.map((s) => s.id),
      defaultSystemIds: matching.filter((s) => s.defaultEnabled).map((s) => s.id),
      systems: matching,
    };
  });
}

// ============================================================================
// 1. 32-Team NFL Venue Coordinate Registry & Deterministic Matchup Resolution
// ============================================================================

export interface StadiumRecord {
  readonly stadiumId: string;
  readonly name: string;
  readonly team: string;
  readonly city: string;
  readonly state: string;
  readonly lat: number;
  readonly lon: number;
  readonly orientation: 'N-S' | 'E-W' | 'NE-SW' | 'NW-SE';
  readonly openedYear: number;
}

export const NFL_STADIUMS: Readonly<Record<string, StadiumRecord>> = {
  ARI: { stadiumId: 'ARI', name: 'State Farm Stadium', team: 'ARI', city: 'Glendale', state: 'AZ', lat: 33.5276, lon: -112.2626, orientation: 'NW-SE', openedYear: 2006 },
  ATL: { stadiumId: 'ATL', name: 'Mercedes-Benz Stadium', team: 'ATL', city: 'Atlanta', state: 'GA', lat: 33.7554, lon: -84.401, orientation: 'E-W', openedYear: 2017 },
  BAL: { stadiumId: 'BAL', name: 'M&T Bank Stadium', team: 'BAL', city: 'Baltimore', state: 'MD', lat: 39.278, lon: -76.6227, orientation: 'NE-SW', openedYear: 1998 },
  BUF: { stadiumId: 'BUF', name: 'Highmark Stadium', team: 'BUF', city: 'Orchard Park', state: 'NY', lat: 42.7738, lon: -78.787, orientation: 'NE-SW', openedYear: 1973 },
  CAR: { stadiumId: 'CAR', name: 'Bank of America Stadium', team: 'CAR', city: 'Charlotte', state: 'NC', lat: 35.2258, lon: -80.8528, orientation: 'N-S', openedYear: 1996 },
  CHI: { stadiumId: 'CHI', name: 'Soldier Field', team: 'CHI', city: 'Chicago', state: 'IL', lat: 41.8623, lon: -87.6167, orientation: 'N-S', openedYear: 1924 },
  CIN: { stadiumId: 'CIN', name: 'Paycor Stadium', team: 'CIN', city: 'Cincinnati', state: 'OH', lat: 39.0955, lon: -84.5161, orientation: 'N-S', openedYear: 2000 },
  CLE: { stadiumId: 'CLE', name: 'Huntington Bank Field', team: 'CLE', city: 'Cleveland', state: 'OH', lat: 41.5061, lon: -81.6995, orientation: 'NE-SW', openedYear: 1999 },
  DAL: { stadiumId: 'DAL', name: 'AT&T Stadium', team: 'DAL', city: 'Arlington', state: 'TX', lat: 32.7473, lon: -97.0945, orientation: 'E-W', openedYear: 2009 },
  DEN: { stadiumId: 'DEN', name: 'Empower Field at Mile High', team: 'DEN', city: 'Denver', state: 'CO', lat: 39.7439, lon: -105.0201, orientation: 'N-S', openedYear: 2001 },
  DET: { stadiumId: 'DET', name: 'Ford Field', team: 'DET', city: 'Detroit', state: 'MI', lat: 42.34, lon: -83.0456, orientation: 'E-W', openedYear: 2002 },
  GB: { stadiumId: 'GB', name: 'Lambeau Field', team: 'GB', city: 'Green Bay', state: 'WI', lat: 44.5013, lon: -88.0622, orientation: 'N-S', openedYear: 1957 },
  HOU: { stadiumId: 'HOU', name: 'NRG Stadium', team: 'HOU', city: 'Houston', state: 'TX', lat: 29.6847, lon: -95.4107, orientation: 'N-S', openedYear: 2002 },
  IND: { stadiumId: 'IND', name: 'Lucas Oil Stadium', team: 'IND', city: 'Indianapolis', state: 'IN', lat: 39.7601, lon: -86.1639, orientation: 'NE-SW', openedYear: 2008 },
  JAX: { stadiumId: 'JAX', name: 'EverBank Stadium', team: 'JAX', city: 'Jacksonville', state: 'FL', lat: 30.324, lon: -81.6373, orientation: 'N-S', openedYear: 1995 },
  KC: { stadiumId: 'KC', name: 'GEHA Field at Arrowhead Stadium', team: 'KC', city: 'Kansas City', state: 'MO', lat: 39.0489, lon: -94.4839, orientation: 'NW-SE', openedYear: 1972 },
  LV: { stadiumId: 'LV', name: 'Allegiant Stadium', team: 'LV', city: 'Las Vegas', state: 'NV', lat: 36.0909, lon: -115.1833, orientation: 'N-S', openedYear: 2020 },
  LAC: { stadiumId: 'LAC', name: 'SoFi Stadium', team: 'LAC', city: 'Inglewood', state: 'CA', lat: 33.9535, lon: -118.3392, orientation: 'NW-SE', openedYear: 2020 },
  LAR: { stadiumId: 'LAR', name: 'SoFi Stadium', team: 'LAR', city: 'Inglewood', state: 'CA', lat: 33.9535, lon: -118.3392, orientation: 'NW-SE', openedYear: 2020 },
  MIA: { stadiumId: 'MIA', name: 'Hard Rock Stadium', team: 'MIA', city: 'Miami Gardens', state: 'FL', lat: 25.958, lon: -80.2389, orientation: 'NW-SE', openedYear: 1987 },
  MIN: { stadiumId: 'MIN', name: 'U.S. Bank Stadium', team: 'MIN', city: 'Minneapolis', state: 'MN', lat: 44.9735, lon: -93.2575, orientation: 'NW-SE', openedYear: 2016 },
  NE: { stadiumId: 'NE', name: 'Gillette Stadium', team: 'NE', city: 'Foxborough', state: 'MA', lat: 42.0909, lon: -71.2643, orientation: 'N-S', openedYear: 2002 },
  NO: { stadiumId: 'NO', name: 'Caesars Superdome', team: 'NO', city: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0812, orientation: 'E-W', openedYear: 1975 },
  NYG: { stadiumId: 'NYG', name: 'MetLife Stadium', team: 'NYG', city: 'East Rutherford', state: 'NJ', lat: 40.8128, lon: -74.0742, orientation: 'NW-SE', openedYear: 2010 },
  NYJ: { stadiumId: 'NYJ', name: 'MetLife Stadium', team: 'NYJ', city: 'East Rutherford', state: 'NJ', lat: 40.8128, lon: -74.0742, orientation: 'NW-SE', openedYear: 2010 },
  PHI: { stadiumId: 'PHI', name: 'Lincoln Financial Field', team: 'PHI', city: 'Philadelphia', state: 'PA', lat: 39.9008, lon: -75.1675, orientation: 'N-S', openedYear: 2003 },
  PIT: { stadiumId: 'PIT', name: 'Acrisure Stadium', team: 'PIT', city: 'Pittsburgh', state: 'PA', lat: 40.4468, lon: -80.0158, orientation: 'N-S', openedYear: 2001 },
  SF: { stadiumId: 'SF', name: "Levi's Stadium", team: 'SF', city: 'Santa Clara', state: 'CA', lat: 37.4033, lon: -121.9694, orientation: 'N-S', openedYear: 2014 },
  SEA: { stadiumId: 'SEA', name: 'Lumen Field', team: 'SEA', city: 'Seattle', state: 'WA', lat: 47.5952, lon: -122.3316, orientation: 'N-S', openedYear: 2002 },
  TB: { stadiumId: 'TB', name: 'Raymond James Stadium', team: 'TB', city: 'Tampa', state: 'FL', lat: 27.9759, lon: -82.5033, orientation: 'N-S', openedYear: 1998 },
  TEN: { stadiumId: 'TEN', name: 'Nissan Stadium', team: 'TEN', city: 'Nashville', state: 'TN', lat: 36.1665, lon: -86.7713, orientation: 'N-S', openedYear: 1999 },
  WAS: { stadiumId: 'WAS', name: 'Northwest Stadium', team: 'WAS', city: 'Landover', state: 'MD', lat: 38.9076, lon: -76.8645, orientation: 'N-S', openedYear: 1997 },
};

const ALL_32_TEAMS = Object.keys(NFL_STADIUMS).sort();

export function normalizeNflTeamCode(team?: string | null): string | null {
  const norm = String(team || '').trim().toUpperCase();
  if (!norm || norm === 'FA' || norm === 'NFL') return null;
  if (NFL_STADIUMS[norm]) return norm;
  if (norm === 'SD' || norm === 'SAN') return 'LAC';
  if (norm === 'OAK' || norm === 'RAI') return 'LV';
  if (norm === 'STL' || norm === 'RAM') return 'LAR';
  if (norm === 'WSH' || norm === 'WFT') return 'WAS';
  if (norm === 'JAC') return 'JAX';
  return null;
}

export function getStadiumForTeam(team?: string | null): StadiumRecord | null {
  const norm = normalizeNflTeamCode(team);
  return norm ? NFL_STADIUMS[norm] : null;
}

export function resolveWeekSundayDate(seasonYear: number, week: number): string {
  const safeYear = Number.isFinite(seasonYear) && seasonYear >= 2000 ? Math.trunc(seasonYear) : 2025;
  const safeWeek = Math.max(1, Math.min(18, Math.trunc(week || 1)));
  const sep1 = new Date(Date.UTC(safeYear, 8, 1));
  const sep1Dow = sep1.getUTCDay();
  const laborDayDate = sep1Dow === 1 ? 1 : 1 + ((8 - sep1Dow) % 7);
  const week1SundayDate = laborDayDate + 6;
  const targetUtc = new Date(Date.UTC(safeYear, 8, week1SundayDate + (safeWeek - 1) * 7));
  const y = targetUtc.getUTCFullYear();
  const m = String(targetUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveTeamNextGame(
  team: string | null | undefined,
  week: number,
  seasonYear = 2025,
): {
  team: string;
  opponent: string;
  isHome: boolean;
  hostTeam: string;
  gameDate: string;
  kickoffUtc: string | null;
  hostStadium: StadiumRecord;
} | null {
  const normTeam = normalizeNflTeamCode(team);
  if (!normTeam) return null;

  const safeWeek = Math.max(1, Math.min(18, Math.trunc(week || 1)));
  const liveGame = teamGame(safeWeek, normTeam);
  if (liveGame) {
    const home = normalizeNflTeamCode(liveGame.home) || normTeam;
    const away = normalizeNflTeamCode(liveGame.away) || normTeam;
    const isHome = home === normTeam;
    const opponent = isHome ? away : home;
    const gameDate =
      liveGame.date ||
      (liveGame.kickoff ? liveGame.kickoff.slice(0, 10) : null) ||
      resolveWeekSundayDate(seasonYear, safeWeek);
    const hostStadium = getStadiumForTeam(home) || NFL_STADIUMS[normTeam];
    return {
      team: normTeam,
      opponent,
      isHome,
      hostTeam: home,
      gameDate,
      kickoffUtc: liveGame.kickoff || null,
      hostStadium,
    };
  }

  const n = ALL_32_TEAMS.length;
  const round = (((safeWeek - 1 + (seasonYear % 7)) % (n - 1)) + (n - 1)) % (n - 1);
  const myIdx = ALL_32_TEAMS.indexOf(normTeam);
  if (myIdx < 0) return null;

  const posInCircle = (idx: number): number => {
    if (idx === n - 1) return n - 1;
    return (idx + round) % (n - 1);
  };
  const invCircle = (pos: number): number => {
    if (pos === n - 1) return n - 1;
    return (pos - round + (n - 1)) % (n - 1);
  };

  const myPos = posInCircle(myIdx);
  const oppPos = n - 1 - myPos;
  const oppIdx = invCircle(oppPos);
  const opponent = ALL_32_TEAMS[oppIdx] || 'KC';
  const parityFlip = (safeWeek + Math.min(myPos, oppPos)) % 2 === 0;
  const isHome = myPos < oppPos ? parityFlip : !parityFlip;
  const hostTeam = isHome ? normTeam : opponent;
  const gameDate = resolveWeekSundayDate(seasonYear, safeWeek);

  return {
    team: normTeam,
    opponent,
    isHome,
    hostTeam,
    gameDate,
    kickoffUtc: null,
    hostStadium: NFL_STADIUMS[hostTeam] || NFL_STADIUMS[normTeam],
  };
}

// ============================================================================
// 2. Pure Astronomical, Natal & Transit Observables
// ============================================================================

export type ZodiacSignEntry = ZodiacSignInfo;
export const ZODIAC_SIGNS: readonly ZodiacSignEntry[] = ZODIAC_SIGN_LIST;

const SIGN_REPRESENTATIVE_MMDD: Readonly<Record<string, string>> = {
  Aries: '04-04',
  Taurus: '05-05',
  Gemini: '06-05',
  Cancer: '07-06',
  Leo: '08-06',
  Virgo: '09-06',
  Libra: '10-06',
  Scorpio: '11-06',
  Sagittarius: '12-06',
  Capricorn: '01-05',
  Aquarius: '02-04',
  Pisces: '03-05',
};

export function hasAuthoritativePlayerBirthDate(
  player: Partial<CosmicPlayer> & { birth_date?: string | null; birthDate?: string | null },
): boolean {
  if (!player || player.position === 'DEF') return false;
  const direct = player.birth_date || player.birthDate;
  if (typeof direct === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(direct.trim())) {
    return true;
  }
  const pid = String(player.id || '').trim();
  return Boolean(pid && KNOWN_SLEEPER_BIRTH_DATES_BY_ID[pid]);
}

export function resolvePlayerBirthDate(
  player: Partial<CosmicPlayer> & { birth_date?: string | null; birthDate?: string | null },
): string | null {
  if (!player || player.position === 'DEF') return null;
  const direct = player.birth_date || player.birthDate;
  if (typeof direct === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(direct.trim())) {
    return direct.trim();
  }
  const pid = String(player.id || '').trim();
  if (pid && KNOWN_SLEEPER_BIRTH_DATES_BY_ID[pid]) {
    return KNOWN_SLEEPER_BIRTH_DATES_BY_ID[pid];
  }
  const fullName = String(
    player.name || `${player.first_name || ''} ${player.last_name || ''}`,
  )
    .trim()
    .toLowerCase();
  if (fullName && KNOWN_SLEEPER_BIRTH_DATES_BY_NAME[fullName]) {
    return KNOWN_SLEEPER_BIRTH_DATES_BY_NAME[fullName];
  }

  const seedStr = `${pid}|${fullName}`;
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = (h << 5) - h + seedStr.charCodeAt(i);
    h |= 0;
  }
  const absH = Math.abs(h);
  const year = 1995 + (absH % 8);
  const signHint = player.elemental_traits?.sun_sign;
  if (signHint && SIGN_REPRESENTATIVE_MMDD[signHint]) {
    return `${year}-${SIGN_REPRESENTATIVE_MMDD[signHint]}`;
  }
  const month = (absH % 12) + 1;
  const day = ((absH >> 4) % 27) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseStrictUtcCalendarDate(
  dateStr?: string | null,
): { year: number; month: number; day: number; date: Date } | null {
  return parseStrictUtcDate(dateStr);
}

export function getZodiacFromDate(dateStr?: string | null): ZodiacSignEntry | null {
  return getTropicalZodiac(dateStr);
}

export function getSolarLongitude(date: Date): number {
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
  const deg = (dayOfYear - 79) * (360 / 365.2422);
  return ((deg % 360) + 360) % 360;
}

const ANOMALISTIC_MONTH_DAYS = 27.55455;
const LUNAR_SEMI_MAJOR_AXIS_KM = 384400;
const LUNAR_ECCENTRICITY = 0.0549;
const LUNAR_PERIGEE_KM = LUNAR_SEMI_MAJOR_AXIS_KM * (1 - LUNAR_ECCENTRICITY);
const LUNAR_APOGEE_KM = LUNAR_SEMI_MAJOR_AXIS_KM * (1 + LUNAR_ECCENTRICITY);
const REF_PERIGEE_UTC_MS = Date.UTC(2024, 9, 17, 0, 51, 0);

function calculateLunarOrbit(targetDate: Date): {
  distanceKm: number;
  perigeeProximity: number;
  isPerigee: boolean;
  isApogee: boolean;
} {
  const anomalisticMs = ANOMALISTIC_MONTH_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = targetDate.getTime() - REF_PERIGEE_UTC_MS;
  const anomalisticFrac =
    (((elapsed % anomalisticMs) + anomalisticMs) % anomalisticMs) / anomalisticMs;
  const meanAnomalyRad = 2 * Math.PI * anomalisticFrac;

  let E = meanAnomalyRad + LUNAR_ECCENTRICITY * Math.sin(meanAnomalyRad);
  for (let i = 0; i < 6; i++) {
    const f = E - LUNAR_ECCENTRICITY * Math.sin(E) - meanAnomalyRad;
    const fPrime = 1 - LUNAR_ECCENTRICITY * Math.cos(E);
    E -= f / fPrime;
  }

  const rawDistKm = LUNAR_SEMI_MAJOR_AXIS_KM * (1 - LUNAR_ECCENTRICITY * Math.cos(E));
  const distanceKm = Math.round(rawDistKm * 100) / 100;
  const perigeeProximity = Number(
    Math.min(
      1.0,
      Math.max(0.0, (LUNAR_APOGEE_KM - rawDistKm) / (LUNAR_APOGEE_KM - LUNAR_PERIGEE_KM)),
    ).toFixed(4),
  );
  const isPerigee = anomalisticFrac <= 0.08 || anomalisticFrac >= 0.92;
  const isApogee = anomalisticFrac >= 0.42 && anomalisticFrac <= 0.58;

  return { distanceKm, perigeeProximity, isPerigee, isApogee };
}

export interface LunarPhaseState {
  readonly phaseAngleDeg: number;
  readonly name: string;
  readonly isFullMoon: boolean;
  readonly isNewMoon: boolean;
  readonly isVoidOfCourse: boolean;
  readonly distanceKm: number;
  readonly isPerigee: boolean;
  readonly isApogee: boolean;
  readonly isSupermoon: boolean;
}

export function calculateLunarPhase(dateStr?: string | null): LunarPhaseState | null {
  const cal = parseStrictUtcCalendarDate(dateStr);
  if (!cal) return null;
  const targetDate = cal.date;
  const refNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMonthMs = 29.530588853 * 24 * 60 * 60 * 1000;
  const elapsed = targetDate.getTime() - refNewMoon;
  const phaseFrac =
    (((elapsed % synodicMonthMs) + synodicMonthMs) % synodicMonthMs) / synodicMonthMs;
  const phaseAngleDeg = phaseFrac * 360;

  let name = 'New Moon';
  if (phaseAngleDeg < 22.5 || phaseAngleDeg >= 337.5) name = 'New Moon';
  else if (phaseAngleDeg < 67.5) name = 'Waxing Crescent';
  else if (phaseAngleDeg < 112.5) name = 'First Quarter';
  else if (phaseAngleDeg < 157.5) name = 'Waxing Gibbous';
  else if (phaseAngleDeg < 202.5) name = 'Full Moon';
  else if (phaseAngleDeg < 247.5) name = 'Waning Gibbous';
  else if (phaseAngleDeg < 292.5) name = 'Third Quarter';
  else name = 'Waning Crescent';

  const isFullMoon = phaseAngleDeg >= 165 && phaseAngleDeg <= 195;
  const isNewMoon = phaseAngleDeg <= 15 || phaseAngleDeg >= 345;
  const isVoidOfCourse = phaseAngleDeg % 30 >= 27.5;
  const orbit = calculateLunarOrbit(targetDate);

  return {
    phaseAngleDeg,
    name,
    isFullMoon,
    isNewMoon,
    isVoidOfCourse,
    distanceKm: orbit.distanceKm,
    isPerigee: orbit.isPerigee,
    isApogee: orbit.isApogee,
    isSupermoon: isFullMoon && orbit.isPerigee,
  };
}

interface CelestialObservables {
  readonly zodiac: ZodiacSignEntry | null;
  readonly gameSunZodiac: ZodiacSignEntry | null;
  readonly lunarPhase: LunarPhaseState | null;
  readonly solarAngleDeg: number | null;
  readonly aspectType: string | null;
}

export function extractCelestialObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): CelestialObservables {
  const gameCal = parseStrictUtcCalendarDate(gameDateStr);
  const lunarPhase = calculateLunarPhase(gameDateStr);
  const gameSunZodiac = getZodiacFromDate(gameDateStr);
  const natalZodiac = getZodiacFromDate(birthDateStr);
  const natalCal = parseStrictUtcCalendarDate(birthDateStr);

  if (!gameCal || !lunarPhase || !natalZodiac || !natalCal) {
    return {
      zodiac: natalZodiac,
      gameSunZodiac,
      lunarPhase,
      solarAngleDeg: null,
      aspectType: null,
    };
  }

  const solarLong = getSolarLongitude(gameCal.date);
  const natalLong = getSolarLongitude(natalCal.date);
  let diff = Math.abs(solarLong - natalLong);
  if (diff > 180) diff = 360 - diff;

  let aspectType = 'Neutral';
  if (diff <= 8) aspectType = 'Conjunction';
  else if (Math.abs(diff - 60) <= 8) aspectType = 'Sextile';
  else if (Math.abs(diff - 90) <= 8) aspectType = 'Square';
  else if (Math.abs(diff - 120) <= 8) aspectType = 'Trine';
  else if (Math.abs(diff - 180) <= 8) aspectType = 'Opposition';

  return {
    zodiac: natalZodiac,
    gameSunZodiac,
    lunarPhase,
    solarAngleDeg: Number(diff.toFixed(2)),
    aspectType,
  };
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// 3. Roster Harmony & Western Elemental Synastry (Pure 4-Element Definition)
// ============================================================================

export const WESTERN_ELEMENTS: readonly ElementType[] = ['Fire', 'Earth', 'Air', 'Water'];

const COMPATIBLE_ELEMENTS: Readonly<Record<ElementType, ReadonlySet<ElementType>>> = {
  Fire: new Set<ElementType>(['Fire', 'Air']),
  Air: new Set<ElementType>(['Air', 'Fire']),
  Earth: new Set<ElementType>(['Earth', 'Water']),
  Water: new Set<ElementType>(['Water', 'Earth']),
};

export interface UnitPlayerInput {
  readonly id?: string;
  readonly playerId?: string;
  readonly name?: string;
  readonly playerName?: string;
  readonly position?: string;
  readonly pos?: string;
  readonly team?: string | null;
  readonly birthDate?: string | null;
  readonly element?: ElementType | null;
}

export type SynergyRegime = 'DOMINANCE' | 'SHOOTOUT' | 'DEFICIT' | 'SLUGFEST';

export interface UnitSynergyState {
  readonly elementCounts: Record<ElementType, number>;
  readonly dominantElement: ElementType | null;
  readonly qbElement: ElementType | null;
  readonly maxSameElement: number;
  readonly pairwiseElementCohesion: number;
  readonly qbCompatShare: number;
  readonly hasWesternTrine: boolean;
  readonly hasQuadBalance: boolean;
  readonly hasElementCluster: boolean;
  readonly hasQbElementAlignment: boolean;
  readonly hasHighUnitSynergy: boolean;
}

interface UnitSlotWrapper {
  readonly player: UnitPlayerInput | null | undefined;
}

function unwrapUnitPlayer(
  item?: UnitPlayerInput | UnitSlotWrapper | null,
): UnitPlayerInput | null {
  if (!item) return null;
  return 'player' in item ? (item.player ?? null) : item;
}

export function extractUnitSynergy(
  roster: ReadonlyArray<UnitPlayerInput | UnitSlotWrapper> = [],
): UnitSynergyState {
  const elementCounts: Record<ElementType, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  let qbElement: ElementType | null = null;
  let elementalKnownCount = 0;
  const passCatcherElements: ElementType[] = [];

  for (const item of roster) {
    const p = unwrapUnitPlayer(item);
    if (!p) continue;
    const pos = String(p.position || p.pos || '').toUpperCase();
    if (pos === 'DEF') continue;
    const el =
      p.element ||
      (p.birthDate ? getZodiacFromDate(p.birthDate)?.element ?? null : null);
    if (el && el in elementCounts) {
      elementCounts[el] += 1;
      elementalKnownCount += 1;
    }
    if (pos === 'QB') {
      if (!qbElement && el) qbElement = el;
    } else if (pos === 'WR' || pos === 'TE') {
      if (el) passCatcherElements.push(el);
    }
  }

  let maxSameElement = 0;
  let dominantElement: ElementType | null = null;
  let tieCount = 0;
  for (const el of WESTERN_ELEMENTS) {
    const c = elementCounts[el];
    if (c > maxSameElement) {
      maxSameElement = c;
      dominantElement = el;
      tieCount = 1;
    } else if (c === maxSameElement && c > 0) {
      tieCount += 1;
    }
  }
  if (tieCount > 1 && qbElement && elementCounts[qbElement] === maxSameElement) {
    dominantElement = qbElement;
  }

  const pairwiseElementCohesion =
    elementalKnownCount >= 2
      ? Number(
          (
            WESTERN_ELEMENTS.reduce(
              (sum, el) => sum + elementCounts[el] * (elementCounts[el] - 1),
              0,
            ) /
            (elementalKnownCount * (elementalKnownCount - 1))
          ).toFixed(4),
        )
      : 0.25;

  const qbCompatibleReceivers = qbElement
    ? passCatcherElements.filter((el) => COMPATIBLE_ELEMENTS[qbElement].has(el)).length
    : 0;
  const qbCompatShare =
    passCatcherElements.length > 0
      ? Number((qbCompatibleReceivers / passCatcherElements.length).toFixed(4))
      : 0;

  const hasWesternTrine = maxSameElement >= 3;
  const hasQuadBalance =
    elementCounts.Fire > 0 &&
    elementCounts.Earth > 0 &&
    elementCounts.Air > 0 &&
    elementCounts.Water > 0;
  const hasElementCluster = elementalKnownCount >= 2 && pairwiseElementCohesion > 0.25;
  const hasQbElementAlignment = passCatcherElements.length >= 1 && qbCompatShare > 0.5;
  const hasHighUnitSynergy = hasElementCluster || hasQbElementAlignment;

  return {
    elementCounts,
    dominantElement: maxSameElement > 0 ? dominantElement : null,
    qbElement,
    maxSameElement,
    pairwiseElementCohesion,
    qbCompatShare,
    hasWesternTrine,
    hasQuadBalance,
    hasElementCluster,
    hasQbElementAlignment,
    hasHighUnitSynergy,
  };
}

function extractPlayerStackState(
  player: UnitPlayerInput,
  teamRoster: ReadonlyArray<UnitPlayerInput | { player?: UnitPlayerInput }>,
): { qbSynastry: 'trine_same_element' | 'sextile_compatible' | 'cross_polarity' | null } {
  const pos = String(player.position || player.pos || '').toUpperCase();
  const pid = String(player.playerId || player.id || '');
  const playerEl =
    player.element ||
    (player.birthDate ? getZodiacFromDate(player.birthDate)?.element ?? null : null);

  let qbEl: ElementType | null = null;
  for (const item of teamRoster) {
    if (!item) continue;
    const m: UnitPlayerInput = 'player' in item && item.player ? item.player : (item as UnitPlayerInput);
    const mId = String(m.playerId || m.id || '');
    if (pid && mId === pid) continue;
    if (player.team && m.team && m.team !== player.team) continue;
    if (String(m.position || m.pos || '').toUpperCase() === 'QB' && !qbEl) {
      qbEl =
        m.element ||
        (m.birthDate ? getZodiacFromDate(m.birthDate)?.element ?? null : null);
    }
  }

  let qbSynastry: 'trine_same_element' | 'sextile_compatible' | 'cross_polarity' | null = null;
  if ((pos === 'WR' || pos === 'TE') && playerEl && qbEl) {
    qbSynastry =
      playerEl === qbEl
        ? 'trine_same_element'
        : COMPATIBLE_ELEMENTS[playerEl].has(qbEl)
          ? 'sextile_compatible'
          : 'cross_polarity';
  }
  return { qbSynastry };
}

export function classifySynergyMatchupRegime(
  mySynergy: UnitSynergyState,
  oppSynergy: UnitSynergyState,
): SynergyRegime {
  const myHigh = mySynergy.hasHighUnitSynergy;
  const oppHigh = oppSynergy.hasHighUnitSynergy;
  if (myHigh && oppHigh) return 'SHOOTOUT';
  if (myHigh && !oppHigh) return 'DOMINANCE';
  if (!myHigh && oppHigh) return 'DEFICIT';
  return 'SLUGFEST';
}

// ============================================================================
// 4. Chinese BaZi, Wu Xing Five-Phase Cycles & Qi Men / Ba Gua Geomancy
// ============================================================================

export type WuXingRelation =
  | 'SAME'
  | 'PRODUCES'
  | 'PRODUCED_BY'
  | 'CONQUERS'
  | 'CONQUERED_BY';

export const WU_XING_PHASES: readonly WuXingPhase[] = [
  'Wood',
  'Fire',
  'Earth',
  'Metal',
  'Water',
];

const PHASE_INDEX: Readonly<Record<WuXingPhase, number>> = {
  Wood: 0,
  Fire: 1,
  Earth: 2,
  Metal: 3,
  Water: 4,
};

const BAGUA_DIRECTIONS = [
  { sector: 'N', trigram: 'Kan', phase: 'Water' as WuXingPhase, loShuNumber: 1 },
  { sector: 'NE', trigram: 'Gen', phase: 'Earth' as WuXingPhase, loShuNumber: 8 },
  { sector: 'E', trigram: 'Zhen', phase: 'Wood' as WuXingPhase, loShuNumber: 3 },
  { sector: 'SE', trigram: 'Xun', phase: 'Wood' as WuXingPhase, loShuNumber: 4 },
  { sector: 'S', trigram: 'Li', phase: 'Fire' as WuXingPhase, loShuNumber: 9 },
  { sector: 'SW', trigram: 'Kun', phase: 'Earth' as WuXingPhase, loShuNumber: 2 },
  { sector: 'W', trigram: 'Dui', phase: 'Metal' as WuXingPhase, loShuNumber: 7 },
  { sector: 'NW', trigram: 'Qian', phase: 'Metal' as WuXingPhase, loShuNumber: 6 },
] as const;

const EAST_GROUP_SECTORS = new Set<string>(['N', 'S', 'E', 'SE']);
const WEST_GROUP_SECTORS = new Set<string>(['W', 'NW', 'SW', 'NE']);

export function toJulianDayNumber(dateStr?: string | null): number | null {
  return dateToJulianDayNumber(dateStr);
}

export function getSexagenaryDayPillar(dateStr?: string | null): SexagenaryPillar | null {
  return computeSexagenaryDayPillar(dateStr);
}

export function classifyWuXingRelation(
  sourcePhase: WuXingPhase | null | undefined,
  targetPhase: WuXingPhase | null | undefined,
): WuXingRelation | null {
  if (!sourcePhase || !targetPhase) return null;
  const s = PHASE_INDEX[sourcePhase];
  const t = PHASE_INDEX[targetPhase];
  if (s === undefined || t === undefined) return null;
  const diff = (((t - s) % 5) + 5) % 5;
  if (diff === 0) return 'SAME';
  if (diff === 1) return 'PRODUCES';
  if (diff === 4) return 'PRODUCED_BY';
  if (diff === 2) return 'CONQUERS';
  return 'CONQUERED_BY';
}

function isEarthlyBranchClash(a?: number | null, b?: number | null): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) === 6;
}

function isSanHeHarmony(a?: number | null, b?: number | null): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return a !== b && Math.abs(a - b) % 4 === 0;
}

function calculateCompassBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): { bearingDeg: number | null; sector: string | null; loShuSectorNumber: number | null } {
  if (lat1 === lat2 && lon1 === lon2) {
    return { bearingDeg: null, sector: null, loShuSectorNumber: null };
  }
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  const sectorIdx = Math.round(deg / 45) % 8;
  return {
    bearingDeg: Number(deg.toFixed(2)),
    sector: BAGUA_DIRECTIONS[sectorIdx].sector,
    loShuSectorNumber: BAGUA_DIRECTIONS[sectorIdx].loShuNumber,
  };
}

const LO_SHU_STAR_PHASES: Readonly<Record<number, WuXingPhase>> = {
  1: 'Water',
  2: 'Earth',
  3: 'Wood',
  4: 'Wood',
  5: 'Earth',
  6: 'Metal',
  7: 'Metal',
  8: 'Earth',
  9: 'Fire',
};

export function calculateLoShuYearStar(
  birthDateStr?: string | null,
): { star: number; group: 'EAST' | 'WEST'; phase: WuXingPhase } | null {
  const cal = parseStrictUtcCalendarDate(birthDateStr);
  if (!cal) return null;
  const solarYear =
    cal.month < 2 || (cal.month === 2 && cal.day < 4) ? cal.year - 1 : cal.year;
  const star = ((((11 - (solarYear % 9)) % 9) + 9) % 9) || 9;
  const group = star === 1 || star === 3 || star === 4 || star === 9 ? 'EAST' : 'WEST';
  return { star, group, phase: LO_SHU_STAR_PHASES[star] || 'Earth' };
}

export function extractRosterDominantWuXing(
  roster: ReadonlyArray<UnitPlayerInput | UnitSlotWrapper> = [],
): {
  dominantWuXing: WuXingPhase | null;
  qbDayPillar: SexagenaryPillar | null;
  counts: Record<WuXingPhase, number>;
} {
  const counts: Record<WuXingPhase, number> = {
    Wood: 0,
    Fire: 0,
    Earth: 0,
    Metal: 0,
    Water: 0,
  };
  let qbDayPillar: SexagenaryPillar | null = null;

  for (const item of roster) {
    const p = unwrapUnitPlayer(item);
    if (!p) continue;
    const pos = String(p.position || p.pos || '').toUpperCase();
    if (pos === 'DEF' || !p.birthDate) continue;
    const dp = getSexagenaryDayPillar(p.birthDate);
    if (!dp) continue;
    counts[dp.stem.phase] += 1;
    if (pos === 'QB' && !qbDayPillar) qbDayPillar = dp;
  }

  let bestPhase: WuXingPhase | null = null;
  let bestCount = 0;
  for (const ph of WU_XING_PHASES) {
    if (counts[ph] > bestCount) {
      bestCount = counts[ph];
      bestPhase = ph;
    } else if (counts[ph] === bestCount && bestCount > 0 && qbDayPillar?.stem.phase === ph) {
      bestPhase = ph;
    }
  }

  return {
    dominantWuXing: bestCount > 0 ? bestPhase : null,
    qbDayPillar,
    counts,
  };
}

interface BaZiObservables {
  readonly dayMasterPhase: WuXingPhase | null;
  readonly dayMasterStem: string | null;
  readonly natalBranchAnimal: string | null;
  readonly gameDayPhase: WuXingPhase | null;
  readonly dayPhaseRelation: WuXingRelation | null;
  readonly isDayBranchClash: boolean;
  readonly isDaySanHeHarmony: boolean;
  readonly isOppQbBranchClash: boolean;
}

function extractBaZiObservables(
  birthDateStr: string | null,
  gameDateStr: string | null,
  oppQbDayPillar: SexagenaryPillar | null,
): BaZiObservables {
  const gameDayPillar = getSexagenaryDayPillar(gameDateStr);
  const natalDayPillar = getSexagenaryDayPillar(birthDateStr);
  const natalYearPillar = computeSexagenaryYearPillar(birthDateStr);

  if (!gameDayPillar || !natalDayPillar) {
    return {
      dayMasterPhase: natalDayPillar?.stem.phase ?? null,
      dayMasterStem: natalDayPillar?.stem.name ?? null,
      natalBranchAnimal: natalDayPillar?.branch.animal ?? null,
      gameDayPhase: gameDayPillar?.stem.phase ?? null,
      dayPhaseRelation: null,
      isDayBranchClash: false,
      isDaySanHeHarmony: false,
      isOppQbBranchClash: false,
    };
  }

  const dayMasterPhase = natalDayPillar.stem.phase;
  const gameDayPhase = gameDayPillar.stem.phase;
  const dayPhaseRelation = classifyWuXingRelation(dayMasterPhase, gameDayPhase);
  const isDayBranchClash =
    isEarthlyBranchClash(natalDayPillar.branch.index, gameDayPillar.branch.index) ||
    Boolean(
      natalYearPillar &&
        isEarthlyBranchClash(natalYearPillar.branch.index, gameDayPillar.branch.index),
    );
  const isDaySanHeHarmony = isSanHeHarmony(
    natalDayPillar.branch.index,
    gameDayPillar.branch.index,
  );
  const isOppQbBranchClash = Boolean(
    oppQbDayPillar &&
      isEarthlyBranchClash(natalDayPillar.branch.index, oppQbDayPillar.branch.index),
  );

  return {
    dayMasterPhase,
    dayMasterStem: natalDayPillar.stem.name,
    natalBranchAnimal: natalDayPillar.branch.animal,
    gameDayPhase,
    dayPhaseRelation,
    isDayBranchClash,
    isDaySanHeHarmony,
    isOppQbBranchClash,
  };
}

interface DirectionalGeomancyObservables {
  readonly loShuStar: number | null;
  readonly loShuGroup: 'EAST' | 'WEST' | null;
  readonly roadBearingDeg: number | null;
  readonly roadSector: string | null;
  readonly isAuspiciousRoadBearing: boolean;
  readonly isInauspiciousRoadBearing: boolean;
  readonly isFiveYellowTabooRoad: boolean;
  readonly xuanKongPeriod: number;
}

function extractDirectionalGeomancyObservables(params: {
  birthDate: string | null;
  gameDate: string | null;
  team: string | null;
  opponent: string | null;
  isHome: boolean;
  hostStadium: StadiumRecord | null;
}): DirectionalGeomancyObservables {
  const homeStad = params.team ? getStadiumForTeam(params.team) : null;
  const oppStad = params.opponent ? getStadiumForTeam(params.opponent) : null;
  const resolvedHost =
    params.hostStadium || (params.isHome ? homeStad : oppStad) || null;

  const loShu = calculateLoShuYearStar(params.birthDate);
  const jdn = toJulianDayNumber(params.gameDate);
  const dailyCenterStar = jdn !== null ? (jdn % 9) + 1 : null;
  const fiveYellowPalace =
    dailyCenterStar !== null ? ((dailyCenterStar + 4 - 1) % 9) + 1 : null;

  let roadBearing: ReturnType<typeof calculateCompassBearing> = {
    bearingDeg: null,
    sector: null,
    loShuSectorNumber: null,
  };
  if (!params.isHome && homeStad && resolvedHost) {
    roadBearing = calculateCompassBearing(
      homeStad.lat,
      homeStad.lon,
      resolvedHost.lat,
      resolvedHost.lon,
    );
  }

  const isAuspiciousRoadBearing = Boolean(
    !params.isHome &&
      loShu &&
      roadBearing.sector &&
      ((loShu.group === 'EAST' && EAST_GROUP_SECTORS.has(roadBearing.sector)) ||
        (loShu.group === 'WEST' && WEST_GROUP_SECTORS.has(roadBearing.sector))),
  );
  const isInauspiciousRoadBearing = Boolean(
    !params.isHome && loShu && roadBearing.sector && !isAuspiciousRoadBearing,
  );
  const isFiveYellowTabooRoad = Boolean(
    !params.isHome &&
      roadBearing.loShuSectorNumber !== null &&
      fiveYellowPalace !== null &&
      roadBearing.loShuSectorNumber === fiveYellowPalace,
  );

  const openedYear = resolvedHost?.openedYear ?? 2000;
  const xuanKongPeriod =
    openedYear >= 2024 ? 9 : openedYear >= 2004 ? 8 : openedYear >= 1984 ? 7 : 6;

  return {
    loShuStar: loShu?.star ?? null,
    loShuGroup: loShu?.group ?? null,
    roadBearingDeg: roadBearing.bearingDeg,
    roadSector: roadBearing.sector,
    isAuspiciousRoadBearing,
    isInauspiciousRoadBearing,
    isFiveYellowTabooRoad,
    xuanKongPeriod,
  };
}

// ============================================================================
// 5. Hellenistic Planetary Ephemeris, Mayan Tzolk'in & Greco-Roman Onomancy
// ============================================================================

const CHALDEAN_WEEKDAY_RULERS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
] as const;

interface HellenisticObservables {
  readonly mercuryRetrograde: boolean;
  readonly venusRetrograde: boolean;
  readonly marsRetrograde: boolean;
  readonly weekdayRuler: string | null;
  readonly natalDomicileRuler: string | null;
  readonly isPlanetaryDayMatch: boolean;
  readonly jupiterReturnWindow: boolean;
  readonly jupiterTrineTransit: boolean;
  readonly saturnReturnWindow: boolean;
  readonly marsReturnWindow: boolean;
}

function extractHellenisticObservables(
  birthDateStr: string | null,
  gameDateStr: string | null,
): HellenisticObservables {
  const gameJdn = toJulianDayNumber(gameDateStr);
  const gameCal = parseStrictUtcCalendarDate(gameDateStr);
  const natalJdn = toJulianDayNumber(birthDateStr);
  const natalZodiac = getZodiacFromDate(birthDateStr);

  if (gameJdn === null || !gameCal) {
    return {
      mercuryRetrograde: false,
      venusRetrograde: false,
      marsRetrograde: false,
      weekdayRuler: null,
      natalDomicileRuler: natalZodiac ? PTOLEMAIC_SIGN_RULERS[natalZodiac.sign] ?? null : null,
      isPlanetaryDayMatch: false,
      jupiterReturnWindow: false,
      jupiterTrineTransit: false,
      saturnReturnWindow: false,
      marsReturnWindow: false,
    };
  }

  const gamePlanets = computeGeocentricPlanetsAtJd(gameJdn);
  const weekdayRuler = CHALDEAN_WEEKDAY_RULERS[gameCal.date.getUTCDay()];
  const natalDomicileRuler = natalZodiac
    ? PTOLEMAIC_SIGN_RULERS[natalZodiac.sign] ?? null
    : null;
  const isPlanetaryDayMatch = Boolean(
    natalDomicileRuler && natalDomicileRuler === weekdayRuler,
  );

  let jupiterReturnWindow = false;
  let jupiterTrineTransit = false;
  let saturnReturnWindow = false;
  let marsReturnWindow = false;

  if (natalJdn !== null) {
    const natalPlanets = computeGeocentricPlanetsAtJd(natalJdn);
    const ageYears = (gameJdn - natalJdn) / 365.2422;

    const jupAngle = shortestAngularDistance(
      Number(gamePlanets.jupiter.longitudeDeg.toFixed(2)),
      Number(natalPlanets.jupiter.longitudeDeg.toFixed(2)),
    );
    const satAngle = shortestAngularDistance(
      Number(gamePlanets.saturn.longitudeDeg.toFixed(2)),
      Number(natalPlanets.saturn.longitudeDeg.toFixed(2)),
    );
    const marsAngle = shortestAngularDistance(
      Number(gamePlanets.mars.longitudeDeg.toFixed(2)),
      Number(natalPlanets.mars.longitudeDeg.toFixed(2)),
    );

    jupiterReturnWindow = ageYears >= 10 && jupAngle <= 15;
    jupiterTrineTransit = Math.abs(jupAngle - 120) <= 12;
    saturnReturnWindow = ageYears >= 27 && ageYears <= 32 && satAngle <= 18;
    marsReturnWindow = marsAngle <= 12;
  }

  return {
    mercuryRetrograde: gamePlanets.mercury.isRetrograde,
    venusRetrograde: gamePlanets.venus.isRetrograde,
    marsRetrograde: gamePlanets.mars.isRetrograde,
    weekdayRuler,
    natalDomicileRuler,
    isPlanetaryDayMatch,
    jupiterReturnWindow,
    jupiterTrineTransit,
    saturnReturnWindow,
    marsReturnWindow,
  };
}

const MAYAN_NAHUALES = [
  'Imix', 'Ik', 'Akbal', 'Kan', 'Chicchan',
  'Cimi', 'Manik', 'Lamat', 'Muluc', 'Oc',
  'Chuen', 'Eb', 'Ben', 'Ix', 'Men',
  'Cib', 'Caban', 'Etznab', 'Cauac', 'Ajaw',
] as const;

const GAP_KIN_SET = new Set<number>([
  1, 20, 22, 39, 43, 50, 51, 58, 64, 69, 72, 77, 85, 88, 93, 96, 106, 107, 108, 109, 110, 111,
  112, 113, 114, 115, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 165, 168, 173, 176, 184,
  189, 192, 197, 203, 210, 211, 218, 222, 239, 241, 260,
]);

export type MayanDirection = 'East' | 'North' | 'West' | 'South';

export interface MayanTzolkinKin {
  readonly kinNumber: number;
  readonly tone: number;
  readonly nahualIndex: number;
  readonly nahualName: string;
  readonly direction: MayanDirection;
  readonly color: 'Red' | 'White' | 'Black' | 'Yellow';
  readonly isGapDay: boolean;
}

const MAYAN_DIRECTION_BY_MOD4: ReadonlyArray<{
  readonly direction: MayanDirection;
  readonly color: 'Red' | 'White' | 'Black' | 'Yellow';
}> = [
  { direction: 'East', color: 'Red' },
  { direction: 'North', color: 'White' },
  { direction: 'West', color: 'Black' },
  { direction: 'South', color: 'Yellow' },
];

export function getMayanTzolkinKin(dateStr?: string | null): MayanTzolkinKin | null {
  const jdn = toJulianDayNumber(dateStr);
  if (jdn === null) return null;
  const gmtOffset = (((jdn - 584283) % 260) + 260) % 260;
  const tone = ((gmtOffset + 3) % 13) + 1;
  const nahualIndex = (gmtOffset + 19) % 20;
  const kinNumber = ((gmtOffset + 159) % 260) + 1;
  const dirMeta = MAYAN_DIRECTION_BY_MOD4[nahualIndex % 4];
  return {
    kinNumber,
    tone,
    nahualIndex,
    nahualName: MAYAN_NAHUALES[nahualIndex],
    direction: dirMeta.direction,
    color: dirMeta.color,
    isGapDay: GAP_KIN_SET.has(kinNumber),
  };
}

interface MayanObservables {
  readonly natalKinNumber: number | null;
  readonly natalTone: number | null;
  readonly natalNahual: string | null;
  readonly isTone13Ascension: boolean;
  readonly isTone1Magnetic: boolean;
  readonly isGapGameDay: boolean;
  readonly isNatalNahualReturn: boolean;
  readonly isAnalogSupportDay: boolean;
  readonly isAntipodeChallengeDay: boolean;
  readonly isOppQbAntipode: boolean;
}

function extractMayanObservables(
  birthDateStr: string | null,
  gameDateStr: string | null,
  oppQbKin: MayanTzolkinKin | null,
): MayanObservables {
  const gameKin = getMayanTzolkinKin(gameDateStr);
  const natalKin = getMayanTzolkinKin(birthDateStr);
  if (!gameKin || !natalKin) {
    return {
      natalKinNumber: natalKin?.kinNumber ?? null,
      natalTone: natalKin?.tone ?? null,
      natalNahual: natalKin?.nahualName ?? null,
      isTone13Ascension: false,
      isTone1Magnetic: false,
      isGapGameDay: Boolean(gameKin?.isGapDay),
      isNatalNahualReturn: false,
      isAnalogSupportDay: false,
      isAntipodeChallengeDay: false,
      isOppQbAntipode: false,
    };
  }

  return {
    natalKinNumber: natalKin.kinNumber,
    natalTone: natalKin.tone,
    natalNahual: natalKin.nahualName,
    isTone13Ascension: gameKin.tone === 13 || natalKin.tone === gameKin.tone,
    isTone1Magnetic: gameKin.tone === 1,
    isGapGameDay: gameKin.isGapDay,
    isNatalNahualReturn: natalKin.nahualIndex === gameKin.nahualIndex,
    isAnalogSupportDay: (natalKin.nahualIndex + gameKin.nahualIndex) % 20 === 19,
    isAntipodeChallengeDay: Math.abs(natalKin.nahualIndex - gameKin.nahualIndex) === 10,
    isOppQbAntipode: Boolean(
      oppQbKin && Math.abs(natalKin.nahualIndex - oppQbKin.nahualIndex) === 10,
    ),
  };
}

const GREEK_ISOPSEPHY_MAP: Readonly<Record<string, number>> = {
  A: 1, B: 2, C: 3, G: 3, D: 4, E: 5, F: 6, V: 6, W: 6, Z: 7, H: 8,
  I: 10, J: 10, K: 20, L: 30, M: 40, N: 50, X: 60, O: 70, P: 80, Q: 90,
  R: 100, S: 200, T: 300, U: 400, Y: 400,
};

const PETOSIRIS_UPPER_HEMISPHERE = new Set<number>([
  1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 14, 16, 17, 19, 20, 22, 23, 26, 27,
]);

function computeGreekIsopsephy(nameStr?: string | null): { total: number; mod9: number } | null {
  if (!nameStr) return null;
  const clean = nameStr.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return null;
  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    total += GREEK_ISOPSEPHY_MAP[clean[i]] ?? 0;
  }
  const mod9 = total % 9 === 0 ? 9 : total % 9;
  return { total, mod9 };
}

function evaluatePythagoreanCombat(
  nameA?: string | null,
  nameB?: string | null,
): 'VICTOR' | 'DEFEATED' | 'DRAW' | null {
  const isoA = computeGreekIsopsephy(nameA);
  const isoB = computeGreekIsopsephy(nameB);
  if (!isoA || !isoB) return null;
  if (isoA.mod9 === isoB.mod9) return 'DRAW';
  if (isoA.mod9 % 2 === isoB.mod9 % 2) {
    return isoA.mod9 < isoB.mod9 ? 'VICTOR' : 'DEFEATED';
  }
  return isoA.mod9 > isoB.mod9 ? 'VICTOR' : 'DEFEATED';
}

interface OnomanticObservables {
  readonly combatOutcome: 'VICTOR' | 'DEFEATED' | 'DRAW' | null;
  readonly petosirisHemisphere: 'UPPER' | 'LOWER' | null;
}

function extractOnomanticObservables(params: {
  playerName: string | null;
  oppCombatantName: string | null;
  lunarPhaseAngleDeg: number | null;
}): OnomanticObservables {
  const playerIso = computeGreekIsopsephy(params.playerName);
  const combatOutcome =
    params.playerName && params.oppCombatantName
      ? evaluatePythagoreanCombat(params.playerName, params.oppCombatantName)
      : null;

  let petosirisHemisphere: 'UPPER' | 'LOWER' | null = null;
  if (
    playerIso &&
    typeof params.lunarPhaseAngleDeg === 'number' &&
    Number.isFinite(params.lunarPhaseAngleDeg)
  ) {
    const lunarDay1to30 = Math.min(
      30,
      Math.max(1, Math.floor(params.lunarPhaseAngleDeg / 12) + 1),
    );
    const sphereRem = (playerIso.total + lunarDay1to30) % 29 || 29;
    petosirisHemisphere = PETOSIRIS_UPPER_HEMISPHERE.has(sphereRem) ? 'UPPER' : 'LOWER';
  }

  return { combatOutcome, petosirisHemisphere };
}

// ============================================================================
// 6. Biorhythms, Pythagorean Numerology & Oracular Archetypes
// ============================================================================

interface BiorhythmObservables {
  readonly physical: number | null;
  readonly emotional: number | null;
  readonly intellectual: number | null;
  readonly isCriticalDay: boolean;
  readonly criticalCount: number;
}

function extractBiorhythmObservables(
  birthDateStr: string | null,
  gameDateStr: string | null,
  position: string,
): BiorhythmObservables {
  if (position.toUpperCase() === 'DEF') {
    return {
      physical: null,
      emotional: null,
      intellectual: null,
      isCriticalDay: false,
      criticalCount: 0,
    };
  }
  const bCal = parseStrictUtcCalendarDate(birthDateStr);
  const gCal = parseStrictUtcCalendarDate(gameDateStr);
  if (!bCal || !gCal) {
    return {
      physical: null,
      emotional: null,
      intellectual: null,
      isCriticalDay: false,
      criticalCount: 0,
    };
  }
  const daysElapsed = Math.round(
    (gCal.date.getTime() - bCal.date.getTime()) / 86400000,
  );
  if (daysElapsed < 0) {
    return {
      physical: null,
      emotional: null,
      intellectual: null,
      isCriticalDay: false,
      criticalCount: 0,
    };
  }

  const physical = Math.sin((2 * Math.PI * daysElapsed) / 23);
  const emotional = Math.sin((2 * Math.PI * daysElapsed) / 28);
  const intellectual = Math.sin((2 * Math.PI * daysElapsed) / 33);

  let criticalCount = 0;
  for (const period of [23, 28, 33]) {
    const mod = ((daysElapsed % period) + period) % period;
    const dist = Math.min(mod, period - mod, Math.abs(mod - period / 2));
    if (dist <= 0.5 + 1e-12) criticalCount += 1;
  }

  return {
    physical,
    emotional,
    intellectual,
    isCriticalDay: criticalCount > 0,
    criticalCount,
  };
}

export function digitalRoot(n: number, preserveMasters = true): number {
  let num = Math.abs(Math.floor(n));
  if (preserveMasters && (num === 11 || num === 22 || num === 33)) return num;
  while (num >= 10) {
    if (preserveMasters && (num === 11 || num === 22 || num === 33)) return num;
    num = String(num)
      .split('')
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return num;
}

export function calculateLifePath(birthDateStr?: string | null): number | null {
  if (!birthDateStr) return null;
  const digits = birthDateStr.replace(/\D/g, '');
  if (!digits) return null;
  const sum = digits.split('').reduce((acc, d) => acc + Number(d), 0);
  return digitalRoot(sum, true);
}

function classifyNumberResonance(
  a: number | null,
  b: number | null,
): 'exact' | 'harmonic' | 'discordant' | null {
  if (a === null || b === null) return null;
  const rA = digitalRoot(a, false);
  const rB = digitalRoot(b, false);
  if (a === b || rA === rB) return 'exact';
  if (rA + rB === 10 || Math.abs(rA - rB) === 3) return 'harmonic';
  return 'discordant';
}

interface NumerologyObservables {
  readonly lifePath: number | null;
  readonly isMasterLifePath: boolean;
  readonly jerseyRoot: number | null;
  readonly dateResonance: 'exact' | 'harmonic' | 'discordant' | null;
  readonly jerseyResonance: 'exact' | 'harmonic' | 'discordant' | null;
  readonly seasonResonance: 'exact' | 'harmonic' | 'discordant' | null;
}

function extractNumerologyObservables(params: {
  birthDate: string | null;
  jerseyNumber: number | null;
  season: number;
  gameDate: string | null;
}): NumerologyObservables {
  const lifePath = calculateLifePath(params.birthDate);
  const jerseyVal = params.jerseyNumber;
  const jerseyRoot =
    typeof jerseyVal === 'number' && Number.isFinite(jerseyVal) && jerseyVal >= 0
      ? digitalRoot(jerseyVal, false)
      : null;
  const seasonRoot = digitalRoot(params.season, false);

  let gameDateRoot: number | null = null;
  if (params.gameDate) {
    const digits = params.gameDate.replace(/\D/g, '');
    if (digits) {
      gameDateRoot = digitalRoot(
        digits.split('').reduce((s, d) => s + Number(d), 0),
        false,
      );
    }
  }

  return {
    lifePath,
    isMasterLifePath: lifePath === 11 || lifePath === 22 || lifePath === 33,
    jerseyRoot,
    dateResonance: classifyNumberResonance(lifePath, gameDateRoot),
    jerseyResonance: classifyNumberResonance(lifePath, jerseyRoot),
    seasonResonance: classifyNumberResonance(lifePath, seasonRoot),
  };
}

const MAJOR_ARCANA: ReadonlyArray<{
  readonly number: number;
  readonly name: string;
  readonly element: ElementType;
}> = [
  { number: 0, name: 'The Fool', element: 'Air' },
  { number: 1, name: 'The Magician', element: 'Air' },
  { number: 2, name: 'The High Priestess', element: 'Water' },
  { number: 3, name: 'The Empress', element: 'Earth' },
  { number: 4, name: 'The Emperor', element: 'Fire' },
  { number: 5, name: 'The Hierophant', element: 'Earth' },
  { number: 6, name: 'The Lovers', element: 'Air' },
  { number: 7, name: 'The Chariot', element: 'Water' },
  { number: 8, name: 'Strength', element: 'Fire' },
  { number: 9, name: 'The Hermit', element: 'Earth' },
  { number: 10, name: 'Wheel of Fortune', element: 'Fire' },
  { number: 11, name: 'Justice', element: 'Air' },
  { number: 12, name: 'The Hanged Man', element: 'Water' },
  { number: 13, name: 'Death', element: 'Water' },
  { number: 14, name: 'Temperance', element: 'Fire' },
  { number: 15, name: 'The Devil', element: 'Earth' },
  { number: 16, name: 'The Tower', element: 'Fire' },
  { number: 17, name: 'The Star', element: 'Air' },
  { number: 18, name: 'The Moon', element: 'Water' },
  { number: 19, name: 'The Sun', element: 'Fire' },
  { number: 20, name: 'Judgement', element: 'Fire' },
  { number: 21, name: 'The World', element: 'Earth' },
];

type FortuneTier = 'Great' | 'Favorable' | 'Neutral' | 'Challenging';

const HEXAGRAM_FORTUNE_TIERS: readonly FortuneTier[] = [
  'Great', 'Favorable', 'Neutral', 'Challenging', 'Favorable', 'Challenging', 'Favorable', 'Great',
  'Favorable', 'Neutral', 'Great', 'Challenging', 'Great', 'Great', 'Favorable', 'Great',
  'Favorable', 'Neutral', 'Great', 'Neutral', 'Favorable', 'Favorable', 'Challenging', 'Great',
  'Favorable', 'Great', 'Favorable', 'Neutral', 'Challenging', 'Great', 'Favorable', 'Favorable',
  'Neutral', 'Great', 'Great', 'Challenging', 'Favorable', 'Challenging', 'Challenging', 'Great',
  'Neutral', 'Great', 'Great', 'Neutral', 'Great', 'Great', 'Challenging', 'Favorable',
  'Great', 'Great', 'Favorable', 'Neutral', 'Favorable', 'Challenging', 'Great', 'Neutral',
  'Favorable', 'Great', 'Neutral', 'Favorable', 'Great', 'Neutral', 'Favorable', 'Favorable',
];

export interface OracularObservables {
  readonly tarotName: string | null;
  readonly tarotElement: ElementType | null;
  readonly hexagramNumber: number | null;
  readonly hexagramFortuneTier: FortuneTier | null;
}

export function extractOracularObservables(
  birthDateStr: string | null,
  seasonYear: number,
  weekNumber: number,
): OracularObservables {
  if (!birthDateStr) {
    return {
      tarotName: null,
      tarotElement: null,
      hexagramNumber: null,
      hexagramFortuneTier: null,
    };
  }
  const digits = birthDateStr.replace(/\D/g, '');
  if (!digits) {
    return {
      tarotName: null,
      tarotElement: null,
      hexagramNumber: null,
      hexagramFortuneTier: null,
    };
  }
  const birthSum = digits.split('').reduce((s, d) => s + Number(d), 0);
  const tarot = MAJOR_ARCANA[birthSum % 22];
  const hexIdx = (seasonYear * 100 + weekNumber * 7 + birthSum) % 64;
  return {
    tarotName: tarot.name,
    tarotElement: tarot.element,
    hexagramNumber: hexIdx + 1,
    hexagramFortuneTier: HEXAGRAM_FORTUNE_TIERS[hexIdx],
  };
}

// ============================================================================
// 7. 25 Pure Esoteric Predictive Systems & Zero-Dataset Scoring Engine
// ============================================================================

export interface EvalRow {
  readonly playerId: string;
  readonly playerName: string;
  readonly position: NFLPosition;
  readonly birthDate: string | null;
  readonly jerseyNumber: number | null;
  readonly team: string | null;
  readonly opponent: string | null;
  readonly isHome: boolean;
  readonly hostTeam?: string | null;
  readonly stadiumId?: string | null;
  readonly kickoffUtc?: string | null;
  readonly season: number;
  readonly week: number;
  readonly gameDate: string;
  readonly projectedPts?: number | null;
  readonly actualPts?: number | null;
  readonly projStats?: Readonly<Record<string, number>> | null;
  readonly actualStats?: Readonly<Record<string, number>> | null;
  readonly teamRoster?: ReadonlyArray<UnitPlayerInput | { readonly player: UnitPlayerInput }>;
  readonly opponentRoster?: ReadonlyArray<UnitPlayerInput | { readonly player: UnitPlayerInput }>;
}

export interface EvalContext {
  readonly hostStadium: StadiumRecord | null;
  readonly medievalGeomancy: MedievalGeomancyObservables;
  readonly witchcraft: WitchcraftObservables;
  readonly runesOgham: RunesOghamObservables;
  readonly kabbalah: KabbalahGematriaObservables;
  readonly celestial: CelestialObservables;
  readonly numerology: NumerologyObservables;
  readonly oracular: OracularObservables;
  readonly biorhythm: BiorhythmObservables;
  readonly bazi: BaZiObservables;
  readonly directionalGeomancy: DirectionalGeomancyObservables;
  readonly hellenistic: HellenisticObservables;
  readonly mayan: MayanObservables;
  readonly onomancy: OnomanticObservables;
  readonly vedic: VedicJyotishObservables;
  readonly contestHorary: ContestHoraryObservables;
  readonly progressions: SecondaryProgressionObservables;
  readonly cosmobiology: CosmobiologyObservables;
  readonly profections: AnnualProfectionObservables;
  readonly arabicManazil: ArabicManazilSectObservables;
  readonly fixedStars: FixedStarObservables;
  readonly decansModality: DecanModalityObservables;
  readonly rokuyoTenchusatsu: RokuyoTenchusatsuObservables;
  readonly planetarySynastry: PlanetarySynastryObservables;
  readonly mySynergy: UnitSynergyState;
  readonly oppSynergy: UnitSynergyState;
  readonly myWuXing: ReturnType<typeof extractRosterDominantWuXing>;
  readonly oppWuXing: ReturnType<typeof extractRosterDominantWuXing>;
  readonly offenseWuXingRelation: WuXingRelation | null;
  readonly synergyRegime: SynergyRegime;
  readonly playerStack: ReturnType<typeof extractPlayerStackState>;
  readonly playerElement: ElementType | null;
  readonly myDominantElement: ElementType | null;
  readonly oppDominantElement: ElementType | null;
}

export interface PredictiveConditionDefinition {
  readonly id: string;
  readonly label?: string;
  readonly eligible?: (row: EvalRow, ctx: EvalContext) => boolean;
  readonly test: (row: EvalRow, ctx: EvalContext) => boolean;
}

export interface PredictiveSystemPlugin {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly clusterBy: 'gameId' | 'gameDate' | 'playerId';
  readonly description: string;
  readonly conditions: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly eligible: (row: EvalRow, ctx: EvalContext) => boolean;
    readonly test: (row: EvalRow, ctx: EvalContext) => boolean;
  }>;
  readonly evaluateActiveConditions: (
    row: EvalRow,
    ctx: EvalContext,
  ) => ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly eligible: (row: EvalRow, ctx: EvalContext) => boolean;
    readonly test: (row: EvalRow, ctx: EvalContext) => boolean;
  }>;
}

export interface CustomPredictiveSystemSpec {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly clusterBy?: 'gameId' | 'gameDate' | 'playerId';
  readonly description?: string;
  readonly conditions: readonly PredictiveConditionDefinition[];
}

export function createPredictiveSystem(spec: CustomPredictiveSystemSpec): PredictiveSystemPlugin {
  if (!spec.id || !spec.name || spec.conditions.length === 0) {
    throw new Error(`Invalid predictive system specification for "${spec.id || 'unknown'}".`);
  }
  const normalized = spec.conditions.map((cond) => ({
    id: cond.id,
    label: cond.label || cond.id,
    eligible: cond.eligible ?? (() => true),
    test: cond.test,
  }));
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category || 'Custom Predictive System',
    clusterBy: spec.clusterBy || 'gameId',
    description: spec.description || '',
    conditions: normalized,
    evaluateActiveConditions(row: EvalRow, ctx: EvalContext) {
      return normalized.filter((c) => c.eligible(row, ctx) && c.test(row, ctx));
    },
  };
}

function extractUnitLeaderMeta(
  roster: ReadonlyArray<UnitPlayerInput | UnitSlotWrapper>,
  fallbackTeam?: string | null,
): { qbName: string | null; qbBirthDate: string | null; qbMayanKin: MayanTzolkinKin | null } {
  let qb: UnitPlayerInput | null = null;
  for (const item of roster) {
    const p = unwrapUnitPlayer(item);
    if (!p) continue;
    if (String(p.position || p.pos || '').toUpperCase() === 'QB') {
      qb = p;
      break;
    }
  }
  const oppStad = fallbackTeam ? getStadiumForTeam(fallbackTeam) : null;
  const qbName = qb?.playerName || qb?.name || oppStad?.city || fallbackTeam || null;
  const qbBirthDate = qb?.birthDate || null;
  const qbMayanKin = qbBirthDate ? getMayanTzolkinKin(qbBirthDate) : null;
  return { qbName, qbBirthDate, qbMayanKin };
}

export function extractMatchupObservableContext(
  row: EvalRow,
  overrideSelfElement?: ElementType | null,
): EvalContext {
  const normTeam = normalizeNflTeamCode(row.team);
  const normOpp = normalizeNflTeamCode(row.opponent);
  const selfUnitItem: UnitPlayerInput = {
    id: row.playerId,
    playerId: row.playerId,
    name: row.playerName,
    playerName: row.playerName,
    position: row.position,
    team: normTeam,
    birthDate: row.birthDate,
    element: overrideSelfElement ?? null,
  };

  const teamRoster =
    row.teamRoster && row.teamRoster.length > 0 ? row.teamRoster : [selfUnitItem];
  const opponentRoster = row.opponentRoster ?? [];

  const mySynergy = extractUnitSynergy(teamRoster);
  const oppSynergy = extractUnitSynergy(opponentRoster);
  const myWuXing = extractRosterDominantWuXing(teamRoster);
  const oppWuXing = extractRosterDominantWuXing(opponentRoster);
  const myLeader = extractUnitLeaderMeta(teamRoster, normTeam);
  const oppLeader = extractUnitLeaderMeta(opponentRoster, normOpp);

  const resolvedHostStadium =
    (row.stadiumId && NFL_STADIUMS[String(row.stadiumId).toUpperCase()]) ||
    (row.hostTeam ? getStadiumForTeam(row.hostTeam) : null) ||
    (row.isHome
      ? normTeam
        ? getStadiumForTeam(normTeam)
        : null
      : normOpp
        ? getStadiumForTeam(normOpp)
        : null) ||
    null;

  const resolvedSeason =
    row.season || (row.gameDate ? Number(String(row.gameDate).slice(0, 4)) : 2026);
  const celestial = extractCelestialObservables(row.birthDate, row.gameDate);
  const medievalGeomancy = extractMedievalGeomancyObservables({
    birthDate: row.birthDate,
    gameDate: row.gameDate,
    playerName: row.playerName || null,
    team: normTeam,
    opponent: normOpp,
  });
  const witchcraft = extractWitchcraftObservables(row.gameDate);
  const runesOgham = extractRunesOghamObservables(row.birthDate, row.gameDate);
  const kabbalah = extractKabbalahGematriaObservables({
    playerName: row.playerName || null,
    birthDate: row.birthDate,
    gameDate: row.gameDate,
    qbName: myLeader.qbName,
    qbBirthDate: myLeader.qbBirthDate,
  });
  const numerology = extractNumerologyObservables({
    birthDate: row.birthDate,
    jerseyNumber: row.jerseyNumber,
    season: resolvedSeason,
    gameDate: row.gameDate,
  });
  const oracular = extractOracularObservables(row.birthDate, resolvedSeason, row.week || 1);
  const biorhythm = extractBiorhythmObservables(row.birthDate, row.gameDate, row.position);
  const bazi = extractBaZiObservables(row.birthDate, row.gameDate, oppWuXing.qbDayPillar);
  const directionalGeomancy = extractDirectionalGeomancyObservables({
    birthDate: row.birthDate,
    gameDate: row.gameDate,
    team: normTeam,
    opponent: normOpp,
    isHome: row.isHome,
    hostStadium: resolvedHostStadium,
  });
  const hellenistic = extractHellenisticObservables(row.birthDate, row.gameDate);
  const mayan = extractMayanObservables(row.birthDate, row.gameDate, oppLeader.qbMayanKin);
  const onomancy = extractOnomanticObservables({
    playerName: row.playerName || null,
    oppCombatantName: oppLeader.qbName,
    lunarPhaseAngleDeg: celestial.lunarPhase?.phaseAngleDeg ?? null,
  });
  const vedic = extractVedicJyotishObservables(row.birthDate, row.gameDate);
  const contestHorary = extractContestHoraryObservables({
    isHome: row.isHome,
    hostStadium: resolvedHostStadium,
    gameDate: row.gameDate,
    kickoffUtc: row.kickoffUtc ?? null,
    natalDomicileRuler: hellenistic.natalDomicileRuler,
  });
  const progressions = extractSecondaryProgressionObservables(row.birthDate, row.gameDate);
  const cosmobiology = extractCosmobiologyObservables(row.birthDate, row.gameDate);
  const profections = extractAnnualProfectionObservables(row.birthDate, row.gameDate);
  const arabicManazil = extractArabicManazilSectObservables({
    birthDate: row.birthDate,
    gameDate: row.gameDate,
    hostStadium: resolvedHostStadium,
    kickoffUtc: row.kickoffUtc ?? null,
  });
  const fixedStars = extractFixedStarObservables(row.birthDate, row.gameDate);
  const decansModality = extractDecanModalityObservables(
    row.birthDate,
    row.gameDate,
    myLeader.qbBirthDate,
  );
  const rokuyoTenchusatsu = extractRokuyoTenchusatsuObservables(row.birthDate, row.gameDate);
  const planetarySynastry = extractPlanetarySynastryObservables({
    birthDate: row.birthDate,
    gameDate: row.gameDate,
    myQbBirthDate: myLeader.qbBirthDate,
    oppQbBirthDate: oppLeader.qbBirthDate,
  });

  const playerStack = extractPlayerStackState(selfUnitItem, teamRoster);
  const synergyRegime = classifySynergyMatchupRegime(mySynergy, oppSynergy);
  const offenseWuXingRelation = classifyWuXingRelation(
    myWuXing.dominantWuXing,
    oppWuXing.dominantWuXing,
  );

  return {
    hostStadium: resolvedHostStadium,
    medievalGeomancy,
    witchcraft,
    runesOgham,
    kabbalah,
    celestial,
    numerology,
    oracular,
    biorhythm,
    bazi,
    directionalGeomancy,
    hellenistic,
    mayan,
    onomancy,
    vedic,
    contestHorary,
    progressions,
    cosmobiology,
    profections,
    arabicManazil,
    fixedStars,
    decansModality,
    rokuyoTenchusatsu,
    planetarySynastry,
    mySynergy,
    oppSynergy,
    myWuXing,
    oppWuXing,
    offenseWuXingRelation,
    synergyRegime,
    playerStack,
    playerElement: celestial.zodiac?.element ?? overrideSelfElement ?? null,
    myDominantElement: mySynergy.dominantElement,
    oppDominantElement: oppSynergy.dominantElement,
  };
}

interface ConditionRule {
  readonly id: string;
  readonly eligible: (row: EvalRow, ctx: EvalContext) => boolean;
  readonly test: (row: EvalRow, ctx: EvalContext) => boolean;
}

const isOffenseOrKicker = (r: EvalRow): boolean => r.position !== 'DEF';
const isDefense = (r: EvalRow): boolean => r.position === 'DEF';
const hasNatalDate = (r: EvalRow): boolean => r.position !== 'DEF' && Boolean(r.birthDate);
const isPassCatcherWithBirth = (r: EvalRow, c: EvalContext): boolean =>
  (r.position === 'WR' || r.position === 'TE') &&
  Boolean(r.birthDate) &&
  Boolean(c.playerStack.qbSynastry);

const OFFENSE_VS_OFFENSE_RULES: ConditionRule[] = [];
for (const myEl of WESTERN_ELEMENTS) {
  for (const oppEl of WESTERN_ELEMENTS) {
    OFFENSE_VS_OFFENSE_RULES.push({
      id: `OFF_ELEM_${myEl.toUpperCase()}_VS_${oppEl.toUpperCase()}`,
      eligible: (r, c) =>
        isOffenseOrKicker(r) && Boolean(c.myDominantElement) && Boolean(c.oppDominantElement),
      test: (_r, c) => c.myDominantElement === myEl && c.oppDominantElement === oppEl,
    });
  }
}

export const SYSTEM_CONDITION_RULES: Readonly<Record<PredictorSystemId, readonly ConditionRule[]>> = {
  team_synergy: [
    { id: 'UNIT_HIGH_HARMONY_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.mySynergy.hasHighUnitSynergy },
    { id: 'REGIME_DOMINANCE_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.synergyRegime === 'DOMINANCE' },
    { id: 'REGIME_SHOOTOUT_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.synergyRegime === 'SHOOTOUT' },
    { id: 'REGIME_DEFICIT_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.synergyRegime === 'DEFICIT' },
    { id: 'REGIME_SLUGFEST_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.synergyRegime === 'SLUGFEST' },
    { id: 'DEF_VS_FRACTURED_OFFENSE', eligible: isDefense, test: (_r, c) => !c.oppSynergy.hasHighUnitSynergy },
    { id: 'DEF_VS_HIGH_HARMONY_OFFENSE', eligible: isDefense, test: (_r, c) => c.oppSynergy.hasHighUnitSynergy },
    { id: 'QB_ELEMENT_ALIGNMENT_UNIT', eligible: isOffenseOrKicker, test: (_r, c) => c.mySynergy.hasQbElementAlignment },
    { id: 'ELEMENT_CLUSTER_UNIT', eligible: isOffenseOrKicker, test: (_r, c) => c.mySynergy.hasElementCluster },
    { id: 'WESTERN_TRINE_UNIT', eligible: isOffenseOrKicker, test: (_r, c) => c.mySynergy.hasWesternTrine },
    { id: 'QUAD_BALANCE_UNIT', eligible: isOffenseOrKicker, test: (_r, c) => c.mySynergy.hasQuadBalance },
  ],
  elemental_matchup: [
    { id: 'NATAL_ELEMENT_FIRE', eligible: hasNatalDate, test: (_r, c) => c.playerElement === 'Fire' },
    { id: 'NATAL_ELEMENT_EARTH', eligible: hasNatalDate, test: (_r, c) => c.playerElement === 'Earth' },
    { id: 'NATAL_ELEMENT_AIR', eligible: hasNatalDate, test: (_r, c) => c.playerElement === 'Air' },
    { id: 'NATAL_ELEMENT_WATER', eligible: hasNatalDate, test: (_r, c) => c.playerElement === 'Water' },
    { id: 'QB_REC_TRINE_SAME', eligible: isPassCatcherWithBirth, test: (_r, c) => c.playerStack.qbSynastry === 'trine_same_element' },
    { id: 'QB_REC_SEXTILE_COMPAT', eligible: isPassCatcherWithBirth, test: (_r, c) => c.playerStack.qbSynastry === 'sextile_compatible' },
    { id: 'QB_REC_CROSS_POLARITY', eligible: isPassCatcherWithBirth, test: (_r, c) => c.playerStack.qbSynastry === 'cross_polarity' },
    { id: 'SOLAR_SEASON_SAME_ELEMENT', eligible: hasNatalDate, test: (_r, c) => Boolean(c.playerElement) && c.playerElement === c.celestial.gameSunZodiac?.element },
    ...OFFENSE_VS_OFFENSE_RULES,
  ],
  planetary_synastry: [
    { id: 'NATAL_MARS_JUPITER_CHAMPION_ASPECT', eligible: hasNatalDate, test: (_r, c) => c.planetarySynastry.isNatalMarsJupiterHarmonic },
    { id: 'NATAL_SUN_MARS_DYNAMIC_ASPECT', eligible: hasNatalDate, test: (_r, c) => c.planetarySynastry.isNatalSunMarsDynamic },
    { id: 'QB_REC_BENEFIC_PLANETARY_SYNASTRY', eligible: (r, c) => (r.position === 'WR' || r.position === 'TE') && c.planetarySynastry.hasQbPlanetSynastry, test: (_r, c) => c.planetarySynastry.isQbRecBeneficSynastry },
    { id: 'QB_REC_SATURN_HARD_FRICTION', eligible: (r, c) => (r.position === 'WR' || r.position === 'TE') && c.planetarySynastry.hasQbPlanetSynastry, test: (_r, c) => c.planetarySynastry.isQbRecSaturnFriction },
    { id: 'ADVERSARIAL_MARS_VS_OPP_QB', eligible: hasNatalDate, test: (_r, c) => c.planetarySynastry.isAdversarialMarsVsOppQb },
    { id: 'TRANSIT_MARS_NATAL_IGNITION', eligible: hasNatalDate, test: (_r, c) => c.planetarySynastry.isTransitMarsIgnition },
  ],
  solar_lunar_transits: [
    { id: 'SOLAR_CONJUNCTION', eligible: hasNatalDate, test: (_r, c) => c.celestial.aspectType === 'Conjunction' },
    { id: 'SOLAR_TRINE', eligible: hasNatalDate, test: (_r, c) => c.celestial.aspectType === 'Trine' },
    { id: 'SOLAR_SEXTILE', eligible: hasNatalDate, test: (_r, c) => c.celestial.aspectType === 'Sextile' },
    { id: 'SOLAR_SQUARE', eligible: hasNatalDate, test: (_r, c) => c.celestial.aspectType === 'Square' },
    { id: 'SOLAR_OPPOSITION', eligible: hasNatalDate, test: (_r, c) => c.celestial.aspectType === 'Opposition' },
    { id: 'LUNAR_FULL_MOON', eligible: isOffenseOrKicker, test: (_r, c) => Boolean(c.celestial.lunarPhase?.isFullMoon) },
    { id: 'LUNAR_NEW_MOON', eligible: isOffenseOrKicker, test: (_r, c) => Boolean(c.celestial.lunarPhase?.isNewMoon) },
    { id: 'LUNAR_VOID_OF_COURSE', eligible: isOffenseOrKicker, test: (_r, c) => Boolean(c.celestial.lunarPhase?.isVoidOfCourse) },
    { id: 'LUNAR_PERIGEE', eligible: isOffenseOrKicker, test: (_r, c) => Boolean(c.celestial.lunarPhase?.isPerigee) },
    { id: 'LUNAR_APOGEE', eligible: isOffenseOrKicker, test: (_r, c) => Boolean(c.celestial.lunarPhase?.isApogee) },
    { id: 'LUNAR_SUPERMOON', eligible: isOffenseOrKicker, test: (_r, c) => Boolean(c.celestial.lunarPhase?.isSupermoon) },
  ],
  witchcraft_sabbats_esbats: [
    { id: 'WITCH_SAMHAIN_CROSS_QUARTER', eligible: isOffenseOrKicker, test: (_r, c) => c.witchcraft.isSamhainVeilWindow },
    { id: 'WITCH_MABON_OR_YULE_SOLAR_TIDE', eligible: isOffenseOrKicker, test: (_r, c) => c.witchcraft.isMabonOrYuleTide },
    { id: 'WITCH_HEKATE_DARK_MOON', eligible: isOffenseOrKicker, test: (_r, c) => c.witchcraft.isHekateDarkMoon },
    { id: 'WITCH_DIANA_WAXING_CRESCENT', eligible: isOffenseOrKicker, test: (_r, c) => c.witchcraft.isDianaWaxingCrescent },
    { id: 'WITCH_BLOOD_ECLIPSE_ESBAT', eligible: isOffenseOrKicker, test: (_r, c) => c.witchcraft.isBloodEclipseEsbat },
    { id: 'WITCH_COVEN_13TH_DAY_TABOO', eligible: isOffenseOrKicker, test: (_r, c) => c.witchcraft.isCoven13thDay },
  ],
  medieval_geomancy: [
    { id: 'GEOMANCY_JUDGE_FORTUNA_ACQUISITIO', eligible: () => true, test: (_r, c) => c.medievalGeomancy.isJudgeFortunaAcquisitio },
    { id: 'GEOMANCY_JUDGE_CARCER_AMISSIO', eligible: () => true, test: (_r, c) => c.medievalGeomancy.isJudgeCarcerAmissio },
    { id: 'GEOMANCY_QUERENT_WITNESS_BENEFIC', eligible: isOffenseOrKicker, test: (_r, c) => c.medievalGeomancy.isQuerentWitnessBenefic },
    { id: 'GEOMANCY_QUERENT_PUER_MARTIAL', eligible: isOffenseOrKicker, test: (_r, c) => c.medievalGeomancy.isQuerentPuerMartial },
    { id: 'GEOMANCY_RUBEUS_CAUDA_HAZARD', eligible: isOffenseOrKicker, test: (_r, c) => c.medievalGeomancy.isRubeusOrCaudaHazard },
    { id: 'GEOMANCY_VIA_PUNCTI_PASSATION', eligible: isOffenseOrKicker, test: (_r, c) => c.medievalGeomancy.hasViaPunctiPassation },
  ],
  runes_ogham: [
    { id: 'RUNE_NATAL_FREYRS_AETT', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.natalAett === 'Freyr' },
    { id: 'RUNE_NATAL_HAGALS_AETT', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.natalAett === 'Hagal' },
    { id: 'RUNE_NATAL_TYRS_AETT', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.natalAett === 'Tyr' },
    { id: 'RUNE_WYRD_VICTORY_STAVE', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.isWyrdVictoryRune },
    { id: 'RUNE_WYRD_HAGAL_DISRUPTION', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.isWyrdDisruptionRune },
    { id: 'OGHAM_WARRIOR_SOVEREIGN_TREE', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.isNatalWarriorOgham },
    { id: 'OGHAM_WHEEL_HARMONIC_GAME', eligible: hasNatalDate, test: (_r, c) => c.runesOgham.isOghamWheelResonance },
  ],
  kabbalah_gematria: [
    { id: 'KABBALAH_PILLAR_OF_MERCY_NATAL', eligible: hasNatalDate, test: (_r, c) => c.kabbalah.natalPillar === 'MERCY' },
    { id: 'KABBALAH_PILLAR_OF_SEVERITY_NATAL', eligible: hasNatalDate, test: (_r, c) => c.kabbalah.natalPillar === 'SEVERITY' },
    { id: 'KABBALAH_NETZACH_TIFERET_TRANSIT', eligible: hasNatalDate, test: (_r, c) => c.kabbalah.isNetzachOrTiferetTransit },
    { id: 'KABBALAH_GEVURAH_BINAH_TRANSIT', eligible: hasNatalDate, test: (_r, c) => c.kabbalah.isGevurahOrBinahTransit },
    { id: 'KABBALAH_SHEM_72_QUINARY_HARMONIC', eligible: hasNatalDate, test: (_r, c) => c.kabbalah.isShem72QuinaryResonance },
    { id: 'KABBALAH_QB_REC_SAME_PILLAR', eligible: isPassCatcherWithBirth, test: (_r, c) => c.kabbalah.isQbSameKabbalahPillar },
  ],
  vedic_jyotish: [
    { id: 'JYOTISH_SADHANA_PARAMA_TARA', eligible: hasNatalDate, test: (_r, c) => c.vedic.isSadhanaOrParamaTara },
    { id: 'JYOTISH_MALEFIC_TARA_HAZARD', eligible: hasNatalDate, test: (_r, c) => c.vedic.isMaleficTaraHazard },
    { id: 'JYOTISH_CHANDRASHTAMA_8TH_MOON', eligible: hasNatalDate, test: (_r, c) => c.vedic.isChandrashtama8thMoon },
    { id: 'JYOTISH_UPACHAYA_VICTORY_MOON', eligible: hasNatalDate, test: (_r, c) => c.vedic.isUpachayaVictoryMoon },
    { id: 'JYOTISH_KSHIPRA_SWIFT_MOON', eligible: isOffenseOrKicker, test: (_r, c) => c.vedic.isKshipraSwiftMoon },
    { id: 'JYOTISH_NATAL_SIDEREAL_MARS_STRONG', eligible: hasNatalDate, test: (_r, c) => c.vedic.isNatalSiderealMarsStrong },
  ],
  contest_horary: [
    { id: 'HORARY_LORD_DIGNITY_ADVANTAGE', eligible: isOffenseOrKicker, test: (_r, c) => c.contestHorary.hasLordDignityAdvantage },
    { id: 'HORARY_LORD_DIGNITY_DEFICIT', eligible: isOffenseOrKicker, test: (_r, c) => c.contestHorary.hasLordDignityDeficit },
    { id: 'HORARY_TEAM_LORD_AFFLICTED', eligible: isOffenseOrKicker, test: (_r, c) => c.contestHorary.isMyHouseLordAfflicted },
    { id: 'HORARY_DEF_LORD_ADVANTAGE', eligible: isDefense, test: (_r, c) => c.contestHorary.hasLordDignityAdvantage },
    { id: 'HORARY_VIA_COMBUSTA_MOON', eligible: isOffenseOrKicker, test: (_r, c) => c.contestHorary.isViaCombustaMoon },
    { id: 'HORARY_PLANETARY_HOUR_NATAL_MATCH', eligible: hasNatalDate, test: (_r, c) => c.contestHorary.isPlanetaryHourNatalMatch },
    { id: 'HORARY_MARTIAL_JOVIAL_HOUR', eligible: isOffenseOrKicker, test: (_r, c) => c.contestHorary.isMartialOrJovialHour },
  ],
  secondary_progressions: [
    { id: 'PROG_SUN_MARS_HARMONIC', eligible: hasNatalDate, test: (_r, c) => c.progressions.isProgSunMarsHarmonic },
    { id: 'PROG_SUN_MARS_HARD_ASPECT', eligible: hasNatalDate, test: (_r, c) => c.progressions.isProgSunMarsHardAspect },
    { id: 'PROG_MOON_WAXING_PHASE', eligible: hasNatalDate, test: (_r, c) => c.progressions.isProgMoonWaxing },
    { id: 'PROG_LUNAR_RETURN_WINDOW', eligible: hasNatalDate, test: (_r, c) => c.progressions.isProgLunarReturnWindow },
    { id: 'PROG_SUN_SIGN_INGRESS', eligible: hasNatalDate, test: (_r, c) => c.progressions.hasProgSunIngressedSign },
    { id: 'PROG_TRANSIT_SUN_CONJ_PROG_SUN', eligible: hasNatalDate, test: (_r, c) => c.progressions.isTransitSunConjProgSun },
  ],
  cosmobiology_midpoints: [
    { id: 'COSMO_MARS_JUPITER_VICTORY_DIAL', eligible: hasNatalDate, test: (_r, c) => c.cosmobiology.isMarsJupiterVictoryDial },
    { id: 'COSMO_SUN_MARS_VITALITY_DIAL', eligible: hasNatalDate, test: (_r, c) => c.cosmobiology.isSunMarsVitalityDial },
    { id: 'COSMO_MARS_SATURN_ATTRITION_DIAL', eligible: hasNatalDate, test: (_r, c) => c.cosmobiology.isMarsSaturnAttritionDial },
    { id: 'HARMONIC_5TH_QUINTILE_FLOW', eligible: hasNatalDate, test: (_r, c) => c.cosmobiology.isHarmonic5QuintileFlow },
    { id: 'HARMONIC_7TH_SEPTILE_RESONANCE', eligible: hasNatalDate, test: (_r, c) => c.cosmobiology.isHarmonic7SeptileResonance },
    { id: 'NODAL_RETURN_OR_HALF_RETURN', eligible: hasNatalDate, test: (_r, c) => c.cosmobiology.isNodalReturnOrReverse },
    { id: 'ECLIPSE_SEASON_SLATE', eligible: isOffenseOrKicker, test: (_r, c) => c.cosmobiology.isEclipseSeasonGame },
  ],
  annual_profections: [
    { id: 'PROF_ANGULAR_PEAK_HOUSE_YEAR', eligible: hasNatalDate, test: (_r, c) => c.profections.isAngularProfectionYear },
    { id: 'PROF_MALEFIC_6_8_12_HOUSE_YEAR', eligible: hasNatalDate, test: (_r, c) => c.profections.isMaleficHouseProfectionYear },
    { id: 'PROF_BENEFIC_TIMELORD_YEAR', eligible: hasNatalDate, test: (_r, c) => c.profections.isBeneficTimeLordYear },
    { id: 'PROF_MALEFIC_TIMELORD_YEAR', eligible: hasNatalDate, test: (_r, c) => c.profections.isMaleficTimeLordYear },
    { id: 'PROF_TIMELORD_RETROGRADE_GAME', eligible: hasNatalDate, test: (_r, c) => c.profections.isTimeLordRetrogradeOnGame },
    { id: 'PROF_TIMELORD_DIGNIFIED_GAME', eligible: hasNatalDate, test: (_r, c) => c.profections.isTimeLordDignifiedOnGame },
    { id: 'PROF_TIMELORD_NATAL_HARMONIC', eligible: hasNatalDate, test: (_r, c) => c.profections.isTimeLordHarmonicToNatal },
  ],
  arabic_lots_manazil: [
    { id: 'MANAZIL_PICATRIX_VICTORY', eligible: isOffenseOrKicker, test: (_r, c) => c.arabicManazil.isVictoryManzil },
    { id: 'MANAZIL_PICATRIX_DISCORD', eligible: isOffenseOrKicker, test: (_r, c) => c.arabicManazil.isDiscordManzil },
    { id: 'SECT_NOCTURNAL_SLATE_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.arabicManazil.isNocturnalSlate },
    { id: 'SECT_NOCTURNAL_SLATE_DEF', eligible: isDefense, test: (_r, c) => c.arabicManazil.isNocturnalSlate },
    { id: 'SECT_NATAL_RULER_REJOICING', eligible: hasNatalDate, test: (_r, c) => c.arabicManazil.isNatalRulerInSect },
    { id: 'HERMETIC_LOT_OF_VICTORY_ACTIVE', eligible: hasNatalDate, test: (_r, c) => c.arabicManazil.isLotOfVictoryActivated },
  ],
  fixed_stars_parans: [
    { id: 'STAR_NATAL_PERSIAN_ROYAL', eligible: hasNatalDate, test: (_r, c) => c.fixedStars.hasNatalRoyalStar },
    { id: 'STAR_NATAL_GLORY_BENEFIC', eligible: hasNatalDate, test: (_r, c) => c.fixedStars.hasNatalGloryStar },
    { id: 'STAR_NATAL_ALGOL_SCHEAT_HAZARD', eligible: hasNatalDate, test: (_r, c) => c.fixedStars.hasNatalAlgolHazard },
    { id: 'STAR_GAME_MOON_GLORY_ROYAL', eligible: isOffenseOrKicker, test: (_r, c) => c.fixedStars.isGameMoonGloryStar },
    { id: 'STAR_GAME_MOON_ALGOL_SCHEAT', eligible: isOffenseOrKicker, test: (_r, c) => c.fixedStars.isGameMoonAlgolHazard },
  ],
  egyptian_decans_modality: [
    { id: 'MODALITY_NATAL_CARDINAL', eligible: hasNatalDate, test: (_r, c) => c.decansModality.natalModality === 'Cardinal' },
    { id: 'MODALITY_NATAL_FIXED', eligible: hasNatalDate, test: (_r, c) => c.decansModality.natalModality === 'Fixed' },
    { id: 'MODALITY_NATAL_MUTABLE', eligible: hasNatalDate, test: (_r, c) => c.decansModality.natalModality === 'Mutable' },
    { id: 'MODALITY_QB_REC_SAME', eligible: isPassCatcherWithBirth, test: (_r, c) => c.decansModality.isQbSameModality },
    { id: 'DECAN_NATAL_MARS_FACE', eligible: hasNatalDate, test: (_r, c) => c.decansModality.isMartialDecanNatal },
    { id: 'DECAN_NATAL_JUPITER_FACE', eligible: hasNatalDate, test: (_r, c) => c.decansModality.isJovialDecanNatal },
    { id: 'DECAN_EXACT_GAME_TRINE', eligible: hasNatalDate, test: (_r, c) => c.decansModality.isExactDecanTrineGame },
  ],
  bazi_wuxing: [
    { id: 'WUXING_DAY_NOURISHED', eligible: hasNatalDate, test: (_r, c) => c.bazi.dayPhaseRelation === 'PRODUCED_BY' },
    { id: 'WUXING_DAY_CONQUERS', eligible: hasNatalDate, test: (_r, c) => c.bazi.dayPhaseRelation === 'CONQUERS' },
    { id: 'WUXING_DAY_CONQUERED', eligible: hasNatalDate, test: (_r, c) => c.bazi.dayPhaseRelation === 'CONQUERED_BY' },
    { id: 'WUXING_DAY_COMPANION', eligible: hasNatalDate, test: (_r, c) => c.bazi.dayPhaseRelation === 'SAME' },
    { id: 'WUXING_DAY_OUTPUT_DRAIN', eligible: hasNatalDate, test: (_r, c) => c.bazi.dayPhaseRelation === 'PRODUCES' },
    { id: 'BAZI_LIU_CHONG_DAY_CLASH', eligible: hasNatalDate, test: (_r, c) => c.bazi.isDayBranchClash },
    { id: 'BAZI_SAN_HE_DAY_HARMONY', eligible: hasNatalDate, test: (_r, c) => c.bazi.isDaySanHeHarmony },
    { id: 'BAZI_OPP_QB_BRANCH_CLASH', eligible: hasNatalDate, test: (_r, c) => c.bazi.isOppQbBranchClash },
    { id: 'WUXING_OFFENSE_CONQUERS_OPP', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.offenseWuXingRelation), test: (_r, c) => c.offenseWuXingRelation === 'CONQUERS' },
    { id: 'WUXING_OFFENSE_CONQUERED_BY_OPP', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.offenseWuXingRelation), test: (_r, c) => c.offenseWuXingRelation === 'CONQUERED_BY' },
  ],
  rokuyo_tenchusatsu: [
    { id: 'ROKUYO_TAIAN_AUSPICIOUS_DAY', eligible: isOffenseOrKicker, test: (_r, c) => c.rokuyoTenchusatsu.isTaianLuckyDay },
    { id: 'ROKUYO_BUTSUMETSU_TABOO_DAY', eligible: isOffenseOrKicker, test: (_r, c) => c.rokuyoTenchusatsu.isButsumetsuTabooDay },
    { id: 'ROKUYO_SENBU_AFTERNOON_WIN', eligible: isOffenseOrKicker, test: (_r, c) => c.rokuyoTenchusatsu.isSenbuAfternoonWinDay },
    { id: 'ROKUYO_SENSHO_AFTERNOON_LOSS', eligible: isOffenseOrKicker, test: (_r, c) => c.rokuyoTenchusatsu.isSenshoAfternoonLossDay },
    { id: 'TENCHUSATSU_PLAYER_VOID_DAY', eligible: hasNatalDate, test: (_r, c) => c.rokuyoTenchusatsu.isPlayerTenchusatsuGameDay },
    { id: 'KONG_WANG_DAILY_VOID_NATAL', eligible: hasNatalDate, test: (_r, c) => c.rokuyoTenchusatsu.isNatalInDailyKongWangVoid },
    { id: 'TENCHUSATSU_2YR_VOID_SEASON', eligible: hasNatalDate, test: (_r, c) => c.rokuyoTenchusatsu.isPlayerTenchusatsuYear },
  ],
  qimen_bagua: [
    { id: 'BAGUA_AUSPICIOUS_ROAD_BEARING', eligible: (r) => hasNatalDate(r) && !r.isHome, test: (_r, c) => c.directionalGeomancy.isAuspiciousRoadBearing },
    { id: 'BAGUA_INAUSPICIOUS_ROAD_BEARING', eligible: (r) => hasNatalDate(r) && !r.isHome, test: (_r, c) => c.directionalGeomancy.isInauspiciousRoadBearing },
    { id: 'QIMEN_FIVE_YELLOW_TABOO_ROAD', eligible: (r) => isOffenseOrKicker(r) && !r.isHome, test: (_r, c) => c.directionalGeomancy.isFiveYellowTabooRoad },
    { id: 'LOSHU_EAST_GROUP_NATAL', eligible: hasNatalDate, test: (_r, c) => c.directionalGeomancy.loShuGroup === 'EAST' },
    { id: 'XUAN_KONG_PERIOD_8_STADIUM', eligible: isOffenseOrKicker, test: (_r, c) => c.directionalGeomancy.xuanKongPeriod === 8 },
    { id: 'XUAN_KONG_LEGACY_STADIUM', eligible: isOffenseOrKicker, test: (_r, c) => c.directionalGeomancy.xuanKongPeriod <= 7 },
  ],
  hellenistic_planetary: [
    { id: 'MERCURY_RETROGRADE_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.hellenistic.mercuryRetrograde },
    { id: 'MERCURY_RETROGRADE_QB', eligible: (r) => r.position === 'QB', test: (_r, c) => c.hellenistic.mercuryRetrograde },
    { id: 'MARS_RETROGRADE_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.hellenistic.marsRetrograde },
    { id: 'VENUS_RETROGRADE_OFFENSE', eligible: isOffenseOrKicker, test: (_r, c) => c.hellenistic.venusRetrograde },
    { id: 'JUPITER_RETURN_WINDOW', eligible: hasNatalDate, test: (_r, c) => c.hellenistic.jupiterReturnWindow },
    { id: 'JUPITER_TRINE_TRANSIT', eligible: hasNatalDate, test: (_r, c) => c.hellenistic.jupiterTrineTransit },
    { id: 'SATURN_RETURN_WINDOW_AGE27P', eligible: hasNatalDate, test: (_r, c) => c.hellenistic.saturnReturnWindow },
    { id: 'MARS_RETURN_CONJUNCTION', eligible: hasNatalDate, test: (_r, c) => c.hellenistic.marsReturnWindow },
    { id: 'CHALDEAN_DAY_RULER_MATCH', eligible: hasNatalDate, test: (_r, c) => c.hellenistic.isPlanetaryDayMatch },
  ],
  mayan_tzolkin: [
    { id: 'TZOLKIN_GAP_PORTAL_GAME', eligible: isOffenseOrKicker, test: (_r, c) => c.mayan.isGapGameDay },
    { id: 'TZOLKIN_TONE_13_OR_RESONANCE', eligible: hasNatalDate, test: (_r, c) => c.mayan.isTone13Ascension },
    { id: 'TZOLKIN_TONE_1_MAGNETIC', eligible: isOffenseOrKicker, test: (_r, c) => c.mayan.isTone1Magnetic },
    { id: 'TZOLKIN_NATAL_NAHUAL_RETURN', eligible: hasNatalDate, test: (_r, c) => c.mayan.isNatalNahualReturn },
    { id: 'TZOLKIN_ANALOG_SUPPORT_DAY', eligible: hasNatalDate, test: (_r, c) => c.mayan.isAnalogSupportDay },
    { id: 'TZOLKIN_ANTIPODE_CHALLENGE_DAY', eligible: hasNatalDate, test: (_r, c) => c.mayan.isAntipodeChallengeDay },
    { id: 'TZOLKIN_OPP_QB_ANTIPODE', eligible: hasNatalDate, test: (_r, c) => c.mayan.isOppQbAntipode },
  ],
  greco_roman_onomancy: [
    { id: 'PYTHAGOREAN_COMBAT_VICTOR', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.onomancy.combatOutcome), test: (_r, c) => c.onomancy.combatOutcome === 'VICTOR' },
    { id: 'PYTHAGOREAN_COMBAT_DEFEATED', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.onomancy.combatOutcome), test: (_r, c) => c.onomancy.combatOutcome === 'DEFEATED' },
    { id: 'PYTHAGOREAN_COMBAT_DRAW', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.onomancy.combatOutcome), test: (_r, c) => c.onomancy.combatOutcome === 'DRAW' },
    { id: 'PETOSIRIS_UPPER_HEMISPHERE', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.onomancy.petosirisHemisphere), test: (_r, c) => c.onomancy.petosirisHemisphere === 'UPPER' },
    { id: 'PETOSIRIS_LOWER_HEMISPHERE', eligible: (r, c) => isOffenseOrKicker(r) && Boolean(c.onomancy.petosirisHemisphere), test: (_r, c) => c.onomancy.petosirisHemisphere === 'LOWER' },
  ],
  biorhythms: [
    { id: 'BIO_PHYSICAL_PEAK', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.physical !== null && c.biorhythm.physical > 0.7 },
    { id: 'BIO_PHYSICAL_TROUGH', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.physical !== null && c.biorhythm.physical < -0.7 },
    { id: 'BIO_EMOTIONAL_PEAK', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.emotional !== null && c.biorhythm.emotional > 0.7 },
    { id: 'BIO_EMOTIONAL_TROUGH', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.emotional !== null && c.biorhythm.emotional < -0.7 },
    { id: 'BIO_INTELLECTUAL_PEAK', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.intellectual !== null && c.biorhythm.intellectual > 0.7 },
    { id: 'BIO_INTELLECTUAL_TROUGH', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.intellectual !== null && c.biorhythm.intellectual < -0.7 },
    {
      id: 'BIO_TRIPLE_POSITIVE',
      eligible: hasNatalDate,
      test: (_r, c) =>
        c.biorhythm.physical !== null &&
        c.biorhythm.emotional !== null &&
        c.biorhythm.intellectual !== null &&
        c.biorhythm.physical > 0 &&
        c.biorhythm.emotional > 0 &&
        c.biorhythm.intellectual > 0,
    },
    { id: 'BIO_CRITICAL_DAY_ANY', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.isCriticalDay },
    { id: 'BIO_CRITICAL_MULTI', eligible: hasNatalDate, test: (_r, c) => c.biorhythm.criticalCount >= 2 },
  ],
  numerology: [
    { id: 'NUM_MASTER_LIFE_PATH', eligible: hasNatalDate, test: (_r, c) => c.numerology.isMasterLifePath },
    { id: 'NUM_DATE_EXACT_RESONANCE', eligible: hasNatalDate, test: (_r, c) => c.numerology.dateResonance === 'exact' },
    { id: 'NUM_DATE_HARMONIC_RESONANCE', eligible: hasNatalDate, test: (_r, c) => c.numerology.dateResonance === 'harmonic' },
    { id: 'NUM_JERSEY_EXACT_RESONANCE', eligible: (r, c) => hasNatalDate(r) && c.numerology.jerseyRoot !== null, test: (_r, c) => c.numerology.jerseyResonance === 'exact' },
    { id: 'NUM_SEASON_EXACT_RESONANCE', eligible: hasNatalDate, test: (_r, c) => c.numerology.seasonResonance === 'exact' },
  ],
  oracular_archetypes: [
    { id: 'ICHING_GREAT_FORTUNE', eligible: hasNatalDate, test: (_r, c) => c.oracular.hexagramFortuneTier === 'Great' },
    { id: 'ICHING_FAVORABLE_FORTUNE', eligible: hasNatalDate, test: (_r, c) => c.oracular.hexagramFortuneTier === 'Favorable' },
    { id: 'ICHING_NEUTRAL_FORTUNE', eligible: hasNatalDate, test: (_r, c) => c.oracular.hexagramFortuneTier === 'Neutral' },
    { id: 'ICHING_CHALLENGING_FORTUNE', eligible: hasNatalDate, test: (_r, c) => c.oracular.hexagramFortuneTier === 'Challenging' },
    { id: 'TAROT_FIRE_ARCHETYPE', eligible: hasNatalDate, test: (_r, c) => c.oracular.tarotElement === 'Fire' },
    { id: 'TAROT_EARTH_ARCHETYPE', eligible: hasNatalDate, test: (_r, c) => c.oracular.tarotElement === 'Earth' },
    { id: 'TAROT_AIR_ARCHETYPE', eligible: hasNatalDate, test: (_r, c) => c.oracular.tarotElement === 'Air' },
    { id: 'TAROT_WATER_ARCHETYPE', eligible: hasNatalDate, test: (_r, c) => c.oracular.tarotElement === 'Water' },
  ],
};

export interface RuntimePointDiffOptions {
  readonly systems?: readonly PredictorSystemId[];
  readonly useDefaultCurated?: boolean;
  readonly useTrainScreened?: boolean;
  readonly usePositionalModel?: boolean;
  readonly scoringSettings?: SleeperScoringSettings;
  readonly precomputedContext?: EvalContext;
}

export interface RuntimePointDiffPrediction {
  readonly player: {
    readonly playerId: string | null;
    readonly playerName: string | null;
    readonly position: string;
    readonly team: string | null;
    readonly opponent: string | null;
    readonly gameDate: string | null;
    readonly stadiumId: string | null;
    readonly stadiumName: string | null;
  };
  readonly expectedPointDiff: number;
  readonly rawCalibratedPointDiff: number;
  readonly posBaselineBias: number;
  readonly baseProjectedPts: number | null;
  readonly adjustedProjectedPts: number | null;
  readonly synergyRegime: SynergyRegime;
  readonly playerElement: ElementType | null;
  readonly myDominantElement: ElementType | null;
  readonly oppDominantElement: ElementType | null;
  readonly perSystemBreakdown: Record<
    string,
    {
      readonly systemId: PredictorSystemId;
      readonly systemName: string;
      readonly activeConditionCount: number;
      readonly standalonePointDiff: number;
      readonly jointContributionPts: number;
    }
  >;
  readonly activeConditions: ReadonlyArray<{
    readonly systemId: PredictorSystemId;
    readonly systemName: string;
    readonly conditionId: string;
    readonly label: string;
    readonly standaloneWeightPts: number;
    readonly jointRidgeWeightPts: number;
    readonly empiricalDeltaPts: number;
    readonly shrunkDeltaPts: number;
    readonly sampleSize: number;
    readonly clusterTStat: number;
    readonly qValue: number;
  }>;
  readonly observables: EvalContext;
}

const META_BY_ID: ReadonlyMap<PredictorSystemId, PredictorSystemMeta> = new Map(
  PREDICTOR_SYSTEM_META.map((m) => [m.id, m]),
);

function normalizeNflPosition(rawPos?: string | null): NFLPosition {
  const upper = String(rawPos ?? '')
    .trim()
    .toUpperCase();
  switch (upper) {
    case 'QB':
    case 'RB':
    case 'WR':
    case 'TE':
    case 'K':
    case 'DEF':
      return upper;
    default:
      return 'WR';
  }
}

/**
 * Zero-dataset browser/serverless runtime scoring (`SLEEPER_POINT_DIFF_ANALYSIS.md` Section 10.1).
 * Matches upstream `predictPlayerGamePointDiff` bit-for-bit across `jointModel`,
 * `trainScreenedModel`, and standalone `perSystemModels`.
 */
export function predictPlayerGamePointDiff(
  gameInput: Partial<EvalRow> & { readonly position?: string; readonly gameDate?: string },
  fittedModel: SerializedPointDiffModelParameters = MODEL_PARAMETERS,
  options: RuntimePointDiffOptions = {},
): RuntimePointDiffPrediction {
  const pos = normalizeNflPosition(gameInput.position);

  const evalRow: EvalRow = {
    playerId: String(gameInput.playerId || ''),
    playerName: String(gameInput.playerName || ''),
    position: pos,
    birthDate: gameInput.birthDate ?? null,
    jerseyNumber: typeof gameInput.jerseyNumber === 'number' ? gameInput.jerseyNumber : null,
    team: gameInput.team ?? null,
    opponent: gameInput.opponent ?? null,
    isHome: gameInput.isHome ?? true,
    hostTeam: gameInput.hostTeam ?? null,
    stadiumId: gameInput.stadiumId ?? null,
    kickoffUtc: gameInput.kickoffUtc ?? null,
    season: gameInput.season ?? (gameInput.gameDate ? Number(gameInput.gameDate.slice(0, 4)) : 2026),
    week: gameInput.week ?? 1,
    gameDate: gameInput.gameDate || '2026-09-13',
    projectedPts: gameInput.projectedPts ?? null,
    actualPts: gameInput.actualPts ?? null,
    projStats: gameInput.projStats ?? null,
    actualStats: gameInput.actualStats ?? null,
    teamRoster: gameInput.teamRoster,
    opponentRoster: gameInput.opponentRoster,
  };

  const defaultIds =
    fittedModel.defaultSystemIds && fittedModel.defaultSystemIds.length > 0
      ? fittedModel.defaultSystemIds
      : DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;

  const requestedIds: readonly PredictorSystemId[] =
    options.systems && options.systems.length > 0
      ? options.systems
      : options.useDefaultCurated && defaultIds.length > 0
        ? defaultIds
        : fittedModel.systemIds;

  const posBundle =
    options.usePositionalModel !== false
      ? (fittedModel.positionalModels?.[pos] ?? null)
      : null;

  const matchesDefaultSet =
    defaultIds.length > 0 &&
    requestedIds.length === defaultIds.length &&
    requestedIds.every((id) => defaultIds.includes(id));

  let activeJointModel = posBundle?.jointModel ?? fittedModel.jointModel;
  let activeModelSystemCount = fittedModel.systemIds.length;
  if (
    options.useTrainScreened &&
    (posBundle?.trainScreenedModel || fittedModel.trainScreenedModel)
  ) {
    activeJointModel = posBundle?.trainScreenedModel ?? fittedModel.trainScreenedModel;
  } else if (
    (options.useDefaultCurated || matchesDefaultSet) &&
    (posBundle?.defaultCuratedModel || fittedModel.defaultCuratedModel)
  ) {
    activeJointModel = posBundle?.defaultCuratedModel ?? fittedModel.defaultCuratedModel;
    activeModelSystemCount = defaultIds.length;
  }

  const activePerSystemModels = posBundle?.perSystemModels ?? fittedModel.perSystemModels;

  const ctx = options.precomputedContext ?? extractMatchupObservableContext(evalRow);
  const posBaselineBias = Number((fittedModel.posMeanDiff[pos] ?? 0).toFixed(4));
  const useSingleSystem =
    !options.useTrainScreened &&
    !options.useDefaultCurated &&
    requestedIds.length === 1 &&
    Boolean(activePerSystemModels[requestedIds[0]]);

  let jointSum = activeJointModel.centeringIntercept;
  if (requestedIds.length !== activeModelSystemCount) {
    jointSum = 0;
    for (const sysId of requestedIds) {
      for (const rule of SYSTEM_CONDITION_RULES[sysId]) {
        const fKey = `${sysId}:${rule.id}`;
        const wObj = activeJointModel.weights[fKey];
        if (wObj) {
          jointSum -= wObj.ridgeWeight * wObj.activationRate;
        }
      }
    }
  }

  const perSystemBreakdown: RuntimePointDiffPrediction['perSystemBreakdown'] = {};
  const activeConditions: Array<RuntimePointDiffPrediction['activeConditions'][number]> = [];

  for (const sysId of requestedIds) {
    const meta = META_BY_ID.get(sysId);
    if (!meta) continue;
    const rules = SYSTEM_CONDITION_RULES[sysId];
    const singleSub = activePerSystemModels[sysId];
    let sysStandaloneDiff = singleSub ? singleSub.centeringIntercept : 0;
    let sysJointContribution = 0;

    for (const rule of rules) {
      const fKey = `${sysId}:${rule.id}`;
      const jw = activeJointModel.weights[fKey];
      if (jw) {
        sysJointContribution -= jw.ridgeWeight * jw.activationRate;
      }
    }

    const matchedRules = rules.filter((r) => r.eligible(evalRow, ctx) && r.test(evalRow, ctx));
    for (const rule of matchedRules) {
      const fKey = `${sysId}:${rule.id}`;
      const jw = activeJointModel.weights[fKey];
      const sw = singleSub?.weights[fKey];
      const cStat = fittedModel.conditionStatsMap[fKey];

      if (jw) {
        jointSum += jw.ridgeWeight;
        sysJointContribution += jw.ridgeWeight;
      }
      if (sw) {
        sysStandaloneDiff += sw.ridgeWeight;
      } else if (cStat) {
        sysStandaloneDiff += cStat.shrunkDelta;
      }

      activeConditions.push({
        systemId: sysId,
        systemName: meta.name,
        conditionId: rule.id,
        label: cStat?.label || rule.id,
        standaloneWeightPts: Number((sw?.ridgeWeight ?? cStat?.shrunkDelta ?? 0).toFixed(4)),
        jointRidgeWeightPts: Number((jw?.ridgeWeight ?? 0).toFixed(4)),
        empiricalDeltaPts: cStat?.posAdjustedDelta ?? 0,
        shrunkDeltaPts: cStat?.shrunkDelta ?? 0,
        sampleSize: cStat?.sampleSize ?? 0,
        clusterTStat: cStat?.clusterTStat ?? 0,
        qValue: cStat?.qValue ?? 1.0,
      });
    }

    perSystemBreakdown[sysId] = {
      systemId: sysId,
      systemName: meta.name,
      activeConditionCount: matchedRules.length,
      standalonePointDiff: Number(sysStandaloneDiff.toFixed(4)),
      jointContributionPts: Number(sysJointContribution.toFixed(4)),
    };
  }

  const expectedPointDiff = useSingleSystem
    ? perSystemBreakdown[requestedIds[0]].standalonePointDiff
    : Number(jointSum.toFixed(4));

  const rawCalibratedPointDiff = Number((posBaselineBias + expectedPointDiff).toFixed(4));
  const hydratedBase = computeSleeperPointDiff(evalRow, options.scoringSettings ?? null);
  const baseProjectedPts = hydratedBase.projectedPts;
  const adjustedProjectedPts =
    baseProjectedPts !== null ? Number((baseProjectedPts + expectedPointDiff).toFixed(2)) : null;

  activeConditions.sort((a, b) => Math.abs(b.standaloneWeightPts) - Math.abs(a.standaloneWeightPts));

  return {
    player: {
      playerId: evalRow.playerId || null,
      playerName: evalRow.playerName || null,
      position: pos,
      team: evalRow.team,
      opponent: evalRow.opponent,
      gameDate: evalRow.gameDate || null,
      stadiumId: ctx.hostStadium?.stadiumId || null,
      stadiumName: ctx.hostStadium?.name || null,
    },
    expectedPointDiff,
    rawCalibratedPointDiff,
    posBaselineBias,
    baseProjectedPts,
    adjustedProjectedPts,
    synergyRegime: ctx.synergyRegime,
    playerElement: ctx.playerElement,
    myDominantElement: ctx.myDominantElement,
    oppDominantElement: ctx.oppDominantElement,
    perSystemBreakdown,
    activeConditions,
    observables: ctx,
  };
}

// ============================================================================
// 8. Mainline UI Forecast Surface (`evaluatePlayerPointDiff`)
// ============================================================================

export interface MatchedConditionForecast {
  readonly systemId: PredictorSystemId;
  readonly systemName: string;
  readonly shortSystemName: string;
  readonly conditionId: string;
  readonly label: string;
  readonly jointRidgeWeightPts: number;
  readonly standaloneWeightPts: number;
  readonly shrunkDeltaPts: number;
  readonly empiricalDeltaPts: number;
  readonly withinPlayerDeltaPts: number | null;
  readonly oosDeltaPts: number | null;
  readonly sampleSize: number;
  readonly positionalSampleSize: number;
  readonly clusterTStat: number;
}

export interface PredictorSystemForecast {
  readonly systemId: PredictorSystemId;
  readonly systemName: string;
  readonly shortName: string;
  readonly categoryId: PredictorCategoryId;
  readonly category: string;
  readonly subCategory: string;
  readonly defaultEnabled: boolean;
  readonly description: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly clusterBy: 'gameId' | 'gameDate' | 'playerId';
  readonly enabled: boolean;
  readonly activeConditionCount: number;
  readonly jointContributionPts: number;
  readonly standalonePointDiff: number;
  readonly oosQuintileSpreadPts: number;
  readonly oosTStat: number;
  readonly matchedConditions: MatchedConditionForecast[];
}

export interface PlayerPointDiffForecast {
  readonly basePts: number;
  readonly overallModifierPts: number;
  readonly trainScreenedModifierPts: number;
  readonly adjustedPts: number;
  readonly positionModel: {
    readonly position: PositionalModelPosition;
    readonly sampleSize: number;
    readonly ridgeLambda: number;
  };
  readonly systems: PredictorSystemForecast[];
  readonly activeConditions: MatchedConditionForecast[];
  readonly matchup: {
    readonly season: number;
    readonly week: number;
    readonly gameDate: string;
    readonly opponent: string | null;
    readonly isHome: boolean;
    readonly stadiumName: string | null;
    readonly city: string | null;
    readonly state: string | null;
    readonly lat: number | null;
    readonly lon: number | null;
    readonly planetaryHourRuler: string | null;
    readonly rokuyoDay: string | null;
    readonly geomanticJudge: string | null;
  };
  readonly natalProfile: {
    readonly birthDate: string | null;
    readonly sunSign: string | null;
    readonly element: ElementType | null;
    readonly modality: 'Cardinal' | 'Fixed' | 'Mutable' | null;
    readonly decanRuler: string | null;
    readonly vedicNakshatra: string | null;
    readonly vedicMoonRashi: string | null;
    readonly natalRune: string | null;
    readonly natalOgham: string | null;
    readonly natalSephirah: string | null;
    readonly timeLordPlanet: string | null;
    readonly profectedHouse: number | null;
    readonly dayMasterStem: string | null;
    readonly dayMasterPhase: WuXingPhase | null;
    readonly branchAnimal: string | null;
    readonly mayanKinNumber: number | null;
    readonly mayanTone: number | null;
    readonly mayanNahual: string | null;
    readonly lifePath: number | null;
    readonly tarotCard: string | null;
    readonly hexagramNumber: number | null;
  };
  readonly synergyRegime: SynergyRegime;
  readonly dominantTeamElement: ElementType | null;
  readonly dominantTeamWuXing: WuXingPhase | null;
}

export interface EvaluatePlayerPointDiffOptions {
  readonly basePts?: number;
  readonly season?: number;
  readonly week?: number;
  readonly opponent?: string | null;
  readonly isHome?: boolean;
  readonly hostTeam?: string | null;
  readonly gameDate?: string | null;
  readonly kickoffUtc?: string | null;
  readonly teamUnit?: readonly CosmicPlayer[];
  readonly opponentUnit?: readonly CosmicPlayer[];
  readonly enabledSystems?: readonly string[];
  readonly useDefaultCurated?: boolean;
  readonly useTrainScreened?: boolean;
  readonly usePositionalModel?: boolean;
}

function toUnitPlayerInputs(players: readonly CosmicPlayer[]): UnitPlayerInput[] {
  return players.map((p) => {
    const bd = resolvePlayerBirthDate(p);
    const zodiac = bd ? getZodiacFromDate(bd) : null;
    return {
      id: String(p.id),
      playerId: String(p.id),
      name: p.name,
      playerName: p.name,
      position: p.position,
      team: p.team,
      birthDate: bd,
      element: zodiac?.element ?? p.elemental_traits?.element ?? null,
    };
  });
}

/**
 * Evaluates a player's next-game Sleeper Base projection and combined 25-system
 * Point-Differential Modifier (+/- pts), along with the full per-system historical
 * forecast breakdown.
 */
export function evaluatePlayerPointDiff(
  player: Partial<CosmicPlayer> & { birth_date?: string | null },
  options: EvaluatePlayerPointDiffOptions = {},
): PlayerPointDiffForecast {
  const rawBase =
    options.basePts !== undefined
      ? Number(options.basePts)
      : Number(
          player.sleeper_projected_points ??
            player.weekly_projected_points ??
            player.projected_points ??
            0,
        );
  const basePts = Number.isFinite(rawBase) ? Math.round(rawBase * 100) / 100 : 0;

  const season = options.season ?? 2025;
  const week = Math.max(1, Math.min(18, Math.trunc(options.week ?? 2)));
  const normTeam = normalizeNflTeamCode(player.team);
  const resolvedGame = resolveTeamNextGame(normTeam, week, season);

  const opponent =
    options.opponent !== undefined
      ? normalizeNflTeamCode(options.opponent)
      : (resolvedGame?.opponent ?? null);
  const isHome =
    options.isHome !== undefined ? Boolean(options.isHome) : (resolvedGame?.isHome ?? true);
  const hostTeam =
    normalizeNflTeamCode(options.hostTeam) ||
    resolvedGame?.hostTeam ||
    (isHome ? normTeam : opponent);
  const hostStadium = hostTeam ? getStadiumForTeam(hostTeam) : null;
  const gameDate =
    options.gameDate || resolvedGame?.gameDate || resolveWeekSundayDate(season, week);
  const kickoffUtc = options.kickoffUtc ?? resolvedGame?.kickoffUtc ?? null;

  const birthDate = resolvePlayerBirthDate(player);
  const natalZodiac = birthDate ? getZodiacFromDate(birthDate) : null;
  const pos = normalizeNflPosition(player.position);
  const playerName =
    String(player.name || `${player.first_name || ''} ${player.last_name || ''}`).trim() ||
    'Player';
  const fallbackEl = natalZodiac?.element ?? player.elemental_traits?.element ?? null;

  const selfUnitEntry: UnitPlayerInput = {
    id: String(player.id || ''),
    playerId: String(player.id || ''),
    name: playerName,
    playerName,
    position: pos,
    team: normTeam,
    birthDate,
    element: fallbackEl,
  };

  const myRosterInputs =
    options.teamUnit && options.teamUnit.length > 0
      ? toUnitPlayerInputs(options.teamUnit)
      : [selfUnitEntry];
  const oppRosterInputs =
    options.opponentUnit && options.opponentUnit.length > 0
      ? toUnitPlayerInputs(options.opponentUnit)
      : [];

  const evalRow: EvalRow = {
    playerId: String(player.id || ''),
    playerName,
    position: pos,
    birthDate,
    jerseyNumber: typeof player.jersey_number === 'number' ? player.jersey_number : null,
    team: normTeam,
    opponent,
    isHome,
    hostTeam,
    kickoffUtc,
    season,
    week,
    gameDate,
    projectedPts: basePts,
    teamRoster: myRosterInputs,
    opponentRoster: oppRosterInputs,
  };

  const evalCtx = extractMatchupObservableContext(evalRow, fallbackEl);

  const enabledSet: ReadonlySet<string> =
    options.enabledSystems !== undefined && options.enabledSystems !== null
      ? new Set(options.enabledSystems)
      : new Set(DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS);

  const enabledCount = PREDICTOR_SYSTEM_META.filter((m) => enabledSet.has(m.id)).length;

  const posBundle =
    options.usePositionalModel !== false ? (POSITIONAL_RIDGE_MODELS[pos] ?? null) : null;
  const activeScreenModel = posBundle?.trainScreenedModel ?? TRAIN_SCREENED_RIDGE_MODEL;
  const activeJointModel = options.useTrainScreened
    ? activeScreenModel
    : options.useDefaultCurated
      ? (posBundle?.defaultCuratedModel ?? DEFAULT_CURATED_RIDGE_MODEL)
      : (posBundle?.jointModel ?? JOINT_RIDGE_MODEL);
  const activePerSystemModels = posBundle?.perSystemModels ?? PER_SYSTEM_RIDGE_MODELS;

  const systems: PredictorSystemForecast[] = [];
  const activeConditions: MatchedConditionForecast[] = [];

  let jointSum = 0;
  let screenedSum = activeScreenModel.centeringIntercept;

  for (const meta of PREDICTOR_SYSTEM_META) {
    const sysId = meta.id;
    const isEnabled = enabledSet.has(sysId);
    const rules = SYSTEM_CONDITION_RULES[sysId];
    const singleModel = activePerSystemModels[sysId];

    let sysStandalone = singleModel ? singleModel.centeringIntercept : 0;
    let sysJointContrib = 0;
    for (const r of rules) {
      const fKey = `${sysId}:${r.id}`;
      const jw = activeJointModel.weights[fKey];
      if (jw) {
        sysJointContrib -= jw.ridgeWeight * jw.activationRate;
      }
    }

    const matchedConditions: MatchedConditionForecast[] = [];
    if (normTeam) {
      for (const r of rules) {
        if (!r.eligible(evalRow, evalCtx) || !r.test(evalRow, evalCtx)) continue;
        const fKey = `${sysId}:${r.id}`;
        const jw = activeJointModel.weights[fKey];
        const sw = singleModel?.weights[fKey];
        const tw = activeScreenModel.weights[fKey];
        const cStat = CONDITION_EMPIRICAL_STATS[fKey];

        if (jw) {
          sysJointContrib += jw.ridgeWeight;
        }
        if (tw) {
          screenedSum += tw.ridgeWeight;
        }
        if (sw) {
          sysStandalone += sw.ridgeWeight;
        } else if (cStat) {
          sysStandalone += cStat.posAdjustedDelta;
        }

        const item: MatchedConditionForecast = {
          systemId: sysId,
          systemName: meta.name,
          shortSystemName: meta.shortName,
          conditionId: r.id,
          label: cStat?.label || r.id,
          jointRidgeWeightPts: Number((jw?.ridgeWeight ?? 0).toFixed(4)),
          standaloneWeightPts: Number((sw?.ridgeWeight ?? cStat?.posAdjustedDelta ?? 0).toFixed(4)),
          shrunkDeltaPts: Number((cStat?.shrunkDelta ?? 0).toFixed(4)),
          empiricalDeltaPts: Number((cStat?.posAdjustedDelta ?? 0).toFixed(4)),
          withinPlayerDeltaPts: cStat?.withinPlayerDelta ?? null,
          oosDeltaPts: cStat?.oosDelta ?? null,
          sampleSize: cStat?.sampleSize ?? 0,
          positionalSampleSize: sw?.sampleSize ?? jw?.sampleSize ?? cStat?.sampleSize ?? 0,
          clusterTStat: cStat?.clusterTStat ?? 0,
        };
        matchedConditions.push(item);
        if (isEnabled) {
          activeConditions.push(item);
        }
      }
    } else {
      sysStandalone = 0;
      sysJointContrib = 0;
      screenedSum = 0;
    }

    matchedConditions.sort(
      (a, b) => Math.abs(b.standaloneWeightPts) - Math.abs(a.standaloneWeightPts),
    );

    const roundedStandalone = Number(sysStandalone.toFixed(4));
    const roundedJoint = Number(sysJointContrib.toFixed(4));

    if (isEnabled) {
      jointSum += sysJointContrib;
    }

    systems.push({
      systemId: sysId,
      systemName: meta.name,
      shortName: meta.shortName,
      categoryId: meta.categoryId,
      category: meta.category,
      subCategory: meta.subCategory,
      defaultEnabled: meta.defaultEnabled,
      description: meta.description,
      sourceLabel: meta.sourceLabel,
      sourceUrl: meta.sourceUrl,
      clusterBy: meta.clusterBy,
      enabled: isEnabled,
      activeConditionCount: matchedConditions.length,
      jointContributionPts: roundedJoint,
      standalonePointDiff: roundedStandalone,
      oosQuintileSpreadPts: meta.oosQuintileSpreadPts,
      oosTStat: meta.oosTStat,
      matchedConditions,
    });
  }

  let overallModifierPts = 0;
  if (!normTeam || enabledCount === 0) {
    overallModifierPts = 0;
  } else if (!options.useTrainScreened && enabledCount === 1) {
    const sole = systems.find((s) => s.enabled);
    overallModifierPts = sole ? Number(sole.standalonePointDiff.toFixed(2)) : 0;
  } else {
    overallModifierPts = Number(jointSum.toFixed(2));
  }
  if (Object.is(overallModifierPts, -0)) {
    overallModifierPts = 0;
  }

  let trainScreenedModifierPts = normTeam ? Number(screenedSum.toFixed(2)) : 0;
  if (Object.is(trainScreenedModifierPts, -0)) {
    trainScreenedModifierPts = 0;
  }

  activeConditions.sort(
    (a, b) => Math.abs(b.standaloneWeightPts) - Math.abs(a.standaloneWeightPts),
  );

  const adjustedPts = Number(Math.max(0, basePts + overallModifierPts).toFixed(2));

  return {
    basePts,
    overallModifierPts,
    trainScreenedModifierPts,
    adjustedPts,
    positionModel: {
      position: pos,
      sampleSize: posBundle?.sampleSize ?? POINT_DIFF_STUDY_SUMMARY.totalPlayerGames,
      ridgeLambda: posBundle?.ridgeLambda ?? POINT_DIFF_STUDY_SUMMARY.ridgeLambda,
    },
    systems,
    activeConditions,
    matchup: {
      season,
      week,
      gameDate,
      opponent,
      isHome,
      stadiumName: hostStadium?.name ?? null,
      city: hostStadium?.city ?? null,
      state: hostStadium?.state ?? null,
      lat: hostStadium?.lat ?? null,
      lon: hostStadium?.lon ?? null,
      planetaryHourRuler: evalCtx.contestHorary.planetaryHourRuler,
      rokuyoDay: evalCtx.rokuyoTenchusatsu.rokuyoName,
      geomanticJudge: evalCtx.medievalGeomancy.judgeName,
    },
    natalProfile: {
      birthDate,
      sunSign: evalCtx.celestial.zodiac?.sign ?? player.elemental_traits?.sun_sign ?? null,
      element: evalCtx.playerElement,
      modality: evalCtx.decansModality.natalModality,
      decanRuler: evalCtx.decansModality.natalSunDecanRuler,
      vedicNakshatra: evalCtx.vedic.natalNakshatra,
      vedicMoonRashi: evalCtx.vedic.natalMoonRashi,
      natalRune: evalCtx.runesOgham.natalRuneName,
      natalOgham: evalCtx.runesOgham.natalOghamName,
      natalSephirah: evalCtx.kabbalah.natalSephirah,
      timeLordPlanet: evalCtx.profections.timeLordPlanet,
      profectedHouse: evalCtx.profections.profectedHouse,
      dayMasterStem: evalCtx.bazi.dayMasterStem,
      dayMasterPhase: evalCtx.bazi.dayMasterPhase,
      branchAnimal: evalCtx.bazi.natalBranchAnimal,
      mayanKinNumber: evalCtx.mayan.natalKinNumber,
      mayanTone: evalCtx.mayan.natalTone,
      mayanNahual: evalCtx.mayan.natalNahual,
      lifePath: evalCtx.numerology.lifePath,
      tarotCard: evalCtx.oracular.tarotName ?? player.elemental_traits?.tarot_card ?? null,
      hexagramNumber:
        evalCtx.oracular.hexagramNumber ?? player.elemental_traits?.iching_hexagram ?? null,
    },
    synergyRegime: evalCtx.synergyRegime,
    dominantTeamElement: evalCtx.mySynergy.dominantElement,
    dominantTeamWuXing: evalCtx.myWuXing.dominantWuXing,
  };
}

/**
 * Formats a signed point modifier with explicit +/- prefix (e.g. "+0.48", "-0.22", "0.00").
 */
export function formatSignedModifier(pts: number, digits = 2): string {
  const safe = Number.isFinite(pts) ? pts : 0;
  const rounded = Number(safe.toFixed(digits));
  if (Math.abs(rounded) < Math.pow(10, -digits) / 2) {
    return (0).toFixed(digits);
  }
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
}
