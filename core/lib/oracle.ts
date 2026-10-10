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

/**
 * The Oracle: the three numbers every player surface shows, and the weekly
 * decisions built from them.
 *
 * - Stats:  this week's projection in league scoring (points).
 * - Stars:  this week's celestial favorability (0-100), rated as if the
 *           player starts, so bench players aren't pre-judged by their role.
 * - Oracle: Stats (normalized to 0-100) and Stars blended by the chaos λ.
 *           Every ranking and recommendation in the app uses this number.
 */

import type {
  CompetitorTeam,
  CosmicPlayer,
  ElementType,
  NFLPosition,
  RosterSlot,
} from '@/types/oneiromancy';
import {
  classifyWeeklyFavorability,
  computeWeeklyPlayerFavorability,
  type WeeklyFavorabilityVerdict,
} from '@/lib/scoring';

/** Projection that maps to a Stats score of 100. */
const STATS_FULL_SCALE = 25;

export function statsPoints(p: Partial<CosmicPlayer> | null | undefined): number {
  if (!p) return 0;
  return Number(
    p.sleeper_projected_points ?? p.weekly_projected_points ?? p.projected_points ?? 0,
  );
}

export function statsScore(p: Partial<CosmicPlayer> | null | undefined): number {
  return Math.max(0, Math.min(100, (statsPoints(p) / STATS_FULL_SCALE) * 100));
}

export function starsScore(p: Partial<CosmicPlayer> | null | undefined): number {
  if (!p) return 0;
  const calc = computeWeeklyPlayerFavorability({
    spiritScore: p.spirit_score ?? 50,
    projectedPoints: statsPoints(p),
    injuryStatus: p.injury_status,
    isStarter: true,
    geomantic: p.divination_breakdown?.geomantic ?? 78,
  } as any);
  return Math.round(calc.score * 10) / 10;
}

export function oracleScore(
  p: Partial<CosmicPlayer> | null | undefined,
  lambda: number,
): number {
  const l = Math.max(0, Math.min(1, lambda));
  return Math.round(((1 - l) * statsScore(p) + l * starsScore(p)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// One semantic color scale for celestial tiers
// ---------------------------------------------------------------------------

export type Tone = 'apex' | 'good' | 'neutral' | 'bad';

export function favorabilityTone(score: number): Tone {
  const verdict: WeeklyFavorabilityVerdict = classifyWeeklyFavorability(score);
  if (verdict === 'HEAVILY FAVORED') return 'apex';
  if (verdict === 'ASTRALLY FAVORED') return 'good';
  if (verdict === 'NEUTRAL') return 'neutral';
  return 'bad';
}

export const TONE_LABEL: Record<Tone, string> = {
  apex: 'Heavily favored',
  good: 'Favored',
  neutral: 'Neutral',
  bad: 'Challenged',
};

/** Tailwind classes per tone: pill background/border/text. */
export const TONE_PILL: Record<Tone, string> = {
  apex: 'bg-emerald-900/60 border-emerald-400/60 text-emerald-200',
  good: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
  neutral: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
  bad: 'bg-rose-950/60 border-rose-500/40 text-rose-300',
};

/** Tailwind classes per tone: dot color for legends. */
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

function isSuperflexRoster(slots: RosterSlot[]): boolean {
  return slots.some((s) => s.eligible_positions?.includes('QB') && s.eligible_positions.length > 1);
}

/**
 * Minimum healthy depth per position: one more than the dedicated starting
 * slots (bye/injury cover); superflex leagues keep three quarterbacks.
 */
export function minimumDepth(slots: RosterSlot[]): Partial<Record<NFLPosition, number>> {
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

function countByPosition(players: CosmicPlayer[]): Partial<Record<NFLPosition, number>> {
  const c: Partial<Record<NFLPosition, number>> = {};
  for (const p of players) c[p.position] = (c[p.position] ?? 0) + 1;
  return c;
}

// ---------------------------------------------------------------------------
// Lineup check
// ---------------------------------------------------------------------------

export interface LineupSwap {
  slot: string;
  playerIn: CosmicPlayer;
  playerOut: CosmicPlayer | null;
  statsIn: number;
  statsOut: number;
  starsIn: number;
  starsOut: number;
  oracleGain: number;
  /** Which side each signal favors. */
  statsFavor: 'in' | 'out' | 'even';
  starsFavor: 'in' | 'out' | 'even';
  /** λ at which this recommendation flips, when stats and stars disagree. */
  flipLambda: number | null;
}

/**
 * Best lineup by Oracle score. Slots are filled most-restrictive first (QB, RB,
 * WR, TE, then FLEX, then SUPER_FLEX), each with the best eligible player left.
 * Returns the swaps between the current lineup and that best lineup.
 */
export function computeLineupCheck(roster: RosterSlot[], lambda: number): LineupSwap[] {
  const starters = roster.filter(isStarterSlot);
  const pool = roster.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p));
  if (starters.length === 0 || pool.length === 0) return [];

  const order = [...starters].sort(
    (a, b) => (a.eligible_positions?.length ?? 9) - (b.eligible_positions?.length ?? 9),
  );
  const used = new Set<string>();
  const best = new Map<string, CosmicPlayer | null>();
  for (const slot of order) {
    const choice = pool
      .filter((p) => !used.has(String(p.id)) && slot.eligible_positions?.includes(p.position))
      .sort((a, b) => oracleScore(b, lambda) - oracleScore(a, lambda))[0];
    if (choice) used.add(String(choice.id));
    best.set(String(slot.slot_id), choice ?? null);
  }

  const currentIds = new Set(starters.map((s) => s.player && String(s.player.id)).filter(Boolean));
  const promoted = Array.from(used).filter((id) => !currentIds.has(id));
  const demotedSlots = starters.filter((s) => s.player && !used.has(String(s.player.id)));

  const swaps: LineupSwap[] = [];
  const takenOut = new Set<string>();
  for (const id of promoted) {
    const pIn = pool.find((p) => String(p.id) === id)!;
    // Pair with the weakest demoted starter whose slot the new player can fill.
    const candidates = demotedSlots
      .filter((s) => s.player && !takenOut.has(String(s.player.id)) && s.eligible_positions?.includes(pIn.position))
      .sort((a, b) => oracleScore(a.player, lambda) - oracleScore(b.player, lambda));
    const outSlot = candidates[0] ?? demotedSlots.find((s) => s.player && !takenOut.has(String(s.player.id)));
    const pOut = outSlot?.player ?? null;
    if (pOut) takenOut.add(String(pOut.id));

    const statsIn = statsPoints(pIn);
    const statsOut = statsPoints(pOut);
    const starsIn = starsScore(pIn);
    const starsOut = starsScore(pOut);
    const dS = statsScore(pIn) - statsScore(pOut);
    const dT = starsIn - starsOut;
    const favor = (d: number): 'in' | 'out' | 'even' => (Math.abs(d) < 0.05 ? 'even' : d > 0 ? 'in' : 'out');
    const flip = dS * dT < 0 ? dS / (dS - dT) : null;
    const gain = oracleScore(pIn, lambda) - oracleScore(pOut, lambda);
    if (gain < 0.5) continue;
    swaps.push({
      slot: outSlot ? slotLabel(outSlot) : 'Lineup',
      playerIn: pIn,
      playerOut: pOut,
      statsIn,
      statsOut,
      starsIn,
      starsOut,
      oracleGain: Math.round(gain * 10) / 10,
      statsFavor: favor(statsIn - statsOut),
      starsFavor: favor(dT),
      flipLambda: flip !== null && flip > 0 && flip < 1 ? Math.round(flip * 100) / 100 : null,
    });
  }
  return swaps.sort((a, b) => b.oracleGain - a.oracleGain);
}

// ---------------------------------------------------------------------------
// Waiver moves
// ---------------------------------------------------------------------------

export interface WaiverMove {
  add: CosmicPlayer;
  drop: CosmicPlayer;
  statsGain: number;
  starsAdd: number;
  starsDrop: number;
  oracleGain: number;
  wouldStart: boolean;
  reason: string;
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

/** Plain-English Sleeper injury status ("NA" → "not active"). */
export function injuryStatusText(status?: string | null): string {
  const s = String(status ?? '');
  return STATUS_TEXT[s] ?? s.toLowerCase();
}

function isUnavailable(p: CosmicPlayer): boolean {
  return ['Out', 'IR', 'PUP', 'Sus', 'NA'].includes(String(p.injury_status ?? ''));
}

/**
 * Need-aware waiver moves. Never drops a starter, a player whose only problem
 * is a bye this week, or a player the roster needs for minimum depth.
 */
export function computeWaiverMoves(
  board: CosmicPlayer[],
  roster: RosterSlot[],
  lambda: number,
  currentWeek: number | undefined,
  limit = 5,
): WaiverMove[] {
  const rosterPlayers = roster.map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p));
  if (rosterPlayers.length === 0) return [];
  const rosterIds = new Set(rosterPlayers.map((p) => String(p.id)));
  const starterIds = new Set(
    roster.filter(isStarterSlot).map((s) => s.player && String(s.player.id)).filter(Boolean) as string[],
  );
  const eligible = new Set(roster.flatMap((s) => s.eligible_positions ?? []));
  const depth = minimumDepth(roster);
  const counts = countByPosition(rosterPlayers);

  const droppable = rosterPlayers
    .filter((p) => !starterIds.has(String(p.id)))
    .filter((p) => !(currentWeek && p.bye_week === currentWeek && !isUnavailable(p)))
    .filter((p) => (counts[p.position] ?? 0) > (depth[p.position] ?? 1))
    .sort((a, b) => oracleScore(a, lambda) - oracleScore(b, lambda));
  if (droppable.length === 0) return [];

  // Weakest current starter each position could replace, for "would start".
  const weakestStarterFor = (pos: NFLPosition): number => {
    const scores = roster
      .filter(isStarterSlot)
      .filter((s) => s.eligible_positions?.includes(pos) && s.player)
      .map((s) => oracleScore(s.player, lambda));
    return scores.length ? Math.min(...scores) : Infinity;
  };

  const candidates = board
    .filter((p) => p.draft_status === 'available' && !rosterIds.has(String(p.id)))
    .filter((p) => eligible.has(p.position) && !isUnavailable(p))
    .map((p) => ({ p, o: oracleScore(p, lambda) }))
    .sort((a, b) => b.o - a.o)
    .slice(0, 40);

  const moves: WaiverMove[] = [];
  const usedDrops = new Set<string>();
  for (const { p, o } of candidates) {
    const drop = droppable.find((d) => !usedDrops.has(String(d.id)));
    if (!drop) break;
    const gain = o - oracleScore(drop, lambda);
    if (gain <= 1) continue;
    const wouldStart = o > weakestStarterFor(p.position);
    const dropWhy =
      isUnavailable(drop) ? `${drop.name} is ${injuryStatusText(drop.injury_status)}` :
      statsPoints(drop) <= 0 ? `${drop.name} has no projection` :
      `${drop.name} is your weakest bench player`;
    moves.push({
      add: p,
      drop,
      statsGain: Math.round((statsPoints(p) - statsPoints(drop)) * 10) / 10,
      starsAdd: starsScore(p),
      starsDrop: starsScore(drop),
      oracleGain: Math.round(gain * 10) / 10,
      wouldStart,
      reason: `${dropWhy}. ${p.name} ${wouldStart ? 'would start for you' : 'adds bench depth'} at ${p.position}.`,
    });
    usedDrops.add(String(drop.id));
  }
  // Rank before limiting so "top move" means the same thing everywhere.
  return moves
    .sort((a, b) => Number(b.wouldStart) - Number(a.wouldStart) || b.oracleGain - a.oracleGain)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Bye outlook
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
  for (let w = fromWeek + 1; w <= fromWeek + weeksAhead; w++) {
    const starters = roster.filter(isStarterSlot).map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p && p.bye_week === w));
    const bench = roster.filter((s) => !isStarterSlot(s)).map((s) => s.player).filter((p): p is CosmicPlayer => Boolean(p && p.bye_week === w));
    if (starters.length > 0) alerts.push({ week: w, starters, bench });
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Trade partners
// ---------------------------------------------------------------------------

export interface TradePiece {
  player: CosmicPlayer;
  /** The starter this player would replace on the receiving team. */
  replaces: CosmicPlayer;
  /** Oracle points gained by the receiving lineup (stats and stars, by λ). */
  gain: number;
}

/** "Oracle 61.2 (15.3 pts · Stars 72)": a player's value, never stats alone. */
export function describeValue(p: CosmicPlayer, lambda: number): string {
  return `Oracle ${oracleScore(p, lambda).toFixed(1)} (${statsPoints(p).toFixed(1)} pts · Stars ${starsScore(p).toFixed(0)})`;
}

export interface TradePartner {
  team: CompetitorTeam;
  /** Your bench player who would start for them. */
  give: TradePiece | null;
  /** Their bench player who would start for you. */
  get: TradePiece | null;
  theyNeed: NFLPosition[];
  theyHaveSurplus: NFLPosition[];
  youCanOffer: NFLPosition[];
  counts: Partial<Record<NFLPosition, number>>;
  summary: string;
  score: number;
}

const POS_ORDER: NFLPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/**
 * Best bench player on `from` who would start over a starter of `to` at the
 * same position, by Oracle score (stats and stars weighed by λ).
 */
function bestUpgrade(
  fromBench: CosmicPlayer[],
  toStarters: CosmicPlayer[],
  canGive: (p: CosmicPlayer) => boolean,
  lambda: number,
): TradePiece | null {
  let best: TradePiece | null = null;
  for (const p of fromBench) {
    if (!canGive(p) || isUnavailable(p)) continue;
    const sameSpot = toStarters.filter((s) => s.position === p.position);
    if (sameSpot.length === 0) continue;
    const weakest = sameSpot.reduce((w, s) => (oracleScore(s, lambda) < oracleScore(w, lambda) ? s : w));
    const gain = oracleScore(p, lambda) - oracleScore(weakest, lambda);
    if (gain >= 1 && (!best || gain > best.gain)) {
      best = { player: p, replaces: weakest, gain: Math.round(gain * 10) / 10 };
    }
  }
  return best;
}

/**
 * Trade partners ranked by mutual lineup fit: you have a bench player who
 * would start for them, and they have one who would start for you. Teams that
 * are short of minimum depth where you have spare depth also qualify.
 */
export function computeTradePartners(
  teams: CompetitorTeam[],
  board: CosmicPlayer[],
  roster: RosterSlot[],
  lambda: number,
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
  const mine = split(me);
  const myCounts = countByPosition(mine.all);
  const mySurplus = POS_ORDER.filter((pos) => (myCounts[pos] ?? 0) > (depth[pos] ?? 99));
  const isSuperflex = isSuperflexRoster(roster);
  const canGiveMine = (p: CosmicPlayer) => (myCounts[p.position] ?? 0) > (depth[p.position] ?? 1);

  const partners: TradePartner[] = [];
  for (const t of teams) {
    if (t.is_user) continue;
    const theirs = split(t);
    const counts = countByPosition(theirs.all);
    const theyNeed = POS_ORDER.filter((pos) => depth[pos] !== undefined && (counts[pos] ?? 0) < (depth[pos] ?? 0));
    const theyHaveSurplus = POS_ORDER.filter((pos) => (counts[pos] ?? 0) > (depth[pos] ?? 99) + 1);
    const youCanOffer = theyNeed.filter((pos) => mySurplus.includes(pos));
    const theirCanGive = (p: CosmicPlayer) => (counts[p.position] ?? 0) > (depth[p.position] ?? 1);

    const give = bestUpgrade(mine.bench, theirs.starters, canGiveMine, lambda);
    const get = bestUpgrade(theirs.bench, mine.starters, theirCanGive, lambda);
    if (!(give && get) && youCanOffer.length === 0) continue;

    const name = t.name.replace(/\s*\(You\)$/, '');
    const parts: string[] = [];
    if (give) {
      parts.push(
        `${name} starts ${give.replaces.name}, ${describeValue(give.replaces, lambda)}, at ${give.player.position}; your bench ${give.player.name} rates ${describeValue(give.player, lambda)}.`,
      );
    }
    if (get) {
      parts.push(
        `Their bench ${get.player.name}, ${describeValue(get.player, lambda)}, would start over your ${get.replaces.name}, ${describeValue(get.replaces, lambda)}.`,
      );
    }
    if (youCanOffer.length) {
      parts.push(
        `They roster only ${youCanOffer
          .map((pos) => `${counts[pos] ?? 0} ${pos}${(counts[pos] ?? 0) === 1 ? '' : 's'}${pos === 'QB' && isSuperflex ? ' in a superflex league' : ''}`)
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
      score: (give?.gain ?? 0) + (get?.gain ?? 0) + youCanOffer.length * 5,
    });
  }
  return partners.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Derived celestial text
// ---------------------------------------------------------------------------

export function elementMix(players: CosmicPlayer[]): Record<ElementType, number> {
  const mix: Record<ElementType, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  for (const p of players) {
    const el = p.elemental_traits?.element;
    if (el) mix[el] += 1;
  }
  return mix;
}

/** The two most common elements, e.g. "Fire & Water". */
export function dominantElements(players: CosmicPlayer[]): string {
  const mix = elementMix(players);
  const top = (Object.entries(mix) as [ElementType, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([el]) => el);
  return top.length ? top.join(' & ') : '—';
}

/** Complementary pairs in classical astrology: Fire/Air and Earth/Water. */
export function elementRelation(a?: ElementType, b?: ElementType): 'Same element' | 'Complementary' | 'Opposed' | '—' {
  if (!a || !b) return '—';
  if (a === b) return 'Same element';
  const pair = [a, b].sort().join('/');
  if (pair === 'Air/Fire' || pair === 'Earth/Water') return 'Complementary';
  return 'Opposed';
}

/** Real QB + pass-catcher stacks among the given players. */
export function teamStacks(players: CosmicPlayer[]): string[] {
  const out: string[] = [];
  const byTeam = new Map<string, CosmicPlayer[]>();
  for (const p of players) {
    if (!p.team) continue;
    if (!byTeam.has(p.team)) byTeam.set(p.team, []);
    byTeam.get(p.team)!.push(p);
  }
  byTeam.forEach((ps, team) => {
    const qb = ps.find((p) => p.position === 'QB');
    const catchers = ps.filter((p) => p.position === 'WR' || p.position === 'TE');
    if (qb && catchers.length) {
      out.push(`${team}: ${qb.name} ☌ ${catchers.map((c) => c.name).join(' & ')}`);
    }
  });
  return out;
}
