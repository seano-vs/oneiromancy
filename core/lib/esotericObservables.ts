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
 * Pure Zero-Dependency Esoteric, Astrological, Divinatory & Witchcraft Observable Engines:
 * - Vedic Jyotish (Lahiri Sidereal Nakshatras, Tara Bala & Gochara) & Classical Contest Horary
 * - Secondary Progressions ("Day-for-a-Year"), Solar Arc, Cosmobiology Midpoints & Annual Profections
 * - Medieval Arabic 28 Manazil & Sect, Behenian Fixed Stars, Egyptian 36 Decans, Rokuyo & Planetary Synastry
 * - Witchcraft Wheel of the Year Sabbats/Esbats, Norse Elder Futhark Runes, Celtic Ogham & Hermetic Kabbalah
 * - Medieval Latin Divinatory Geomancy (Ars Geomantiae 15-Figure Shield Chart over F_2^4)
 * - Sleeper Multi-Format Stat Hydrator & Point-Differential Scoring Presets
 */

import type { ElementType } from '../types/oneiromancy';

// ============================================================================
// 1. Shared Astronomical, Calendar & Keplerian Ephemeris Primitives
// ============================================================================

export type WuXingPhase = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

export interface HostStadiumCoords {
  readonly stadiumId: string;
  readonly name: string;
  readonly city: string;
  readonly lat: number;
  readonly lon: number;
  readonly openedYear: number;
}

export interface ParsedUtcCalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly date: Date;
}

export interface ZodiacSignInfo {
  readonly sign: string;
  readonly element: ElementType;
  readonly modality: 'Cardinal' | 'Fixed' | 'Mutable';
  readonly startMonth: number;
  readonly startDay: number;
  readonly endMonth: number;
  readonly endDay: number;
  readonly ruler: string;
  readonly eclipticStartDeg: number;
}

export const ZODIAC_SIGN_LIST: readonly ZodiacSignInfo[] = [
  { sign: 'Capricorn', element: 'Earth', modality: 'Cardinal', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19, ruler: 'Saturn', eclipticStartDeg: 270 },
  { sign: 'Aquarius', element: 'Air', modality: 'Fixed', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18, ruler: 'Uranus', eclipticStartDeg: 300 },
  { sign: 'Pisces', element: 'Water', modality: 'Mutable', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20, ruler: 'Neptune', eclipticStartDeg: 330 },
  { sign: 'Aries', element: 'Fire', modality: 'Cardinal', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19, ruler: 'Mars', eclipticStartDeg: 0 },
  { sign: 'Taurus', element: 'Earth', modality: 'Fixed', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20, ruler: 'Venus', eclipticStartDeg: 30 },
  { sign: 'Gemini', element: 'Air', modality: 'Mutable', startMonth: 5, startDay: 21, endMonth: 6, endDay: 20, ruler: 'Mercury', eclipticStartDeg: 60 },
  { sign: 'Cancer', element: 'Water', modality: 'Cardinal', startMonth: 6, startDay: 21, endMonth: 7, endDay: 22, ruler: 'Moon', eclipticStartDeg: 90 },
  { sign: 'Leo', element: 'Fire', modality: 'Fixed', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22, ruler: 'Sun', eclipticStartDeg: 120 },
  { sign: 'Virgo', element: 'Earth', modality: 'Mutable', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22, ruler: 'Mercury', eclipticStartDeg: 150 },
  { sign: 'Libra', element: 'Air', modality: 'Cardinal', startMonth: 9, startDay: 23, endMonth: 10, endDay: 22, ruler: 'Venus', eclipticStartDeg: 180 },
  { sign: 'Scorpio', element: 'Water', modality: 'Fixed', startMonth: 10, startDay: 23, endMonth: 11, endDay: 21, ruler: 'Pluto', eclipticStartDeg: 210 },
  { sign: 'Sagittarius', element: 'Fire', modality: 'Mutable', startMonth: 11, startDay: 22, endMonth: 12, endDay: 21, ruler: 'Jupiter', eclipticStartDeg: 240 },
];

export const PTOLEMAIC_SIGN_RULERS: Readonly<Record<string, string>> = {
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Mars',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Saturn',
  Pisces: 'Jupiter',
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const SYNODIC_MONTH_DAYS = 29.530588853;
const REF_NEW_MOON_JD = 2451550.25972;
const TROPICAL_YEAR_DAYS = 365.24219;

export function mod360(x: number): number {
  return ((x % 360) + 360) % 360;
}

export function shortestAngularDistance(degA: number, degB: number): number {
  let diff = Math.abs(degA - degB) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function parseStrictUtcDate(dateStr?: string | null): ParsedUtcCalendarDate | null {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, date: calendarCheck };
}

export function getTropicalZodiac(dateStr?: string | null): ZodiacSignInfo | null {
  const parsed = parseStrictUtcDate(dateStr);
  if (!parsed) return null;
  const { month, day } = parsed;
  for (const z of ZODIAC_SIGN_LIST) {
    if (z.startMonth === z.endMonth) {
      if (month === z.startMonth && day >= z.startDay && day <= z.endDay) return z;
    } else if (
      (month === z.startMonth && day >= z.startDay) ||
      (month === z.endMonth && day <= z.endDay)
    ) {
      return z;
    }
  }
  return null;
}

const MAX_OBSERVABLE_CACHE_ENTRIES = 4096;

function setBoundedCache<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maxEntries = MAX_OBSERVABLE_CACHE_ENTRIES,
): V {
  if (cache.size >= maxEntries) {
    cache.clear();
  }
  cache.set(key, value);
  return value;
}

const jdnMemo = new Map<string, number>();

export function dateToJulianDayNumber(dateStr?: string | null): number | null {
  if (typeof dateStr !== 'string') return null;
  const cached = jdnMemo.get(dateStr);
  if (cached !== undefined) return cached;
  const cal = parseStrictUtcDate(dateStr);
  if (!cal) return null;
  const { year, month, day } = cal;
  const a = Math.floor((14 - month) / 12);
  const yy = year + 4800 - a;
  const mm = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045;
  return setBoundedCache(jdnMemo, dateStr, jdn);
}

export interface SexagenaryPillar {
  readonly cycleIndex: number;
  readonly stem: { readonly index: number; readonly name: string; readonly phase: WuXingPhase; readonly polarity: 'Yang' | 'Yin' };
  readonly branch: { readonly index: number; readonly name: string; readonly animal: string; readonly phase: WuXingPhase };
}

export const HEAVENLY_STEM_LIST: ReadonlyArray<SexagenaryPillar['stem']> = [
  { index: 0, name: 'Jia', phase: 'Wood', polarity: 'Yang' },
  { index: 1, name: 'Yi', phase: 'Wood', polarity: 'Yin' },
  { index: 2, name: 'Bing', phase: 'Fire', polarity: 'Yang' },
  { index: 3, name: 'Ding', phase: 'Fire', polarity: 'Yin' },
  { index: 4, name: 'Wu', phase: 'Earth', polarity: 'Yang' },
  { index: 5, name: 'Ji', phase: 'Earth', polarity: 'Yin' },
  { index: 6, name: 'Geng', phase: 'Metal', polarity: 'Yang' },
  { index: 7, name: 'Xin', phase: 'Metal', polarity: 'Yin' },
  { index: 8, name: 'Ren', phase: 'Water', polarity: 'Yang' },
  { index: 9, name: 'Gui', phase: 'Water', polarity: 'Yin' },
];

export const EARTHLY_BRANCH_LIST: ReadonlyArray<SexagenaryPillar['branch']> = [
  { index: 0, name: 'Zi', animal: 'Rat', phase: 'Water' },
  { index: 1, name: 'Chou', animal: 'Ox', phase: 'Earth' },
  { index: 2, name: 'Yin', animal: 'Tiger', phase: 'Wood' },
  { index: 3, name: 'Mao', animal: 'Rabbit', phase: 'Wood' },
  { index: 4, name: 'Chen', animal: 'Dragon', phase: 'Earth' },
  { index: 5, name: 'Si', animal: 'Snake', phase: 'Fire' },
  { index: 6, name: 'Wu', animal: 'Horse', phase: 'Fire' },
  { index: 7, name: 'Wei', animal: 'Goat', phase: 'Earth' },
  { index: 8, name: 'Shen', animal: 'Monkey', phase: 'Metal' },
  { index: 9, name: 'You', animal: 'Rooster', phase: 'Metal' },
  { index: 10, name: 'Xu', animal: 'Dog', phase: 'Earth' },
  { index: 11, name: 'Hai', animal: 'Pig', phase: 'Water' },
];

export function computeSexagenaryDayPillar(dateStr?: string | null): SexagenaryPillar | null {
  const jdn = dateToJulianDayNumber(dateStr);
  if (jdn === null) return null;
  const cycleIndex = (((jdn + 49) % 60) + 60) % 60;
  return {
    cycleIndex,
    stem: HEAVENLY_STEM_LIST[cycleIndex % 10],
    branch: EARTHLY_BRANCH_LIST[cycleIndex % 12],
  };
}

export function computeSexagenaryYearPillar(
  dateStr?: string | null,
): (SexagenaryPillar & { readonly solarYear: number }) | null {
  const cal = parseStrictUtcDate(dateStr);
  if (!cal) return null;
  const solarYear = cal.month < 2 || (cal.month === 2 && cal.day < 4) ? cal.year - 1 : cal.year;
  const cycleIndex = (((solarYear - 4) % 60) + 60) % 60;
  return {
    solarYear,
    cycleIndex,
    stem: HEAVENLY_STEM_LIST[cycleIndex % 10],
    branch: EARTHLY_BRANCH_LIST[cycleIndex % 12],
  };
}

interface KeplerOrbitalElements {
  readonly a: number;
  readonly e: number;
  readonly L0: number;
  readonly dL: number;
  readonly wbar: number;
}

const J2000_ORBITAL_ELEMENTS: Readonly<
  Record<'earth' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn', KeplerOrbitalElements>
> = {
  earth: { a: 1.00000011, e: 0.01671022, L0: 100.46435, dL: 0.98560912, wbar: 102.94719 },
  mercury: { a: 0.38709893, e: 0.20563069, L0: 252.25084, dL: 4.0923388, wbar: 77.45645 },
  venus: { a: 0.72333199, e: 0.00677323, L0: 181.97973, dL: 1.60213049, wbar: 131.53298 },
  mars: { a: 1.52366231, e: 0.09341233, L0: 355.45332, dL: 0.52403304, wbar: 336.04084 },
  jupiter: { a: 5.20336301, e: 0.04839266, L0: 34.40438, dL: 0.08308676, wbar: 14.75385 },
  saturn: { a: 9.53707032, e: 0.0541506, L0: 49.94432, dL: 0.03346063, wbar: 92.43194 },
};

function heliocentricXY(el: KeplerOrbitalElements, daysSinceJ2000: number): { x: number; y: number } {
  const L = mod360(el.L0 + el.dL * daysSinceJ2000);
  const mDeg = mod360(L - el.wbar);
  const M = mDeg * DEG;
  let E = M + el.e * Math.sin(M);
  for (let i = 0; i < 6; i++) {
    E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  }
  const xv = el.a * (Math.cos(E) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const wRad = el.wbar * DEG;
  return {
    x: xv * Math.cos(wRad) - yv * Math.sin(wRad),
    y: xv * Math.sin(wRad) + yv * Math.cos(wRad),
  };
}

function geocentricLonAtOffset(
  planetKey: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn',
  d: number,
): number {
  const earthPos = heliocentricXY(J2000_ORBITAL_ELEMENTS.earth, d);
  const planetPos = heliocentricXY(J2000_ORBITAL_ELEMENTS[planetKey], d);
  return mod360(Math.atan2(planetPos.y - earthPos.y, planetPos.x - earthPos.x) * RAD);
}

export interface PlanetGeocentricState {
  readonly longitudeDeg: number;
  readonly speedDegPerDay: number;
  readonly isRetrograde: boolean;
}

export interface GeocentricPlanetMap {
  readonly mercury: PlanetGeocentricState;
  readonly venus: PlanetGeocentricState;
  readonly mars: PlanetGeocentricState;
  readonly jupiter: PlanetGeocentricState;
  readonly saturn: PlanetGeocentricState;
}

const PLANET_KEY_BY_NAME: Readonly<Record<string, keyof GeocentricPlanetMap>> = {
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
};

function lookupGeocentricPlanet(
  planets: GeocentricPlanetMap,
  planetName: string,
): PlanetGeocentricState {
  const planetKey = PLANET_KEY_BY_NAME[planetName.toLowerCase()] ?? 'saturn';
  return planets[planetKey];
}

export function computeGeocentricPlanetsAtJd(jd: number): GeocentricPlanetMap {
  const d = jd - 2451545.0;
  const buildState = (
    key: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn',
  ): PlanetGeocentricState => {
    const lon = geocentricLonAtOffset(key, d);
    const lonPrev = geocentricLonAtOffset(key, d - 0.5);
    const lonNext = geocentricLonAtOffset(key, d + 0.5);
    let speedDegPerDay = lonNext - lonPrev;
    if (speedDegPerDay > 180) speedDegPerDay -= 360;
    if (speedDegPerDay < -180) speedDegPerDay += 360;
    return {
      longitudeDeg: Number(lon.toFixed(4)),
      speedDegPerDay: Number(speedDegPerDay.toFixed(4)),
      isRetrograde: speedDegPerDay < 0,
    };
  };
  return {
    mercury: buildState('mercury'),
    venus: buildState('venus'),
    mars: buildState('mars'),
    jupiter: buildState('jupiter'),
    saturn: buildState('saturn'),
  };
}

export function utcMsToJulianDate(utcMs: number): { jd: number; T: number } {
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  return { jd, T };
}

export function dateStrNoonUtcMs(dateStr?: string | null): number | null {
  const cal = parseStrictUtcDate(dateStr);
  if (!cal) return null;
  return Date.UTC(cal.year, cal.month - 1, cal.day, 12, 0, 0);
}

export function computeTrueSolarLongitudeAtT(T: number): number {
  const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  return mod360(L0 + C);
}

export function computeTrueLunarLongitudeAtT(T: number): number {
  const Lp = mod360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D = mod360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * DEG;
  const M = mod360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * DEG;
  const Mp = mod360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * DEG;
  const F = mod360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T) * DEG;

  const dL =
    6.288774 * Math.sin(Mp) +
    1.274027 * Math.sin(2 * D - Mp) +
    0.658314 * Math.sin(2 * D) +
    0.213618 * Math.sin(2 * Mp) -
    0.185116 * Math.sin(M) -
    0.114332 * Math.sin(2 * F) +
    0.058793 * Math.sin(2 * D - 2 * Mp) +
    0.057066 * Math.sin(2 * D - M - Mp) +
    0.053322 * Math.sin(2 * D + Mp) +
    0.045758 * Math.sin(2 * D - M) -
    0.040923 * Math.sin(M - Mp) -
    0.03472 * Math.sin(D) -
    0.030383 * Math.sin(M + Mp) +
    0.015327 * Math.sin(2 * D - 2 * F);
  return mod360(Lp + dL);
}

export function computeMeanLunarNorthNodeAtT(T: number): number {
  return mod360(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
}

export function computeLahiriAyanamsaAtT(T: number): number {
  return 23.8531 + 1.396042 * T;
}

// ============================================================================
// 2. Vedic Jyotish & Classical Contest / Horary Sports Astrology
// ============================================================================

export const TROPICAL_SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

export const SIDEREAL_RASHIS = [
  'Mesha',
  'Vrishabha',
  'Mithuna',
  'Karka',
  'Simha',
  'Kanya',
  'Tula',
  'Vrischika',
  'Dhanu',
  'Makara',
  'Kumbha',
  'Meena',
] as const;

export const VEDIC_NAKSHATRAS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Moola',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
] as const;

const KSHIPRA_NAKSHATRA_INDICES = new Set<number>([0, 7, 12]);

export const CHALDEAN_HOUR_ORDER = [
  'Saturn',
  'Jupiter',
  'Mars',
  'Sun',
  'Venus',
  'Mercury',
  'Moon',
] as const;

const WEEKDAY_SUNRISE_CHALDEAN_INDEX = [3, 6, 2, 5, 1, 4, 0] as const;

const EXALTATION_SIGN_BY_PLANET: Readonly<Record<string, number>> = {
  Sun: 0,
  Moon: 1,
  Jupiter: 3,
  Mercury: 5,
  Saturn: 6,
  Mars: 9,
  Venus: 11,
};

const TRIPLICITY_RULERS_BY_ELEMENT: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['Sun', 'Jupiter']),
  new Set(['Venus', 'Moon']),
  new Set(['Saturn', 'Mercury']),
  new Set(['Venus', 'Mars']),
];

export interface SiderealDayState {
  readonly ayanamsaDeg: number;
  readonly sidSunDeg: number;
  readonly sidMoonDeg: number;
  readonly sidMarsDeg: number;
  readonly nakshatraIndex: number;
  readonly nakshatraName: string;
  readonly moonRashiIndex: number;
  readonly moonRashiName: string;
  readonly sunRashiIndex: number;
  readonly sunRashiName: string;
  readonly marsRashiIndex: number;
  readonly isKshipraMoon: boolean;
  readonly isMarsStrongSidereal: boolean;
}

const vedicDayCache = new Map<string, SiderealDayState>();

export function computeSiderealStateForDate(dateStr?: string | null): SiderealDayState | null {
  if (typeof dateStr !== 'string') return null;
  const cached = vedicDayCache.get(dateStr);
  if (cached) return cached;
  const utcMs = dateStrNoonUtcMs(dateStr);
  if (utcMs === null) return null;

  const { jd, T } = utcMsToJulianDate(utcMs);
  const ayanamsa = computeLahiriAyanamsaAtT(T);
  const tropSun = computeTrueSolarLongitudeAtT(T);
  const tropMoon = computeTrueLunarLongitudeAtT(T);
  const planets = computeGeocentricPlanetsAtJd(jd);

  const sidSun = mod360(tropSun - ayanamsa);
  const sidMoon = mod360(tropMoon - ayanamsa);
  const sidMars = mod360(planets.mars.longitudeDeg - ayanamsa);

  const nakshatraIndex = Math.min(26, Math.floor(sidMoon / (360 / 27)));
  const moonRashiIndex = Math.min(11, Math.floor(sidMoon / 30));
  const sunRashiIndex = Math.min(11, Math.floor(sidSun / 30));
  const marsRashiIndex = Math.min(11, Math.floor(sidMars / 30));

  const state: SiderealDayState = {
    ayanamsaDeg: Number(ayanamsa.toFixed(4)),
    sidSunDeg: Number(sidSun.toFixed(3)),
    sidMoonDeg: Number(sidMoon.toFixed(3)),
    sidMarsDeg: Number(sidMars.toFixed(3)),
    nakshatraIndex,
    nakshatraName: VEDIC_NAKSHATRAS[nakshatraIndex],
    moonRashiIndex,
    moonRashiName: SIDEREAL_RASHIS[moonRashiIndex],
    sunRashiIndex,
    sunRashiName: SIDEREAL_RASHIS[sunRashiIndex],
    marsRashiIndex,
    isKshipraMoon: KSHIPRA_NAKSHATRA_INDICES.has(nakshatraIndex),
    isMarsStrongSidereal: marsRashiIndex === 0 || marsRashiIndex === 7 || marsRashiIndex === 9,
  };
  return setBoundedCache(vedicDayCache, dateStr, state);
}

export interface VedicJyotishObservables {
  readonly gameNakshatra: string | null;
  readonly natalNakshatra: string | null;
  readonly natalMoonRashi: string | null;
  readonly taraBalaNumber: number | null;
  readonly isSadhanaOrParamaTara: boolean;
  readonly isMaleficTaraHazard: boolean;
  readonly gocharaMoonHouse: number | null;
  readonly isChandrashtama8thMoon: boolean;
  readonly isUpachayaVictoryMoon: boolean;
  readonly isKshipraSwiftMoon: boolean;
  readonly isNatalSiderealMarsStrong: boolean;
}

export function extractVedicJyotishObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): VedicJyotishObservables {
  const gameVedic = computeSiderealStateForDate(gameDateStr);
  const natalVedic = computeSiderealStateForDate(birthDateStr);

  if (!gameVedic) {
    return {
      gameNakshatra: null,
      natalNakshatra: natalVedic?.nakshatraName ?? null,
      natalMoonRashi: natalVedic?.moonRashiName ?? null,
      taraBalaNumber: null,
      isSadhanaOrParamaTara: false,
      isMaleficTaraHazard: false,
      gocharaMoonHouse: null,
      isChandrashtama8thMoon: false,
      isUpachayaVictoryMoon: false,
      isKshipraSwiftMoon: false,
      isNatalSiderealMarsStrong: natalVedic?.isMarsStrongSidereal ?? false,
    };
  }

  if (!natalVedic) {
    return {
      gameNakshatra: gameVedic.nakshatraName,
      natalNakshatra: null,
      natalMoonRashi: null,
      taraBalaNumber: null,
      isSadhanaOrParamaTara: false,
      isMaleficTaraHazard: false,
      gocharaMoonHouse: null,
      isChandrashtama8thMoon: false,
      isUpachayaVictoryMoon: false,
      isKshipraSwiftMoon: gameVedic.isKshipraMoon,
      isNatalSiderealMarsStrong: false,
    };
  }

  const nakDist = (gameVedic.nakshatraIndex - natalVedic.nakshatraIndex + 27) % 27;
  const taraBalaNumber = (nakDist % 9) + 1;
  const isSadhanaOrParamaTara = taraBalaNumber === 6 || taraBalaNumber === 9;
  const isMaleficTaraHazard =
    taraBalaNumber === 3 || taraBalaNumber === 5 || taraBalaNumber === 7;

  const gocharaMoonHouse =
    ((gameVedic.moonRashiIndex - natalVedic.moonRashiIndex + 12) % 12) + 1;
  const isChandrashtama8thMoon = gocharaMoonHouse === 8;
  const isUpachayaVictoryMoon =
    gocharaMoonHouse === 3 ||
    gocharaMoonHouse === 6 ||
    gocharaMoonHouse === 10 ||
    gocharaMoonHouse === 11;

  return {
    gameNakshatra: gameVedic.nakshatraName,
    natalNakshatra: natalVedic.nakshatraName,
    natalMoonRashi: natalVedic.moonRashiName,
    taraBalaNumber,
    isSadhanaOrParamaTara,
    isMaleficTaraHazard,
    gocharaMoonHouse,
    isChandrashtama8thMoon,
    isUpachayaVictoryMoon,
    isKshipraSwiftMoon: gameVedic.isKshipraMoon,
    isNatalSiderealMarsStrong: natalVedic.isMarsStrongSidereal,
  };
}

export function computeAscendantAndMc(
  utcMs: number,
  latDeg: number,
  lonDeg: number,
): { ascDeg: number; dscDeg: number; mcDeg: number } {
  const { jd, T } = utcMsToJulianDate(utcMs);
  const gmstDeg = mod360(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T,
  );
  const lstRad = mod360(gmstDeg + lonDeg) * DEG;
  const epsRad = 23.4392911 * DEG;
  const phiRad = latDeg * DEG;

  const mcDeg = mod360(
    Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(epsRad)) * RAD,
  );
  const y = Math.cos(lstRad);
  const x = -(Math.sin(lstRad) * Math.cos(epsRad) + Math.tan(phiRad) * Math.sin(epsRad));
  const ascDeg = mod360(Math.atan2(y, x) * RAD);
  const dscDeg = mod360(ascDeg + 180);

  return { ascDeg, dscDeg, mcDeg };
}

export function resolveCanonicalKickoffUtcMs(
  gameDateStr?: string | null,
  hostLonDeg = -90,
  kickoffUtc?: string | null,
): number | null {
  if (kickoffUtc) {
    const parsed = new Date(kickoffUtc).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const cal = parseStrictUtcDate(gameDateStr);
  if (!cal) return null;
  const wd = cal.date.getUTCDay();
  const dayStartMs = Date.UTC(cal.year, cal.month - 1, cal.day, 0, 0, 0);
  if (wd === 1 || wd === 4 || wd === 5) {
    return dayStartMs + 25.25 * 3600 * 1000;
  }
  if (hostLonDeg <= -104) {
    return dayStartMs + 21.25 * 3600 * 1000;
  }
  return dayStartMs + 18.0 * 3600 * 1000;
}

export interface ClassicalPlanetDignityEval {
  readonly planetName: string;
  readonly longitudeDeg: number;
  readonly signName: string;
  readonly dignityScore: number;
  readonly isRetrograde: boolean;
  readonly isCombust: boolean;
  readonly isAfflicted: boolean;
}

export function evaluateClassicalPlanetDignity(
  planetName: string,
  sky: { sunLon: number; moonLon: number; planets: GeocentricPlanetMap },
): ClassicalPlanetDignityEval {
  let lon = 0;
  let isRetro = false;
  if (planetName === 'Sun') {
    lon = sky.sunLon;
  } else if (planetName === 'Moon') {
    lon = sky.moonLon;
  } else {
    const planet = lookupGeocentricPlanet(sky.planets, planetName);
    lon = planet.longitudeDeg;
    isRetro = planet.isRetrograde;
  }

  const signIdx = Math.min(11, Math.floor(lon / 30));
  const signName = TROPICAL_SIGN_NAMES[signIdx];
  const oppSignName = TROPICAL_SIGN_NAMES[(signIdx + 6) % 12];

  let score = 0;
  if (PTOLEMAIC_SIGN_RULERS[signName] === planetName) score += 5;
  if (PTOLEMAIC_SIGN_RULERS[oppSignName] === planetName) score -= 5;

  const exaltSign = EXALTATION_SIGN_BY_PLANET[planetName];
  if (exaltSign === signIdx) score += 4;
  if (exaltSign !== undefined && (exaltSign + 6) % 12 === signIdx) score -= 4;

  if (TRIPLICITY_RULERS_BY_ELEMENT[signIdx % 4].has(planetName)) score += 3;

  let isCombust = false;
  if (planetName !== 'Sun') {
    const sunDist = shortestAngularDistance(lon, sky.sunLon);
    if (planetName === 'Moon') {
      const elong = mod360(sky.moonLon - sky.sunLon);
      score += elong < 180 ? 2 : -1;
      if (sunDist <= 12.0) {
        score -= 4;
        isCombust = true;
      }
    } else {
      if (sunDist <= 0.283) {
        score += 5;
      } else if (sunDist <= 8.5) {
        score -= 5;
        isCombust = true;
      } else if (sunDist <= 17.0) {
        score -= 2;
      }
      if (isRetro) score -= 4;
    }
  }

  return {
    planetName,
    longitudeDeg: lon,
    signName,
    dignityScore: score,
    isRetrograde: isRetro,
    isCombust,
    isAfflicted: isRetro || isCombust,
  };
}

export function computeChaldeanPlanetaryHour(
  utcMs: number,
  latDeg: number,
  lonDeg: number,
  sunLonDeg: number,
): { planetaryHourNumber: number; isDiurnalHour: boolean; hourRuler: string } {
  const obliqRad = 23.4392911 * DEG;
  const sinDecl = Math.sin(obliqRad) * Math.sin(sunLonDeg * DEG);
  const declRad = Math.asin(Math.max(-1, Math.min(1, sinDecl)));
  const phiRad = latDeg * DEG;

  const cosH0 = Math.max(-0.98, Math.min(0.98, -Math.tan(phiRad) * Math.tan(declRad)));
  const semiDiurnalHours = (Math.acos(cosH0) * 12) / Math.PI;
  const sunriseHour = 12 - semiDiurnalHours;
  const sunsetHour = 12 + semiDiurnalHours;

  const localSolarMs = utcMs + (lonDeg / 15) * 3600 * 1000;
  const localDate = new Date(localSolarMs);
  const localSolarHour =
    localDate.getUTCHours() +
    localDate.getUTCMinutes() / 60 +
    localDate.getUTCSeconds() / 3600;

  let solarWeekday = localDate.getUTCDay();
  let hourIndex0to23 = 0;

  if (localSolarHour >= sunriseHour && localSolarHour < sunsetHour) {
    const daySpan = Math.max(0.5, sunsetHour - sunriseHour);
    hourIndex0to23 = Math.min(11, Math.floor((12 * (localSolarHour - sunriseHour)) / daySpan));
  } else if (localSolarHour >= sunsetHour) {
    const nightSpan = Math.max(0.5, 24 - (sunsetHour - sunriseHour));
    hourIndex0to23 =
      12 + Math.min(11, Math.floor((12 * (localSolarHour - sunsetHour)) / nightSpan));
  } else {
    solarWeekday = (solarWeekday + 6) % 7;
    const nightSpan = Math.max(0.5, 24 - (sunsetHour - sunriseHour));
    const elapsedSincePrevSunset = 24 - sunsetHour + localSolarHour;
    hourIndex0to23 =
      12 + Math.min(11, Math.floor((12 * elapsedSincePrevSunset) / nightSpan));
  }

  const startIdx = WEEKDAY_SUNRISE_CHALDEAN_INDEX[solarWeekday];
  const ruler = CHALDEAN_HOUR_ORDER[(startIdx + hourIndex0to23) % 7];
  return {
    planetaryHourNumber: hourIndex0to23 + 1,
    isDiurnalHour: hourIndex0to23 < 12,
    hourRuler: ruler,
  };
}

export interface ContestHoraryObservables {
  readonly ascSign: string | null;
  readonly dscSign: string | null;
  readonly myHouseLord: string | null;
  readonly oppHouseLord: string | null;
  readonly lordDignityDelta: number;
  readonly hasLordDignityAdvantage: boolean;
  readonly hasLordDignityDeficit: boolean;
  readonly isMyHouseLordAfflicted: boolean;
  readonly isViaCombustaMoon: boolean;
  readonly planetaryHourRuler: string | null;
  readonly isPlanetaryHourNatalMatch: boolean;
  readonly isMartialOrJovialHour: boolean;
}

interface CachedContestChart {
  readonly ascSign: string;
  readonly dscSign: string;
  readonly l1Eval: ClassicalPlanetDignityEval;
  readonly l7Eval: ClassicalPlanetDignityEval;
  readonly isViaCombustaMoon: boolean;
  readonly planetaryHourRuler: string;
}

const contestGameCache = new Map<string, CachedContestChart>();

export function extractContestHoraryObservables(params: {
  isHome?: boolean;
  hostStadium?: HostStadiumCoords | null;
  gameDate?: string | null;
  kickoffUtc?: string | null;
  natalDomicileRuler?: string | null;
}): ContestHoraryObservables {
  const isHome = params.isHome ?? true;
  const resolvedHost = params.hostStadium ?? null;
  const gameDate = params.gameDate ?? null;

  if (!gameDate || !resolvedHost) {
    return {
      ascSign: null,
      dscSign: null,
      myHouseLord: null,
      oppHouseLord: null,
      lordDignityDelta: 0,
      hasLordDignityAdvantage: false,
      hasLordDignityDeficit: false,
      isMyHouseLordAfflicted: false,
      isViaCombustaMoon: false,
      planetaryHourRuler: null,
      isPlanetaryHourNatalMatch: false,
      isMartialOrJovialHour: false,
    };
  }

  const cacheKey = `${gameDate}|${resolvedHost.stadiumId}|${params.kickoffUtc || 'canon'}`;
  let baseChart = contestGameCache.get(cacheKey);

  if (!baseChart) {
    const kickMs = resolveCanonicalKickoffUtcMs(gameDate, resolvedHost.lon, params.kickoffUtc);
    if (kickMs === null) {
      return {
        ascSign: null,
        dscSign: null,
        myHouseLord: null,
        oppHouseLord: null,
        lordDignityDelta: 0,
        hasLordDignityAdvantage: false,
        hasLordDignityDeficit: false,
        isMyHouseLordAfflicted: false,
        isViaCombustaMoon: false,
        planetaryHourRuler: null,
        isPlanetaryHourNatalMatch: false,
        isMartialOrJovialHour: false,
      };
    }
    const { jd, T } = utcMsToJulianDate(kickMs);
    const sunLon = computeTrueSolarLongitudeAtT(T);
    const moonLon = computeTrueLunarLongitudeAtT(T);
    const planets = computeGeocentricPlanetsAtJd(jd);
    const sky = { sunLon, moonLon, planets };

    const angles = computeAscendantAndMc(kickMs, resolvedHost.lat, resolvedHost.lon);
    const ascSignIdx = Math.min(11, Math.floor(angles.ascDeg / 30));
    const dscSignIdx = (ascSignIdx + 6) % 12;
    const ascSign = TROPICAL_SIGN_NAMES[ascSignIdx];
    const dscSign = TROPICAL_SIGN_NAMES[dscSignIdx];

    const l1Planet = PTOLEMAIC_SIGN_RULERS[ascSign];
    const l7Planet = PTOLEMAIC_SIGN_RULERS[dscSign];
    const l1Eval = evaluateClassicalPlanetDignity(l1Planet, sky);
    const l7Eval = evaluateClassicalPlanetDignity(l7Planet, sky);
    const pHour = computeChaldeanPlanetaryHour(kickMs, resolvedHost.lat, resolvedHost.lon, sunLon);
    const isViaCombustaMoon = moonLon >= 195.0 && moonLon <= 225.0;

    baseChart = {
      ascSign,
      dscSign,
      l1Eval,
      l7Eval,
      isViaCombustaMoon,
      planetaryHourRuler: pHour.hourRuler,
    };
    setBoundedCache(contestGameCache, cacheKey, baseChart);
  }

  const myEval = isHome ? baseChart.l1Eval : baseChart.l7Eval;
  const oppEval = isHome ? baseChart.l7Eval : baseChart.l1Eval;
  const lordDignityDelta =
    myEval.planetName === oppEval.planetName ? 0 : myEval.dignityScore - oppEval.dignityScore;

  return {
    ascSign: baseChart.ascSign,
    dscSign: baseChart.dscSign,
    myHouseLord: myEval.planetName,
    oppHouseLord: oppEval.planetName,
    lordDignityDelta,
    hasLordDignityAdvantage: lordDignityDelta >= 3,
    hasLordDignityDeficit: lordDignityDelta <= -3,
    isMyHouseLordAfflicted: myEval.isAfflicted,
    isViaCombustaMoon: baseChart.isViaCombustaMoon,
    planetaryHourRuler: baseChart.planetaryHourRuler,
    isPlanetaryHourNatalMatch: Boolean(
      params.natalDomicileRuler && params.natalDomicileRuler === baseChart.planetaryHourRuler,
    ),
    isMartialOrJovialHour:
      baseChart.planetaryHourRuler === 'Mars' || baseChart.planetaryHourRuler === 'Jupiter',
  };
}

// ============================================================================
// 3. Secondary Progressions, Cosmobiology Midpoints & Annual Profections
// ============================================================================

export function computeCircularMidpointDeg(lonA: number, lonB: number): number {
  const aRad = lonA * DEG;
  const bRad = lonB * DEG;
  const sumSin = Math.sin(aRad) + Math.sin(bRad);
  const sumCos = Math.cos(aRad) + Math.cos(bRad);
  if (Math.abs(sumSin) < 1e-9 && Math.abs(sumCos) < 1e-9) {
    return mod360(lonA + 90);
  }
  return mod360(Math.atan2(sumSin, sumCos) * RAD);
}

export function dial45DistanceDeg(lonA: number, lonB: number): number {
  const diff = Math.abs(lonA - lonB) % 45;
  return Math.min(diff, 45 - diff);
}

interface CachedNatalSky {
  readonly birthMs: number;
  readonly jd: number;
  readonly sunLon: number;
  readonly moonLon: number;
  readonly northNodeLon: number;
  readonly southNodeLon: number;
  readonly sunSignIdx: number;
  readonly planets: GeocentricPlanetMap;
  readonly sunMarsMidpoint: number;
  readonly marsJupiterMidpoint: number;
  readonly marsSaturnMidpoint: number;
}

interface CachedTransitSky {
  readonly gameMs: number;
  readonly jd: number;
  readonly sunLon: number;
  readonly moonLon: number;
  readonly northNodeLon: number;
  readonly southNodeLon: number;
  readonly planets: GeocentricPlanetMap;
  readonly isEclipseSeason: boolean;
}

const natalChartCache = new Map<string, CachedNatalSky>();
const transitSkyCache = new Map<string, CachedTransitSky>();

function getCachedNatalSky(birthDateStr?: string | null): CachedNatalSky | null {
  if (typeof birthDateStr !== 'string') return null;
  const cached = natalChartCache.get(birthDateStr);
  if (cached) return cached;
  const birthMs = dateStrNoonUtcMs(birthDateStr);
  if (birthMs === null) return null;

  const { jd, T } = utcMsToJulianDate(birthMs);
  const sunLon = computeTrueSolarLongitudeAtT(T);
  const moonLon = computeTrueLunarLongitudeAtT(T);
  const northNodeLon = computeMeanLunarNorthNodeAtT(T);
  const planets = computeGeocentricPlanetsAtJd(jd);
  const sunSignIdx = Math.min(11, Math.floor(sunLon / 30));

  const sky: CachedNatalSky = {
    birthMs,
    jd,
    sunLon,
    moonLon,
    northNodeLon,
    southNodeLon: mod360(northNodeLon + 180),
    sunSignIdx,
    planets,
    sunMarsMidpoint: computeCircularMidpointDeg(sunLon, planets.mars.longitudeDeg),
    marsJupiterMidpoint: computeCircularMidpointDeg(
      planets.mars.longitudeDeg,
      planets.jupiter.longitudeDeg,
    ),
    marsSaturnMidpoint: computeCircularMidpointDeg(
      planets.mars.longitudeDeg,
      planets.saturn.longitudeDeg,
    ),
  };
  return setBoundedCache(natalChartCache, birthDateStr, sky);
}

function getCachedTransitSky(gameDateStr?: string | null): CachedTransitSky | null {
  if (typeof gameDateStr !== 'string') return null;
  const cached = transitSkyCache.get(gameDateStr);
  if (cached) return cached;
  const gameMs = dateStrNoonUtcMs(gameDateStr);
  if (gameMs === null) return null;

  const { jd, T } = utcMsToJulianDate(gameMs);
  const sunLon = computeTrueSolarLongitudeAtT(T);
  const moonLon = computeTrueLunarLongitudeAtT(T);
  const northNodeLon = computeMeanLunarNorthNodeAtT(T);
  const planets = computeGeocentricPlanetsAtJd(jd);
  const nodeDistSun = Math.min(
    shortestAngularDistance(sunLon, northNodeLon),
    shortestAngularDistance(sunLon, mod360(northNodeLon + 180)),
  );

  const sky: CachedTransitSky = {
    gameMs,
    jd,
    sunLon,
    moonLon,
    northNodeLon,
    southNodeLon: mod360(northNodeLon + 180),
    planets,
    isEclipseSeason: nodeDistSun <= 15.0,
  };
  return setBoundedCache(transitSkyCache, gameDateStr, sky);
}

function isSoftAspect(degA: number, degB: number, orb = 3.0): boolean {
  const d = shortestAngularDistance(degA, degB);
  return d <= orb || Math.abs(d - 60) <= orb || Math.abs(d - 120) <= orb;
}

function isHardAspect(degA: number, degB: number, orb = 3.0): boolean {
  const d = shortestAngularDistance(degA, degB);
  return Math.abs(d - 90) <= orb || Math.abs(d - 180) <= orb;
}

export interface SecondaryProgressionObservables {
  readonly progressedSunDeg: number | null;
  readonly solarArcDeg: number | null;
  readonly isProgSunMarsHarmonic: boolean;
  readonly isProgSunMarsHardAspect: boolean;
  readonly isProgMoonWaxing: boolean;
  readonly isProgLunarReturnWindow: boolean;
  readonly hasProgSunIngressedSign: boolean;
  readonly isTransitSunConjProgSun: boolean;
}

export function extractSecondaryProgressionObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): SecondaryProgressionObservables {
  const natal = getCachedNatalSky(birthDateStr);
  const transit = getCachedTransitSky(gameDateStr);
  if (!natal || !transit || transit.jd <= natal.jd) {
    return {
      progressedSunDeg: null,
      solarArcDeg: null,
      isProgSunMarsHarmonic: false,
      isProgSunMarsHardAspect: false,
      isProgMoonWaxing: false,
      isProgLunarReturnWindow: false,
      hasProgSunIngressedSign: false,
      isTransitSunConjProgSun: false,
    };
  }

  const ageYears = (transit.jd - natal.jd) / TROPICAL_YEAR_DAYS;
  const progJd = natal.jd + ageYears;
  const progT = (progJd - 2451545.0) / 36525.0;

  const progSun = computeTrueSolarLongitudeAtT(progT);
  const progMoon = computeTrueLunarLongitudeAtT(progT);
  const solarArcDeg = mod360(progSun - natal.sunLon);
  const solarArcMars = mod360(natal.planets.mars.longitudeDeg + solarArcDeg);

  const isProgSunMarsHarmonic =
    isSoftAspect(progSun, natal.planets.mars.longitudeDeg, 3.0) ||
    isSoftAspect(solarArcMars, natal.sunLon, 3.0);

  const isProgSunMarsHardAspect =
    isHardAspect(progSun, natal.planets.mars.longitudeDeg, 3.0) ||
    isHardAspect(solarArcMars, natal.sunLon, 3.0);

  const progLunationAngle = mod360(progMoon - progSun);
  const isProgMoonWaxing = progLunationAngle > 0 && progLunationAngle < 180;
  const isProgLunarReturnWindow = shortestAngularDistance(progMoon, natal.moonLon) <= 12.0;

  const progSunSignIdx = Math.min(11, Math.floor(progSun / 30));
  const hasProgSunIngressedSign = progSunSignIdx !== natal.sunSignIdx;
  const isTransitSunConjProgSun = shortestAngularDistance(transit.sunLon, progSun) <= 6.0;

  return {
    progressedSunDeg: Number(progSun.toFixed(3)),
    solarArcDeg: Number(solarArcDeg.toFixed(3)),
    isProgSunMarsHarmonic,
    isProgSunMarsHardAspect,
    isProgMoonWaxing,
    isProgLunarReturnWindow,
    hasProgSunIngressedSign,
    isTransitSunConjProgSun,
  };
}

export interface CosmobiologyObservables {
  readonly isMarsJupiterVictoryDial: boolean;
  readonly isSunMarsVitalityDial: boolean;
  readonly isMarsSaturnAttritionDial: boolean;
  readonly isHarmonic5QuintileFlow: boolean;
  readonly isHarmonic7SeptileResonance: boolean;
  readonly isNodalReturnOrReverse: boolean;
  readonly isEclipseSeasonGame: boolean;
}

export function extractCosmobiologyObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): CosmobiologyObservables {
  const transit = getCachedTransitSky(gameDateStr);
  const natal = getCachedNatalSky(birthDateStr);

  if (!transit) {
    return {
      isMarsJupiterVictoryDial: false,
      isSunMarsVitalityDial: false,
      isMarsSaturnAttritionDial: false,
      isHarmonic5QuintileFlow: false,
      isHarmonic7SeptileResonance: false,
      isNodalReturnOrReverse: false,
      isEclipseSeasonGame: false,
    };
  }

  if (!natal) {
    return {
      isMarsJupiterVictoryDial: false,
      isSunMarsVitalityDial: false,
      isMarsSaturnAttritionDial: false,
      isHarmonic5QuintileFlow: false,
      isHarmonic7SeptileResonance: false,
      isNodalReturnOrReverse: false,
      isEclipseSeasonGame: transit.isEclipseSeason,
    };
  }

  const tSun = transit.sunLon;
  const tMars = transit.planets.mars.longitudeDeg;
  const tJup = transit.planets.jupiter.longitudeDeg;
  const tSat = transit.planets.saturn.longitudeDeg;

  const isMarsJupiterVictoryDial =
    dial45DistanceDeg(tSun, natal.marsJupiterMidpoint) <= 2.0 ||
    dial45DistanceDeg(tMars, natal.marsJupiterMidpoint) <= 2.0 ||
    dial45DistanceDeg(tJup, natal.marsJupiterMidpoint) <= 2.0;

  const isSunMarsVitalityDial =
    dial45DistanceDeg(tSun, natal.sunMarsMidpoint) <= 2.0 ||
    dial45DistanceDeg(tMars, natal.sunMarsMidpoint) <= 2.0;

  const isMarsSaturnAttritionDial =
    dial45DistanceDeg(tMars, natal.marsSaturnMidpoint) <= 2.0 ||
    dial45DistanceDeg(tSat, natal.marsSaturnMidpoint) <= 2.0;

  const checkQuintile = (a: number, b: number): boolean => {
    const d = shortestAngularDistance(a, b);
    return Math.abs(d - 72) <= 2.0 || Math.abs(d - 144) <= 2.0;
  };
  const isHarmonic5QuintileFlow =
    checkQuintile(tSun, natal.sunLon) ||
    checkQuintile(tSun, natal.planets.mars.longitudeDeg) ||
    checkQuintile(tMars, natal.sunLon) ||
    checkQuintile(tMars, natal.planets.mars.longitudeDeg);

  const checkSeptile = (a: number, b: number): boolean => {
    const d = shortestAngularDistance(a, b);
    return (
      Math.abs(d - 360 / 7) <= 1.5 ||
      Math.abs(d - 720 / 7) <= 1.5 ||
      Math.abs(d - 1080 / 7) <= 1.5
    );
  };
  const isHarmonic7SeptileResonance =
    checkSeptile(tSun, natal.sunLon) ||
    checkSeptile(tMars, natal.sunLon) ||
    checkSeptile(tSun, natal.planets.mars.longitudeDeg);

  const nodeDiff = shortestAngularDistance(transit.northNodeLon, natal.northNodeLon);
  const isNodalReturnOrReverse = nodeDiff <= 10.0 || Math.abs(nodeDiff - 180.0) <= 10.0;

  return {
    isMarsJupiterVictoryDial,
    isSunMarsVitalityDial,
    isMarsSaturnAttritionDial,
    isHarmonic5QuintileFlow,
    isHarmonic7SeptileResonance,
    isNodalReturnOrReverse,
    isEclipseSeasonGame: transit.isEclipseSeason,
  };
}

export function computeCompletedSolarAge(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): number | null {
  const b = parseStrictUtcDate(birthDateStr);
  const g = parseStrictUtcDate(gameDateStr);
  if (!b || !g) return null;
  let age = g.year - b.year;
  if (g.month < b.month || (g.month === b.month && g.day < b.day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export interface AnnualProfectionObservables {
  readonly completedAge: number | null;
  readonly profectedHouse: number | null;
  readonly profectedSign: string | null;
  readonly timeLordPlanet: string | null;
  readonly isAngularProfectionYear: boolean;
  readonly isMaleficHouseProfectionYear: boolean;
  readonly isBeneficTimeLordYear: boolean;
  readonly isMaleficTimeLordYear: boolean;
  readonly isTimeLordRetrogradeOnGame: boolean;
  readonly isTimeLordDignifiedOnGame: boolean;
  readonly isTimeLordHarmonicToNatal: boolean;
}

export function extractAnnualProfectionObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): AnnualProfectionObservables {
  const natal = getCachedNatalSky(birthDateStr);
  const transit = getCachedTransitSky(gameDateStr);
  const completedAge = computeCompletedSolarAge(birthDateStr, gameDateStr);

  if (!natal || !transit || completedAge === null) {
    return {
      completedAge: null,
      profectedHouse: null,
      profectedSign: null,
      timeLordPlanet: null,
      isAngularProfectionYear: false,
      isMaleficHouseProfectionYear: false,
      isBeneficTimeLordYear: false,
      isMaleficTimeLordYear: false,
      isTimeLordRetrogradeOnGame: false,
      isTimeLordDignifiedOnGame: false,
      isTimeLordHarmonicToNatal: false,
    };
  }

  const profectedHouse = (completedAge % 12) + 1;
  const profectedSignIdx = (natal.sunSignIdx + completedAge) % 12;
  const profectedSign = TROPICAL_SIGN_NAMES[profectedSignIdx];
  const timeLordPlanet = PTOLEMAIC_SIGN_RULERS[profectedSign];

  const isAngularProfectionYear =
    profectedHouse === 1 ||
    profectedHouse === 4 ||
    profectedHouse === 7 ||
    profectedHouse === 10;

  const isMaleficHouseProfectionYear =
    profectedHouse === 6 || profectedHouse === 8 || profectedHouse === 12;

  const isBeneficTimeLordYear = timeLordPlanet === 'Jupiter' || timeLordPlanet === 'Venus';
  const isMaleficTimeLordYear = timeLordPlanet === 'Mars' || timeLordPlanet === 'Saturn';

  const tlTransitEval = evaluateClassicalPlanetDignity(timeLordPlanet, transit);
  const isTimeLordRetrogradeOnGame = tlTransitEval.isRetrograde;
  const isTimeLordDignifiedOnGame = tlTransitEval.dignityScore >= 4;

  let natalTlLon = natal.sunLon;
  if (timeLordPlanet === 'Moon') {
    natalTlLon = natal.moonLon;
  } else if (timeLordPlanet !== 'Sun') {
    natalTlLon = lookupGeocentricPlanet(natal.planets, timeLordPlanet).longitudeDeg;
  }

  const isTimeLordHarmonicToNatal = isSoftAspect(tlTransitEval.longitudeDeg, natalTlLon, 8.0);

  return {
    completedAge,
    profectedHouse,
    profectedSign,
    timeLordPlanet,
    isAngularProfectionYear,
    isMaleficHouseProfectionYear,
    isBeneficTimeLordYear,
    isMaleficTimeLordYear,
    isTimeLordRetrogradeOnGame,
    isTimeLordDignifiedOnGame,
    isTimeLordHarmonicToNatal,
  };
}

// ============================================================================
// 4. World Astrological Traditions: Arabic Manazil, Fixed Stars, Decans, Rokuyo & Synastry
// ============================================================================

const PICATRIX_VICTORY_MANAZIL = new Set<number>([0, 2, 5, 10, 13, 16, 21, 23]);
const PICATRIX_DISCORD_MANAZIL = new Set<number>([1, 6, 8, 14, 18, 22, 27]);
const DIURNAL_SECT_PLANETS = new Set<string>(['Sun', 'Jupiter', 'Saturn']);
const NOCTURNAL_SECT_PLANETS = new Set<string>(['Moon', 'Venus', 'Mars']);

export const EGYPTIAN_DECAN_RULERS = [
  'Mars',
  'Sun',
  'Venus',
  'Mercury',
  'Moon',
  'Saturn',
  'Jupiter',
] as const;

interface FixedStarEntry {
  readonly name: string;
  readonly lonJ2000: number;
}

export const FIXED_STARS_J2000: Readonly<{
  royal: readonly FixedStarEntry[];
  glory: readonly FixedStarEntry[];
  hazard: readonly FixedStarEntry[];
}> = {
  royal: [
    { name: 'Aldebaran', lonJ2000: 69.789 },
    { name: 'Regulus', lonJ2000: 149.829 },
    { name: 'Antares', lonJ2000: 249.762 },
    { name: 'Fomalhaut', lonJ2000: 333.868 },
  ],
  glory: [
    { name: 'Betelgeuse', lonJ2000: 88.753 },
    { name: 'Sirius', lonJ2000: 104.083 },
    { name: 'Spica', lonJ2000: 203.841 },
    { name: 'Arcturus', lonJ2000: 204.233 },
    { name: 'Vega', lonJ2000: 285.317 },
  ],
  hazard: [
    { name: 'Algol', lonJ2000: 56.167 },
    { name: 'Scheat', lonJ2000: 359.375 },
  ],
};

const ROKUYO_NAMES = ['Sensho', 'Tomobiki', 'Senbu', 'Butsumetsu', 'Taian', 'Shakko'] as const;

interface DateAstroBundle {
  readonly jd: number;
  readonly jdn: number;
  readonly T: number;
  readonly precessDeg: number;
  readonly sunLon: number;
  readonly moonLon: number;
  readonly planets: GeocentricPlanetMap;
  readonly manzilIndex: number;
  readonly sunDecanIndex: number;
  readonly sunDecanRuler: string;
  readonly lunarMonth1to12: number;
  readonly lunarDay1to30: number;
  readonly rokuyoIdx: number;
  readonly rokuyoName: string;
  readonly lotOfVictoryDeg: number;
}

const dateAstroCache = new Map<string, DateAstroBundle>();

function getDateAstroBundle(dateStr?: string | null): DateAstroBundle | null {
  if (typeof dateStr !== 'string') return null;
  const cached = dateAstroCache.get(dateStr);
  if (cached) return cached;
  const ms = dateStrNoonUtcMs(dateStr);
  const jdn = dateToJulianDayNumber(dateStr);
  if (ms === null || jdn === null) return null;

  const { jd, T } = utcMsToJulianDate(ms);
  const sunLon = computeTrueSolarLongitudeAtT(T);
  const moonLon = computeTrueLunarLongitudeAtT(T);
  const planets = computeGeocentricPlanetsAtJd(jd);
  const precessDeg = 1.396971 * T;

  const manzilIndex = Math.min(27, Math.floor(moonLon / (360 / 28)));
  const sunDecanIndex = Math.min(35, Math.floor(sunLon / 10));
  const sunDecanRuler = EGYPTIAN_DECAN_RULERS[sunDecanIndex % 7];

  const elapsedFromRef = jd - REF_NEW_MOON_JD;
  const lunationAgeDays =
    ((elapsedFromRef % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const lunarDay1to30 = Math.min(30, Math.floor(lunationAgeDays) + 1);
  const newMoonJd = jd - lunationAgeDays;
  const newMoonT = (newMoonJd - 2451545.0) / 36525.0;
  const newMoonSunLon = computeTrueSolarLongitudeAtT(newMoonT);
  const newMoonSignIdx = Math.min(11, Math.floor(newMoonSunLon / 30));
  const lunarMonth1to12 = ((newMoonSignIdx + 2) % 12) + 1;
  const rokuyoIdx = (lunarMonth1to12 + lunarDay1to30 - 2) % 6;

  const lotOfVictoryDeg = mod360(
    sunLon + planets.jupiter.longitudeDeg - planets.saturn.longitudeDeg,
  );

  const bundle: DateAstroBundle = {
    jd,
    jdn,
    T,
    precessDeg,
    sunLon,
    moonLon,
    planets,
    manzilIndex,
    sunDecanIndex,
    sunDecanRuler,
    lunarMonth1to12,
    lunarDay1to30,
    rokuyoIdx,
    rokuyoName: ROKUYO_NAMES[rokuyoIdx],
    lotOfVictoryDeg,
  };
  return setBoundedCache(dateAstroCache, dateStr, bundle);
}

function hitsStarGroup(
  lonDeg: number,
  starGroup: readonly FixedStarEntry[],
  precessDeg: number,
  orbDeg: number,
): boolean {
  for (const s of starGroup) {
    const starLon = mod360(s.lonJ2000 + precessDeg);
    if (shortestAngularDistance(lonDeg, starLon) <= orbDeg) {
      return true;
    }
  }
  return false;
}

export interface ArabicManazilSectObservables {
  readonly manzilIndex: number | null;
  readonly isVictoryManzil: boolean;
  readonly isDiscordManzil: boolean;
  readonly isDiurnalSlate: boolean;
  readonly isNocturnalSlate: boolean;
  readonly isNatalRulerInSect: boolean;
  readonly isLotOfVictoryActivated: boolean;
}

export function extractArabicManazilSectObservables(params: {
  birthDate?: string | null;
  gameDate?: string | null;
  hostStadium?: HostStadiumCoords | null;
  kickoffUtc?: string | null;
}): ArabicManazilSectObservables {
  const game = getDateAstroBundle(params.gameDate);
  const natal = getDateAstroBundle(params.birthDate);
  const natalZodiac = getTropicalZodiac(params.birthDate);
  const natalRuler = natalZodiac ? PTOLEMAIC_SIGN_RULERS[natalZodiac.sign] : null;
  const resolvedHost = params.hostStadium ?? null;

  if (!game) {
    return {
      manzilIndex: null,
      isVictoryManzil: false,
      isDiscordManzil: false,
      isDiurnalSlate: true,
      isNocturnalSlate: false,
      isNatalRulerInSect: false,
      isLotOfVictoryActivated: false,
    };
  }

  let isDiurnalSlate = true;
  if (resolvedHost) {
    const kickMs = resolveCanonicalKickoffUtcMs(
      params.gameDate,
      resolvedHost.lon,
      params.kickoffUtc,
    );
    if (kickMs !== null) {
      const pHour = computeChaldeanPlanetaryHour(
        kickMs,
        resolvedHost.lat,
        resolvedHost.lon,
        game.sunLon,
      );
      isDiurnalSlate = pHour.isDiurnalHour;
    }
  }

  let isNatalRulerInSect = false;
  if (natalRuler) {
    if (isDiurnalSlate && DIURNAL_SECT_PLANETS.has(natalRuler)) {
      isNatalRulerInSect = true;
    } else if (!isDiurnalSlate && NOCTURNAL_SECT_PLANETS.has(natalRuler)) {
      isNatalRulerInSect = true;
    }
  }

  const isLotOfVictoryActivated = Boolean(
    natal &&
      (shortestAngularDistance(game.sunLon, natal.lotOfVictoryDeg) <= 10.0 ||
        shortestAngularDistance(game.planets.jupiter.longitudeDeg, natal.lotOfVictoryDeg) <= 10.0),
  );

  return {
    manzilIndex: game.manzilIndex,
    isVictoryManzil: PICATRIX_VICTORY_MANAZIL.has(game.manzilIndex),
    isDiscordManzil: PICATRIX_DISCORD_MANAZIL.has(game.manzilIndex),
    isDiurnalSlate,
    isNocturnalSlate: !isDiurnalSlate,
    isNatalRulerInSect,
    isLotOfVictoryActivated,
  };
}

export interface FixedStarObservables {
  readonly hasNatalRoyalStar: boolean;
  readonly hasNatalGloryStar: boolean;
  readonly hasNatalAlgolHazard: boolean;
  readonly isGameMoonGloryStar: boolean;
  readonly isGameMoonAlgolHazard: boolean;
}

export function extractFixedStarObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): FixedStarObservables {
  const game = getDateAstroBundle(gameDateStr);
  const natal = getDateAstroBundle(birthDateStr);

  if (!game) {
    return {
      hasNatalRoyalStar: false,
      hasNatalGloryStar: false,
      hasNatalAlgolHazard: false,
      isGameMoonGloryStar: false,
      isGameMoonAlgolHazard: false,
    };
  }

  const isGameMoonGloryStar =
    hitsStarGroup(game.moonLon, FIXED_STARS_J2000.glory, game.precessDeg, 2.5) ||
    hitsStarGroup(game.moonLon, FIXED_STARS_J2000.royal, game.precessDeg, 2.0);
  const isGameMoonAlgolHazard = hitsStarGroup(
    game.moonLon,
    FIXED_STARS_J2000.hazard,
    game.precessDeg,
    2.5,
  );

  if (!natal) {
    return {
      hasNatalRoyalStar: false,
      hasNatalGloryStar: false,
      hasNatalAlgolHazard: false,
      isGameMoonGloryStar,
      isGameMoonAlgolHazard,
    };
  }

  const nSun = natal.sunLon;
  const nMars = natal.planets.mars.longitudeDeg;
  const nJup = natal.planets.jupiter.longitudeDeg;

  const hasNatalRoyalStar =
    hitsStarGroup(nSun, FIXED_STARS_J2000.royal, natal.precessDeg, 2.0) ||
    hitsStarGroup(nMars, FIXED_STARS_J2000.royal, natal.precessDeg, 2.0);

  const hasNatalGloryStar =
    hitsStarGroup(nSun, FIXED_STARS_J2000.glory, natal.precessDeg, 2.0) ||
    hitsStarGroup(nMars, FIXED_STARS_J2000.glory, natal.precessDeg, 2.0) ||
    hitsStarGroup(nJup, FIXED_STARS_J2000.glory, natal.precessDeg, 2.0);

  const hasNatalAlgolHazard =
    hitsStarGroup(nSun, FIXED_STARS_J2000.hazard, natal.precessDeg, 2.0) ||
    hitsStarGroup(nMars, FIXED_STARS_J2000.hazard, natal.precessDeg, 2.0);

  return {
    hasNatalRoyalStar,
    hasNatalGloryStar,
    hasNatalAlgolHazard,
    isGameMoonGloryStar,
    isGameMoonAlgolHazard,
  };
}

export interface DecanModalityObservables {
  readonly natalModality: 'Cardinal' | 'Fixed' | 'Mutable' | null;
  readonly isQbSameModality: boolean;
  readonly natalSunDecanRuler: string | null;
  readonly isMartialDecanNatal: boolean;
  readonly isJovialDecanNatal: boolean;
  readonly isExactDecanTrineGame: boolean;
}

export function extractDecanModalityObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
  qbBirthDateStr?: string | null,
): DecanModalityObservables {
  const natalZodiac = getTropicalZodiac(birthDateStr);
  const qbZodiac = qbBirthDateStr ? getTropicalZodiac(qbBirthDateStr) : null;
  const natal = getDateAstroBundle(birthDateStr);
  const game = getDateAstroBundle(gameDateStr);

  if (!natal || !natalZodiac) {
    return {
      natalModality: null,
      isQbSameModality: false,
      natalSunDecanRuler: null,
      isMartialDecanNatal: false,
      isJovialDecanNatal: false,
      isExactDecanTrineGame: false,
    };
  }

  const decanDiff = game ? Math.abs(game.sunDecanIndex - natal.sunDecanIndex) : -1;
  const isExactDecanTrineGame = decanDiff === 12 || decanDiff === 24;

  return {
    natalModality: natalZodiac.modality,
    isQbSameModality: Boolean(qbZodiac && qbZodiac.modality === natalZodiac.modality),
    natalSunDecanRuler: natal.sunDecanRuler,
    isMartialDecanNatal: natal.sunDecanRuler === 'Mars',
    isJovialDecanNatal: natal.sunDecanRuler === 'Jupiter',
    isExactDecanTrineGame,
  };
}

export function computeKongWangVoidBranches(
  pillar: SexagenaryPillar | null,
): [number, number] | null {
  if (!pillar) return null;
  const v1 = (((pillar.branch.index - pillar.stem.index + 10) % 12) + 12) % 12;
  const v2 = (v1 + 1) % 12;
  return [v1, v2];
}

export interface RokuyoTenchusatsuObservables {
  readonly rokuyoName: string | null;
  readonly isTaianLuckyDay: boolean;
  readonly isButsumetsuTabooDay: boolean;
  readonly isSenbuAfternoonWinDay: boolean;
  readonly isSenshoAfternoonLossDay: boolean;
  readonly isPlayerTenchusatsuGameDay: boolean;
  readonly isNatalInDailyKongWangVoid: boolean;
  readonly isPlayerTenchusatsuYear: boolean;
}

export function extractRokuyoTenchusatsuObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): RokuyoTenchusatsuObservables {
  const game = getDateAstroBundle(gameDateStr);
  const gameDayPillar = computeSexagenaryDayPillar(gameDateStr);
  const gameYearPillar = computeSexagenaryYearPillar(gameDateStr);
  const natalDayPillar = computeSexagenaryDayPillar(birthDateStr);

  if (!game || !gameDayPillar) {
    return {
      rokuyoName: null,
      isTaianLuckyDay: false,
      isButsumetsuTabooDay: false,
      isSenbuAfternoonWinDay: false,
      isSenshoAfternoonLossDay: false,
      isPlayerTenchusatsuGameDay: false,
      isNatalInDailyKongWangVoid: false,
      isPlayerTenchusatsuYear: false,
    };
  }

  const playerVoid = computeKongWangVoidBranches(natalDayPillar);
  const dailyVoid = computeKongWangVoidBranches(gameDayPillar);

  const isPlayerTenchusatsuGameDay = Boolean(
    playerVoid &&
      (gameDayPillar.branch.index === playerVoid[0] ||
        gameDayPillar.branch.index === playerVoid[1]),
  );

  const isNatalInDailyKongWangVoid = Boolean(
    natalDayPillar &&
      dailyVoid &&
      (natalDayPillar.branch.index === dailyVoid[0] ||
        natalDayPillar.branch.index === dailyVoid[1]),
  );

  const isPlayerTenchusatsuYear = Boolean(
    playerVoid &&
      gameYearPillar &&
      (gameYearPillar.branch.index === playerVoid[0] ||
        gameYearPillar.branch.index === playerVoid[1]),
  );

  return {
    rokuyoName: game.rokuyoName,
    isTaianLuckyDay: game.rokuyoName === 'Taian',
    isButsumetsuTabooDay: game.rokuyoName === 'Butsumetsu',
    isSenbuAfternoonWinDay: game.rokuyoName === 'Senbu',
    isSenshoAfternoonLossDay: game.rokuyoName === 'Sensho',
    isPlayerTenchusatsuGameDay,
    isNatalInDailyKongWangVoid,
    isPlayerTenchusatsuYear,
  };
}

function isSoftPtolemaicAspect(lonA: number, lonB: number, orbDeg = 8.0): boolean {
  const d = shortestAngularDistance(lonA, lonB);
  return d <= orbDeg || Math.abs(d - 60) <= orbDeg || Math.abs(d - 120) <= orbDeg;
}

function isDynamicPtolemaicAspect(lonA: number, lonB: number, orbDeg = 8.0): boolean {
  const d = shortestAngularDistance(lonA, lonB);
  return d <= orbDeg || Math.abs(d - 90) <= orbDeg || Math.abs(d - 180) <= orbDeg;
}

export interface PlanetarySynastryObservables {
  readonly hasQbPlanetSynastry: boolean;
  readonly isNatalMarsJupiterHarmonic: boolean;
  readonly isNatalSunMarsDynamic: boolean;
  readonly isQbRecBeneficSynastry: boolean;
  readonly isQbRecSaturnFriction: boolean;
  readonly isAdversarialMarsVsOppQb: boolean;
  readonly isTransitMarsIgnition: boolean;
}

export function extractPlanetarySynastryObservables(params: {
  birthDate?: string | null;
  gameDate?: string | null;
  myQbBirthDate?: string | null;
  oppQbBirthDate?: string | null;
}): PlanetarySynastryObservables {
  const natal = params.birthDate ? getDateAstroBundle(params.birthDate) : null;
  const game = params.gameDate ? getDateAstroBundle(params.gameDate) : null;
  const myQb =
    params.myQbBirthDate && params.myQbBirthDate !== params.birthDate
      ? getDateAstroBundle(params.myQbBirthDate)
      : null;
  const oppQb = params.oppQbBirthDate ? getDateAstroBundle(params.oppQbBirthDate) : null;

  if (!natal) {
    return {
      hasQbPlanetSynastry: false,
      isNatalMarsJupiterHarmonic: false,
      isNatalSunMarsDynamic: false,
      isQbRecBeneficSynastry: false,
      isQbRecSaturnFriction: false,
      isAdversarialMarsVsOppQb: false,
      isTransitMarsIgnition: false,
    };
  }

  const nSun = natal.sunLon;
  const nMerc = natal.planets.mercury.longitudeDeg;
  const nVen = natal.planets.venus.longitudeDeg;
  const nMars = natal.planets.mars.longitudeDeg;
  const nJup = natal.planets.jupiter.longitudeDeg;

  const isNatalMarsJupiterHarmonic = isSoftPtolemaicAspect(nMars, nJup, 8.0);
  const isNatalSunMarsDynamic =
    isDynamicPtolemaicAspect(nSun, nMars, 8.0) ||
    Math.abs(shortestAngularDistance(nSun, nMars) - 120) <= 8.0;

  let isQbRecBeneficSynastry = false;
  let isQbRecSaturnFriction = false;
  if (myQb) {
    const qbSun = myQb.sunLon;
    const qbJup = myQb.planets.jupiter.longitudeDeg;
    const qbSat = myQb.planets.saturn.longitudeDeg;

    isQbRecBeneficSynastry =
      isSoftPtolemaicAspect(qbJup, nVen, 8.0) ||
      isSoftPtolemaicAspect(qbJup, nMars, 8.0) ||
      isSoftPtolemaicAspect(qbSun, nVen, 8.0);

    isQbRecSaturnFriction =
      isDynamicPtolemaicAspect(qbSat, nSun, 7.0) ||
      isDynamicPtolemaicAspect(qbSat, nMerc, 7.0) ||
      isDynamicPtolemaicAspect(qbSat, nMars, 7.0);
  }

  const isAdversarialMarsVsOppQb = Boolean(
    oppQb &&
      (isDynamicPtolemaicAspect(nMars, oppQb.sunLon, 8.0) ||
        isDynamicPtolemaicAspect(nMars, oppQb.planets.mars.longitudeDeg, 8.0)),
  );

  const isTransitMarsIgnition = Boolean(
    game &&
      (isDynamicPtolemaicAspect(game.planets.mars.longitudeDeg, nMars, 6.0) ||
        isDynamicPtolemaicAspect(game.planets.mars.longitudeDeg, nSun, 6.0)),
  );

  return {
    hasQbPlanetSynastry: Boolean(myQb),
    isNatalMarsJupiterHarmonic,
    isNatalSunMarsDynamic,
    isQbRecBeneficSynastry,
    isQbRecSaturnFriction,
    isAdversarialMarsVsOppQb,
    isTransitMarsIgnition,
  };
}

// ============================================================================
// 5. Witchcraft Sabbats/Esbats, Norse Runes / Celtic Ogham & Hermetic Kabbalah
// ============================================================================

export interface ElderFutharkRune {
  readonly index: number;
  readonly name: string;
  readonly aett: 'Freyr' | 'Hagal' | 'Tyr';
  readonly meaning: string;
}

export const ELDER_FUTHARK_RUNES: readonly ElderFutharkRune[] = [
  { index: 0, name: 'Fehu', aett: 'Freyr', meaning: 'Wealth' },
  { index: 1, name: 'Uruz', aett: 'Freyr', meaning: 'Aurochs Strength' },
  { index: 2, name: 'Thurisaz', aett: 'Freyr', meaning: 'Giant Thorn' },
  { index: 3, name: 'Ansuz', aett: 'Freyr', meaning: 'Odin Breath' },
  { index: 4, name: 'Raidho', aett: 'Freyr', meaning: 'Chariot Ride' },
  { index: 5, name: 'Kenaz', aett: 'Freyr', meaning: 'Torch Craft' },
  { index: 6, name: 'Gebo', aett: 'Freyr', meaning: 'Gift Exchange' },
  { index: 7, name: 'Wunjo', aett: 'Freyr', meaning: 'Glory Joy' },
  { index: 8, name: 'Hagalaz', aett: 'Hagal', meaning: 'Hail Disruption' },
  { index: 9, name: 'Nauthiz', aett: 'Hagal', meaning: 'Need Friction' },
  { index: 10, name: 'Isa', aett: 'Hagal', meaning: 'Ice Stasis' },
  { index: 11, name: 'Jera', aett: 'Hagal', meaning: 'Harvest Cycle' },
  { index: 12, name: 'Eihwaz', aett: 'Hagal', meaning: 'Yew World-Tree' },
  { index: 13, name: 'Perthro', aett: 'Hagal', meaning: 'Dice Lot Wyrd' },
  { index: 14, name: 'Algiz', aett: 'Hagal', meaning: 'Elk Shield' },
  { index: 15, name: 'Sowilo', aett: 'Hagal', meaning: 'Solar Victory' },
  { index: 16, name: 'Tiwaz', aett: 'Tyr', meaning: 'Spear of Tyr' },
  { index: 17, name: 'Berkano', aett: 'Tyr', meaning: 'Birch Renewal' },
  { index: 18, name: 'Ehwaz', aett: 'Tyr', meaning: 'Twin Steed' },
  { index: 19, name: 'Mannaz', aett: 'Tyr', meaning: 'Kinship Mind' },
  { index: 20, name: 'Laguz', aett: 'Tyr', meaning: 'Tidal Current' },
  { index: 21, name: 'Ingwaz', aett: 'Tyr', meaning: 'Seed Potential' },
  { index: 22, name: 'Dagaz', aett: 'Tyr', meaning: 'Daybreak Shift' },
  { index: 23, name: 'Othala', aett: 'Tyr', meaning: 'Ancestral Hall' },
];

const VICTORY_RUNE_INDICES = new Set<number>([1, 7, 15, 16, 22]);
const DISRUPTION_RUNE_INDICES = new Set<number>([2, 8, 9, 10]);

export interface CelticOghamTree {
  readonly index: number;
  readonly ogham: string;
  readonly tree: string;
  readonly chieftain: boolean;
}

export const CELTIC_OGHAM_TREES: readonly CelticOghamTree[] = [
  { index: 0, ogham: 'Beth', tree: 'Birch', chieftain: true },
  { index: 1, ogham: 'Luis', tree: 'Rowan', chieftain: false },
  { index: 2, ogham: 'Nion', tree: 'Ash', chieftain: true },
  { index: 3, ogham: 'Fearn', tree: 'Alder', chieftain: true },
  { index: 4, ogham: 'Saille', tree: 'Willow', chieftain: false },
  { index: 5, ogham: 'Uath', tree: 'Hawthorn', chieftain: false },
  { index: 6, ogham: 'Duir', tree: 'Oak', chieftain: true },
  { index: 7, ogham: 'Tinne', tree: 'Holly', chieftain: true },
  { index: 8, ogham: 'Coll', tree: 'Hazel', chieftain: true },
  { index: 9, ogham: 'Muin', tree: 'Vine', chieftain: false },
  { index: 10, ogham: 'Gort', tree: 'Ivy', chieftain: false },
  { index: 11, ogham: 'Ngetal', tree: 'Reed', chieftain: false },
  { index: 12, ogham: 'Ruis', tree: 'Elder', chieftain: false },
];

const WARRIOR_OGHAM_SET = new Set<number>([1, 6, 7, 8]);

const AGRIPPA_GEMATRIA_MAP: Readonly<Record<string, number>> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  K: 10, L: 20, M: 30, N: 40, O: 50, P: 60, Q: 70, R: 80, S: 90,
  T: 100, U: 200, V: 200, X: 300, Y: 400, Z: 500, J: 600, W: 700,
};

export type KabbalahPillar = 'MERCY' | 'SEVERITY' | 'EQUILIBRIUM';

export interface KabbalahSephirah {
  readonly number: number;
  readonly name: string;
  readonly pillar: KabbalahPillar;
}

export const KABBALAH_SEPHIROTH: readonly KabbalahSephirah[] = [
  { number: 1, name: 'Kether', pillar: 'EQUILIBRIUM' },
  { number: 2, name: 'Chokmah', pillar: 'MERCY' },
  { number: 3, name: 'Binah', pillar: 'SEVERITY' },
  { number: 4, name: 'Chesed', pillar: 'MERCY' },
  { number: 5, name: 'Gevurah', pillar: 'SEVERITY' },
  { number: 6, name: 'Tiferet', pillar: 'EQUILIBRIUM' },
  { number: 7, name: 'Netzach', pillar: 'MERCY' },
  { number: 8, name: 'Hod', pillar: 'SEVERITY' },
  { number: 9, name: 'Yesod', pillar: 'EQUILIBRIUM' },
  { number: 10, name: 'Malkuth', pillar: 'EQUILIBRIUM' },
];

interface DateOccultBundle {
  readonly jdn: number;
  readonly dayOfMonth: number;
  readonly sunLon: number;
  readonly moonLon: number;
  readonly synodicDeg: number;
  readonly lunarDay1to30: number;
  readonly runeIndex: number;
  readonly rune: ElderFutharkRune;
  readonly oghamIndex: number;
  readonly ogham: CelticOghamTree;
  readonly shemQuinaryIndex: number;
  readonly isBloodEclipseEsbat: boolean;
}

const dateOccultCache = new Map<string, DateOccultBundle>();

function getDayOfYear1to366(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const cur = Date.UTC(year, month - 1, day);
  return Math.round((cur - start) / 86400000) + 1;
}

function getOghamTreeIndex(year: number, month: number, day: number): number {
  const doy = getDayOfYear1to366(year, month, day);
  const shifted = (doy - 358 + 365) % 365;
  return Math.min(12, Math.floor(shifted / 28));
}

function getDateOccultBundle(dateStr?: string | null): DateOccultBundle | null {
  if (typeof dateStr !== 'string') return null;
  const cached = dateOccultCache.get(dateStr);
  if (cached) return cached;
  const cal = parseStrictUtcDate(dateStr);
  const ms = dateStrNoonUtcMs(dateStr);
  const jdn = dateToJulianDayNumber(dateStr);
  if (!cal || ms === null || jdn === null) return null;

  const { jd, T } = utcMsToJulianDate(ms);
  const sunLon = computeTrueSolarLongitudeAtT(T);
  const moonLon = computeTrueLunarLongitudeAtT(T);
  const rahuLon = computeMeanLunarNorthNodeAtT(T);
  const ketuLon = mod360(rahuLon + 180.0);

  const synodicDeg = mod360(moonLon - sunLon);
  const elapsedFromRef = jd - REF_NEW_MOON_JD;
  const lunationAgeDays =
    ((elapsedFromRef % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const lunarDay1to30 = Math.min(30, Math.floor(lunationAgeDays) + 1);

  const runeIndex = Math.min(23, Math.floor(sunLon / 15));
  const oghamIndex = getOghamTreeIndex(cal.year, cal.month, cal.day);
  const shemQuinaryIndex = Math.min(71, Math.floor(sunLon / 5));

  const nodeDist = Math.min(
    shortestAngularDistance(sunLon, rahuLon),
    shortestAngularDistance(sunLon, ketuLon),
  );
  const isSyzygy =
    synodicDeg <= 15.0 || synodicDeg >= 345.0 || Math.abs(synodicDeg - 180.0) <= 15.0;

  const bundle: DateOccultBundle = {
    jdn,
    dayOfMonth: cal.day,
    sunLon,
    moonLon,
    synodicDeg,
    lunarDay1to30,
    runeIndex,
    rune: ELDER_FUTHARK_RUNES[runeIndex],
    oghamIndex,
    ogham: CELTIC_OGHAM_TREES[oghamIndex],
    shemQuinaryIndex,
    isBloodEclipseEsbat: isSyzygy && nodeDist <= 18.0,
  };
  return setBoundedCache(dateOccultCache, dateStr, bundle);
}

export interface WitchcraftObservables {
  readonly isSamhainVeilWindow: boolean;
  readonly isMabonOrYuleTide: boolean;
  readonly isHekateDarkMoon: boolean;
  readonly isDianaWaxingCrescent: boolean;
  readonly isBloodEclipseEsbat: boolean;
  readonly isCoven13thDay: boolean;
}

export function extractWitchcraftObservables(gameDateStr?: string | null): WitchcraftObservables {
  const game = getDateOccultBundle(gameDateStr);
  if (!game) {
    return {
      isSamhainVeilWindow: false,
      isMabonOrYuleTide: false,
      isHekateDarkMoon: false,
      isDianaWaxingCrescent: false,
      isBloodEclipseEsbat: false,
      isCoven13thDay: false,
    };
  }

  const isSamhainVeilWindow = shortestAngularDistance(game.sunLon, 225.0) <= 6.0;
  const isMabonOrYuleTide =
    shortestAngularDistance(game.sunLon, 180.0) <= 5.0 ||
    shortestAngularDistance(game.sunLon, 270.0) <= 5.0;
  const isHekateDarkMoon = game.synodicDeg >= 324.0 && game.synodicDeg < 360.0;
  const isDianaWaxingCrescent = game.synodicDeg >= 15.0 && game.synodicDeg <= 60.0;
  const isCoven13thDay = game.dayOfMonth === 13 || game.lunarDay1to30 === 13;

  return {
    isSamhainVeilWindow,
    isMabonOrYuleTide,
    isHekateDarkMoon,
    isDianaWaxingCrescent,
    isBloodEclipseEsbat: game.isBloodEclipseEsbat,
    isCoven13thDay,
  };
}

export interface RunesOghamObservables {
  readonly natalRuneName: string | null;
  readonly natalAett: 'Freyr' | 'Hagal' | 'Tyr' | null;
  readonly wyrdCastRuneName: string | null;
  readonly isWyrdVictoryRune: boolean;
  readonly isWyrdDisruptionRune: boolean;
  readonly natalOghamName: string | null;
  readonly natalOghamTree: string | null;
  readonly isNatalWarriorOgham: boolean;
  readonly isOghamWheelResonance: boolean;
}

export function extractRunesOghamObservables(
  birthDateStr?: string | null,
  gameDateStr?: string | null,
): RunesOghamObservables {
  const natal = getDateOccultBundle(birthDateStr);
  const game = getDateOccultBundle(gameDateStr);

  if (!natal || !game) {
    return {
      natalRuneName: natal?.rune.name ?? null,
      natalAett: natal?.rune.aett ?? null,
      wyrdCastRuneName: null,
      isWyrdVictoryRune: false,
      isWyrdDisruptionRune: false,
      natalOghamName: natal?.ogham.ogham ?? null,
      natalOghamTree: natal?.ogham.tree ?? null,
      isNatalWarriorOgham: natal ? WARRIOR_OGHAM_SET.has(natal.oghamIndex) : false,
      isOghamWheelResonance: false,
    };
  }

  const wyrdIdx = (natal.runeIndex + game.jdn) % 24;
  const oghamDiff = Math.abs(natal.oghamIndex - game.oghamIndex);
  const isOghamWheelResonance = oghamDiff === 0 || oghamDiff === 4 || oghamDiff === 9;

  return {
    natalRuneName: natal.rune.name,
    natalAett: natal.rune.aett,
    wyrdCastRuneName: ELDER_FUTHARK_RUNES[wyrdIdx].name,
    isWyrdVictoryRune: VICTORY_RUNE_INDICES.has(wyrdIdx),
    isWyrdDisruptionRune: DISRUPTION_RUNE_INDICES.has(wyrdIdx),
    natalOghamName: natal.ogham.ogham,
    natalOghamTree: natal.ogham.tree,
    isNatalWarriorOgham: WARRIOR_OGHAM_SET.has(natal.oghamIndex),
    isOghamWheelResonance,
  };
}

export function computeAgrippaGematria(nameStr?: string | null): number | null {
  if (!nameStr || typeof nameStr !== 'string') return null;
  const clean = nameStr.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return null;
  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    total += AGRIPPA_GEMATRIA_MAP[clean[i]] ?? 0;
  }
  return total;
}

function resolveSephirah(seedInt: number): KabbalahSephirah {
  const idx = (((Math.trunc(seedInt) - 1) % 10) + 10) % 10;
  return KABBALAH_SEPHIROTH[idx];
}

export interface KabbalahGematriaObservables {
  readonly gematriaValue: number | null;
  readonly natalSephirah: string | null;
  readonly natalPillar: KabbalahPillar | null;
  readonly transitSephirah: string | null;
  readonly isNetzachOrTiferetTransit: boolean;
  readonly isGevurahOrBinahTransit: boolean;
  readonly isShem72QuinaryResonance: boolean;
  readonly isQbSameKabbalahPillar: boolean;
}

export function extractKabbalahGematriaObservables(params: {
  playerName?: string | null;
  birthDate?: string | null;
  gameDate?: string | null;
  qbName?: string | null;
  qbBirthDate?: string | null;
}): KabbalahGematriaObservables {
  const natal = getDateOccultBundle(params.birthDate);
  const game = getDateOccultBundle(params.gameDate);
  const nameGem = computeAgrippaGematria(params.playerName);

  if (!natal || !game) {
    return {
      gematriaValue: nameGem,
      natalSephirah: natal ? resolveSephirah((nameGem ?? 0) + natal.jdn).name : null,
      natalPillar: natal ? resolveSephirah((nameGem ?? 0) + natal.jdn).pillar : null,
      transitSephirah: null,
      isNetzachOrTiferetTransit: false,
      isGevurahOrBinahTransit: false,
      isShem72QuinaryResonance: false,
      isQbSameKabbalahPillar: false,
    };
  }

  const baseSeed = (nameGem ?? 0) + natal.jdn;
  const natalSeph = resolveSephirah(baseSeed);
  const transitSeph = resolveSephirah(baseSeed + game.jdn);

  const qDiff = Math.abs(game.shemQuinaryIndex - natal.shemQuinaryIndex);
  const circQDiff = Math.min(qDiff, 72 - qDiff);
  const isShem72QuinaryResonance = circQDiff === 0 || circQDiff === 12 || circQDiff === 24;

  let isQbSameKabbalahPillar = false;
  if (params.qbBirthDate && params.qbBirthDate !== params.birthDate) {
    const qbNatal = getDateOccultBundle(params.qbBirthDate);
    const qbGem = computeAgrippaGematria(params.qbName);
    if (qbNatal) {
      const qbSeph = resolveSephirah((qbGem ?? 0) + qbNatal.jdn);
      isQbSameKabbalahPillar = qbSeph.pillar === natalSeph.pillar;
    }
  }

  return {
    gematriaValue: nameGem,
    natalSephirah: natalSeph.name,
    natalPillar: natalSeph.pillar,
    transitSephirah: transitSeph.name,
    isNetzachOrTiferetTransit: transitSeph.number === 7 || transitSeph.number === 6,
    isGevurahOrBinahTransit: transitSeph.number === 5 || transitSeph.number === 3,
    isShem72QuinaryResonance,
    isQbSameKabbalahPillar,
  };
}

// ============================================================================
// 6. Medieval Latin Divinatory Geomancy (Ars Geomantiae - 16 Shield Figures)
// ============================================================================

export interface GeomanticFigure {
  readonly bits: number;
  readonly name: string;
  readonly ruler: string;
  readonly dignity: 'BENEFIC' | 'MALEFIC' | 'MARTIAL' | 'NEUTRAL';
}

export const GEOMANTIC_FIGURES: readonly GeomanticFigure[] = [
  { bits: 0, name: 'Populus', ruler: 'Moon', dignity: 'NEUTRAL' },
  { bits: 1, name: 'Tristitia', ruler: 'Saturn', dignity: 'MALEFIC' },
  { bits: 2, name: 'Albus', ruler: 'Mercury', dignity: 'BENEFIC' },
  { bits: 3, name: 'Fortuna Major', ruler: 'Sun', dignity: 'BENEFIC' },
  { bits: 4, name: 'Rubeus', ruler: 'Mars', dignity: 'MALEFIC' },
  { bits: 5, name: 'Acquisitio', ruler: 'Jupiter', dignity: 'BENEFIC' },
  { bits: 6, name: 'Conjunctio', ruler: 'Mercury', dignity: 'NEUTRAL' },
  { bits: 7, name: 'Caput Draconis', ruler: 'NorthNode', dignity: 'BENEFIC' },
  { bits: 8, name: 'Laetitia', ruler: 'Jupiter', dignity: 'BENEFIC' },
  { bits: 9, name: 'Carcer', ruler: 'Saturn', dignity: 'MALEFIC' },
  { bits: 10, name: 'Amissio', ruler: 'Venus', dignity: 'MALEFIC' },
  { bits: 11, name: 'Puella', ruler: 'Venus', dignity: 'BENEFIC' },
  { bits: 12, name: 'Fortuna Minor', ruler: 'Sun', dignity: 'BENEFIC' },
  { bits: 13, name: 'Puer', ruler: 'Mars', dignity: 'MARTIAL' },
  { bits: 14, name: 'Cauda Draconis', ruler: 'SouthNode', dignity: 'MALEFIC' },
  { bits: 15, name: 'Via', ruler: 'Moon', dignity: 'NEUTRAL' },
];

const BENEFIC_JUDGE_SET = new Set<number>([3, 5, 12]);
const MALEFIC_JUDGE_SET = new Set<number>([9, 10]);
const BENEFIC_WITNESS_SET = new Set<number>([2, 3, 5, 7, 8, 11, 12]);
const RUBEUS_CAUDA_SET = new Set<number>([4, 14]);

interface CelestialGeomancySeed {
  readonly jdn: number;
  readonly sunDeg: number;
  readonly moonDeg: number;
  readonly mercDeg: number;
  readonly venDeg: number;
  readonly marsDeg: number;
  readonly jupDeg: number;
  readonly satDeg: number;
}

const celestialSeedCache = new Map<string, CelestialGeomancySeed>();

function getCelestialGeomancyState(dateStr?: string | null): CelestialGeomancySeed | null {
  if (typeof dateStr !== 'string') return null;
  const cached = celestialSeedCache.get(dateStr);
  if (cached) return cached;
  const ms = dateStrNoonUtcMs(dateStr);
  const jdn = dateToJulianDayNumber(dateStr);
  if (ms === null || jdn === null) return null;
  const { jd, T } = utcMsToJulianDate(ms);
  const sunDeg = Math.floor(computeTrueSolarLongitudeAtT(T));
  const moonDeg = Math.floor(computeTrueLunarLongitudeAtT(T));
  const planets = computeGeocentricPlanetsAtJd(jd);
  const state: CelestialGeomancySeed = {
    jdn,
    sunDeg,
    moonDeg,
    mercDeg: Math.floor(planets.mercury.longitudeDeg),
    venDeg: Math.floor(planets.venus.longitudeDeg),
    marsDeg: Math.floor(planets.mars.longitudeDeg),
    jupDeg: Math.floor(planets.jupiter.longitudeDeg),
    satDeg: Math.floor(planets.saturn.longitudeDeg),
  };
  return setBoundedCache(celestialSeedCache, dateStr, state);
}

function sumAlphaCodes(str?: string | null): number {
  if (!str || typeof str !== 'string') return 0;
  const clean = str.toUpperCase().replace(/[^A-Z]/g, '');
  let s = 0;
  for (let i = 0; i < clean.length; i++) {
    s += clean.charCodeAt(i) - 64;
  }
  return s;
}

function pack4Bits(fireVal: number, airVal: number, waterVal: number, earthVal: number): number {
  const f = Math.abs(Math.trunc(fireVal)) & 1;
  const a = Math.abs(Math.trunc(airVal)) & 1;
  const w = Math.abs(Math.trunc(waterVal)) & 1;
  const e = Math.abs(Math.trunc(earthVal)) & 1;
  return (f << 3) | (a << 2) | (w << 1) | e;
}

export interface GeomanticShieldChart {
  readonly mothers: [number, number, number, number];
  readonly daughters: [number, number, number, number];
  readonly nephews: [number, number, number, number];
  readonly rightWitness: number;
  readonly leftWitness: number;
  readonly judge: number;
  readonly reconciler: number;
  readonly judgeFigure: GeomanticFigure;
  readonly rightWitnessFigure: GeomanticFigure;
  readonly leftWitnessFigure: GeomanticFigure;
  readonly firstMotherFigure: GeomanticFigure;
  readonly hasViaPuncti: boolean;
}

export function castGeomanticShieldFromMothers(
  m1: number,
  m2: number,
  m3: number,
  m4: number,
): GeomanticShieldChart {
  const mothers: [number, number, number, number] = [m1 & 15, m2 & 15, m3 & 15, m4 & 15];
  const d1 =
    (((mothers[0] >> 3) & 1) << 3) |
    (((mothers[1] >> 3) & 1) << 2) |
    (((mothers[2] >> 3) & 1) << 1) |
    ((mothers[3] >> 3) & 1);
  const d2 =
    (((mothers[0] >> 2) & 1) << 3) |
    (((mothers[1] >> 2) & 1) << 2) |
    (((mothers[2] >> 2) & 1) << 1) |
    ((mothers[3] >> 2) & 1);
  const d3 =
    (((mothers[0] >> 1) & 1) << 3) |
    (((mothers[1] >> 1) & 1) << 2) |
    (((mothers[2] >> 1) & 1) << 1) |
    ((mothers[3] >> 1) & 1);
  const d4 =
    ((mothers[0] & 1) << 3) |
    ((mothers[1] & 1) << 2) |
    ((mothers[2] & 1) << 1) |
    (mothers[3] & 1);

  const n1 = mothers[0] ^ mothers[1];
  const n2 = mothers[2] ^ mothers[3];
  const n3 = d1 ^ d2;
  const n4 = d3 ^ d4;

  const rightWitness = n1 ^ n2;
  const leftWitness = n3 ^ n4;
  const judge = rightWitness ^ leftWitness;
  const reconciler = judge ^ mothers[0];

  const hasViaPuncti =
    ((judge >> 3) & 1) === 1 &&
    ((rightWitness >> 3) & 1) === 1 &&
    ((n1 >> 3) & 1) === 1 &&
    (((mothers[0] >> 3) & 1) === 1 || ((mothers[1] >> 3) & 1) === 1);

  return {
    mothers,
    daughters: [d1, d2, d3, d4],
    nephews: [n1, n2, n3, n4],
    rightWitness,
    leftWitness,
    judge,
    reconciler,
    judgeFigure: GEOMANTIC_FIGURES[judge],
    rightWitnessFigure: GEOMANTIC_FIGURES[rightWitness],
    leftWitnessFigure: GEOMANTIC_FIGURES[leftWitness],
    firstMotherFigure: GEOMANTIC_FIGURES[mothers[0]],
    hasViaPuncti,
  };
}

export interface MedievalGeomancyObservables {
  readonly judgeName: string | null;
  readonly rightWitnessName: string | null;
  readonly isJudgeFortunaAcquisitio: boolean;
  readonly isJudgeCarcerAmissio: boolean;
  readonly isQuerentWitnessBenefic: boolean;
  readonly isQuerentPuerMartial: boolean;
  readonly isRubeusOrCaudaHazard: boolean;
  readonly hasViaPunctiPassation: boolean;
}

export function extractMedievalGeomancyObservables(params: {
  birthDate?: string | null;
  gameDate?: string | null;
  playerName?: string | null;
  team?: string | null;
  opponent?: string | null;
}): MedievalGeomancyObservables {
  const game = getCelestialGeomancyState(params.gameDate);
  if (!game) {
    return {
      judgeName: null,
      rightWitnessName: null,
      isJudgeFortunaAcquisitio: false,
      isJudgeCarcerAmissio: false,
      isQuerentWitnessBenefic: false,
      isQuerentPuerMartial: false,
      isRubeusOrCaudaHazard: false,
      hasViaPunctiPassation: false,
    };
  }

  const natal = params.birthDate ? getCelestialGeomancyState(params.birthDate) : null;
  const pSum = sumAlphaCodes(params.playerName || params.team || 'QUERENT');
  const tSum = sumAlphaCodes(params.team || 'TEAM');
  const oSum = sumAlphaCodes(params.opponent || 'OPPONENT');

  const m1 = natal
    ? pack4Bits(natal.sunDeg, natal.moonDeg, natal.marsDeg + pSum, natal.jdn)
    : pack4Bits(pSum, tSum, game.sunDeg + tSum, game.jdn + tSum);
  const m2 = pack4Bits(game.sunDeg, game.moonDeg, game.marsDeg, game.jdn);
  const m3 = pack4Bits(oSum + game.satDeg, game.jupDeg + oSum, game.sunDeg + oSum, oSum);
  const m4 = pack4Bits(
    game.mercDeg + tSum,
    game.venDeg + oSum,
    Math.floor(game.moonDeg / 13),
    game.jdn + pSum,
  );

  const shield = castGeomanticShieldFromMothers(m1, m2, m3, m4);

  return {
    judgeName: shield.judgeFigure.name,
    rightWitnessName: shield.rightWitnessFigure.name,
    isJudgeFortunaAcquisitio: BENEFIC_JUDGE_SET.has(shield.judge),
    isJudgeCarcerAmissio: MALEFIC_JUDGE_SET.has(shield.judge),
    isQuerentWitnessBenefic: BENEFIC_WITNESS_SET.has(shield.rightWitness),
    isQuerentPuerMartial: m1 === 13 || shield.rightWitness === 13,
    isRubeusOrCaudaHazard:
      RUBEUS_CAUDA_SET.has(m1) || RUBEUS_CAUDA_SET.has(shield.rightWitness),
    hasViaPunctiPassation: shield.hasViaPuncti,
  };
}
