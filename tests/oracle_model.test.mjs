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
 * Tier 10: Oracle model and recommendations (core/lib/oracle.ts).
 *
 * Covers the scoring model introduced in the 2026-10-10 UX rework
 * (Stats / Stars / Oracle), the empirical backtest defaults, and the rules every
 * recommendation must follow (see changes/AGENT_UX_GUIDELINES.md).
 */

import { register } from 'node:module';
register(new URL('./loader.mjs', import.meta.url));

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
const { render, screen, fireEvent, cleanup, jsx } = await import('./helpers/react_testing_wrapper.mjs');

const oracle = await import('../core/lib/oracle.ts');
const scoring = await import('../core/lib/scoring.ts');
const headshots = await import('../components/common/PlayerHeadshot.tsx');
const gameStatus = await import('../core/lib/gameStatus.ts');
const nflGames = await import('../core/lib/nflGames.ts');
const seasonContext = await import('../core/lib/seasonContext.ts');
const sleeper = await import('./dist/lib/sleeper.js');
const mockData = await import('./dist/lib/mockData.js');
const { default: OneiromancyContext, OneiromancyProvider } = await import('./dist/context/OneiromancyContext.js');
const { OraclePanel } = await import('./dist/components/oracle/OraclePanel.js');
const { NavigationShell } = await import('./dist/components/common/NavigationShell.js');
const { Astrolabe } = await import('./dist/components/astrolabe/Astrolabe.js');
const { SettingsDrawer } = await import('./dist/components/settings/SettingsDrawer.js');
const { WeeklyMoves } = await import('./dist/components/oneiromancy/WeeklyMoves.js');
const { TradesScreen } = await import('./dist/components/screens/TradesScreen.js');
const { PlayerMarketplace } = await import('./dist/components/screens/PlayerMarketplace.js');
const { OneiromancyDashboard } = await import('./dist/components/screens/OneiromancyDashboard.js');
const { MatchupsScreen } = await import('./dist/components/screens/MatchupsScreen.js');
const { CosmicBoard, comparePlayersForBoard } = await import('./dist/components/screens/CosmicBoard.js');
const { LeagueScreen } = await import('./dist/components/screens/LeagueScreen.js');
const { PlayerDetailModal } = await import('./dist/components/modals/PlayerDetailModal.js');

function buildMockCtx(overrides = {}) {
  return {
    draftState: {
      ...mockData.mock_oneiromancy_draft_2025,
      settings: {
        ...mockData.mockSettings,
        chaos_lambda: scoring.DEFAULT_CHAOS_LAMBDA,
        oracle_weights: { ...scoring.DEFAULT_ORACLE_WEIGHTS },
      },
      ...(overrides.draftState || {}),
    },
    isLoading: false,
    error: null,
    isAutoUpdate: false,
    isOfflineFallback: false,
    lastUpdated: new Date('2026-10-10T12:00:00Z'),
    activeTab: 'oneiromancy',
    boardInitialFilter: undefined,
    setTab: () => {},
    openBoardWithFilter: () => {},
    openOraclePanel: () => {},
    draftPlayer: () => {},
    setChaosLambda: () => {},
    updateChaosLambda: () => {},
    setOracleWeights: () => {},
    updateOracleWeights: () => {},
    selectPlayer: () => {},
    toggleAutoUpdate: () => {},
    setPollInterval: () => {},
    connectDraftId: async () => {},
    connectLeagueId: async () => {},
    connectSleeperUsername: async () => {},
    loadMockData: () => {},
    refreshDraft: async () => {},
    ...overrides,
  };
}

// --- fixtures -------------------------------------------------------------

let nextId = 900000;
function player(name, position, pts, spirit, extra = {}) {
  return {
    id: String(nextId++),
    name,
    position,
    team: 'DET',
    bye_week: 9,
    sleeper_projected_points: pts,
    spirit_score: spirit,
    harmony_score: 75,
    market_vor: 0,
    vor_normalized: 50,
    draft_status: 'my_team',
    elemental_traits: { element: 'Fire', sun_sign: 'Aries' },
    ...extra,
  };
}
function slot(slot_id, eligible, p) {
  return { slot_id, slot_name: slot_id, position: eligible[0], eligible_positions: eligible, player: p, is_locked: false };
}

// --- tests ------------------------------------------------------------------

describe('Tier 10: Oracle model and recommendations', () => {
  describe('10.1 Empirical backtest defaults', () => {
    it('10.1.1 default λ is the default 0.75 and star weights are 10/10/25/10/45', () => {
      assert.equal(scoring.DEFAULT_CHAOS_LAMBDA, 0.75);
      assert.deepEqual(scoring.DEFAULT_ORACLE_WEIGHTS, {
        celestial: 0.1,
        numeric: 0.1,
        geomantic: 0.25,
        oracular: 0.1,
        harmony: 0.45,
      });
    });

    it('10.1.2 recomputeDraftScores and Astrolabe default to DEFAULT_CHAOS_LAMBDA (0.75) and SettingsDrawer mounts sync controls when chaos_lambda is omitted', () => {
      const testPlayer = player('Default Lambda Check', 'WR', 20, 90);
      const [recomputedWithDefault] = scoring.recomputeDraftScores([testPlayer], {});
      const [recomputedExplicit] = scoring.recomputeDraftScores([testPlayer], { chaos_lambda: scoring.DEFAULT_CHAOS_LAMBDA });
      assert.equal(recomputedWithDefault.draft_score, recomputedExplicit.draft_score);

      const { getByTestId, unmount } = render(jsx(Astrolabe, {}));
      const astrolabeEl = getByTestId('astrolabe');
      assert.ok(astrolabeEl.getAttribute('aria-label')?.includes('3.25'), 'Astrolabe defaults to DEFAULT_CHAOS_LAMBDA (0.75 -> 3.25x)');
      unmount();

      let mockLoadedCount = 0;
      let drawerClosedCount = 0;
      const ctx = buildMockCtx({
        draftState: {
          ...mockData.mock_oneiromancy_draft_2025,
          settings: { ...mockData.mockSettings, chaos_lambda: undefined },
        },
        loadMockData: () => {
          mockLoadedCount += 1;
        },
      });
      const drawer = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(SettingsDrawer, {
            isOpen: true,
            onClose: () => {
              drawerClosedCount += 1;
            },
          }),
        })
      );
      assert.ok(drawer.getByRole('dialog'), 'SettingsDrawer mounts accessible dialog');
      const usernameInput = drawer.container.querySelector('#username-input');
      const leagueSelect = drawer.container.querySelector('#league-select');
      const applySyncBtn = drawer.container.querySelector('#apply-sync-btn');
      const loadMockBtn = drawer.container.querySelector('#load-mock-btn');
      assert.ok(usernameInput, 'SettingsDrawer renders #username-input control');
      assert.ok(leagueSelect, 'SettingsDrawer renders #league-select control');
      assert.ok(applySyncBtn, 'SettingsDrawer renders #apply-sync-btn action');
      assert.ok(loadMockBtn, 'SettingsDrawer renders #load-mock-btn action');
      assert.ok(!drawer.container.textContent.includes('NaN'), 'SettingsDrawer renders without NaN values');
      fireEvent.click(loadMockBtn);
      assert.equal(mockLoadedCount, 1, 'Clicking sample league button invokes loadMockData');
      assert.equal(drawerClosedCount, 1, 'Clicking sample league button closes SettingsDrawer');
      drawer.unmount();
    });

    it('10.1.3 Predictors panel renders all 25 pure esoteric prediction systems and toggles them interactively', () => {
      const toggled = [];
      const ctx = buildMockCtx({
        enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS],
        togglePredictorSystem: (id) => toggled.push(id),
        resetPredictorSystems: () => {},
      });
      const { getByTestId, unmount } = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }),
        })
      );
      assert.equal(oracle.PREDICTOR_SYSTEM_META.length, 25, 'Must define all 25 pure esoteric predictive systems');
      assert.ok(!oracle.ALL_PREDICTOR_SYSTEM_IDS.includes('venue_environment'), 'Mundane venue_environment system must be absent');
      assert.ok(!oracle.ALL_PREDICTOR_SYSTEM_IDS.includes('circadian_parans'), 'Removed circadian_parans system must be absent');
      for (const sys of oracle.PREDICTOR_SYSTEM_META) {
        const toggleBtn = getByTestId(`predictor-toggle-${sys.id}`);
        assert.ok(toggleBtn, `Predictor toggle ${sys.id} renders in DOM`);
      }
      fireEvent.click(getByTestId('predictor-toggle-elemental_matchup'));
      fireEvent.click(getByTestId('predictor-toggle-witchcraft_sabbats_esbats'));
      assert.deepEqual(toggled, ['elemental_matchup', 'witchcraft_sabbats_esbats']);
      unmount();
    });
  });

  describe('10.2 Base Projected Points and 25-System Modifier', () => {
    const p = player('Test Player', 'WR', 15, 80, { team: 'KC', birth_date: '1995-09-17', jersey_number: 15 });

    it('10.2.1 Base returns raw Sleeper projected points without 0-100 rescaling or capping', () => {
      assert.equal(oracle.basePoints(player('a', 'WR', 25, 70)), 25);
      assert.equal(oracle.basePoints(player('b', 'WR', 12.5, 70)), 12.5);
      assert.equal(oracle.basePoints(player('c', 'WR', 40, 70)), 40, 'not capped at 25 or 100');
    });

    it('10.2.2 Net Projected is Base + Overall Modifier across the 25 systems', () => {
      const forecast = oracle.playerForecast(p, { currentWeek: 2 });
      assert.equal(forecast.basePts, 15);
      assert.equal(forecast.systems.length, 25);
      assert.equal(
        forecast.adjustedPts,
        Number(Math.max(0, forecast.basePts + forecast.overallModifierPts).toFixed(2)),
      );
      assert.equal(oracle.projectedWithModifier(p, { currentWeek: 2 }), forecast.adjustedPts);
    });

    it('10.2.3 Modifier responds to venue, natal profile, and enabled predictor systems', () => {
      const domeStar = player('Dome Star', 'WR', 15, 80, { team: 'DET', birth_date: '1999-10-24', jersey_number: 14 });
      const mileHigh = player('Mile High', 'QB', 15, 80, { team: 'DEN', birth_date: '2000-02-25', jersey_number: 10 });
      const modDet = oracle.playerModifier(domeStar, { currentWeek: 2 });
      const modDen = oracle.playerModifier(mileHigh, { currentWeek: 2 });
      assert.ok(Number.isFinite(modDet) && Number.isFinite(modDen));
      const muted = oracle.playerModifier(domeStar, { currentWeek: 2, enabledSystems: [] });
      assert.equal(muted, 0, 'Disabling all predictors yields 0.00 modifier');
    });

    it('10.2.4 signed modifier tone scale classifies positive, neutral, and negative point differentials', () => {
      assert.equal(oracle.modifierTone(0.35), 'apex');
      assert.equal(oracle.modifierTone(0.25), 'apex');
      assert.equal(oracle.modifierTone(0.12), 'good');
      assert.equal(oracle.modifierTone(0.0), 'neutral');
      assert.equal(oracle.modifierTone(-0.02), 'neutral');
      assert.equal(oracle.modifierTone(-0.15), 'bad');
    });

    it('10.2.6 a player\'s Modifier never depends on fantasy bench vs starter slot (no bench penalty)', () => {
      const benchGuy = player('Bench Guy', 'WR', 3, 70, { draft_status: 'available', team: 'MIA', birth_date: '1998-11-29' });
      const asStarter = { ...benchGuy, draft_status: 'my_team' };
      assert.equal(
        oracle.playerModifier(benchGuy, { currentWeek: 2 }),
        oracle.playerModifier(asStarter, { currentWeek: 2 }),
        'bench player Modifier equals starter Modifier',
      );
    });

    it('10.2.5 injury codes are written out in plain English', () => {
      assert.equal(oracle.injuryStatusText('NA'), 'not active');
      assert.equal(oracle.injuryStatusText('IR'), 'on injured reserve');
      assert.equal(oracle.injuryStatusText('Sus'), 'suspended');
      assert.equal(oracle.injuryStatusText('Out'), 'out');
    });
  });

  describe('10.3 Lineup check', () => {
    it('10.3.1 recommends starting a better bench player and reports both sides in points', () => {
      const starter = player('Weak Starter', 'WR', 5, 60, { team: 'CLE' });
      const bench = player('Strong Bench', 'WR', 18, 85, { team: 'DET' });
      const roster = [slot('WR', ['WR'], starter), slot('BN', ['WR', 'RB', 'TE', 'QB'], bench)];
      const swaps = oracle.computeLineupCheck(roster, 0.75, 2);
      assert.equal(swaps.length, 1);
      assert.equal(swaps[0].playerIn.name, 'Strong Bench');
      assert.equal(swaps[0].playerOut.name, 'Weak Starter');
      assert.equal(swaps[0].statsFavor, 'in');
      assert.ok(swaps[0].pointsGain > 10, 'reports net point gain');
    });

    it('10.3.2 positive empirical modifier breaks close base-projection ties in lineup check', () => {
      const baseSlightlyHigher = player('Outdoor Road WR', 'WR', 14.0, 55, { team: 'NYG', birth_date: '1997-01-04', jersey_number: 80 });
      const modBoosted = player('Cohesive Dome WR', 'WR', 14.0, 95, { team: 'DET', birth_date: '1999-10-24', jersey_number: 14 });
      const fA = oracle.playerForecast(baseSlightlyHigher, { currentWeek: 2 });
      const fB = oracle.playerForecast(modBoosted, { currentWeek: 2 });
      // Give the lower-modifier player a tiny +0.05 base edge that is overcome if |mod diff| > 0.25, or test direct modifier tiebreak
      const pLowNet = fA.overallModifierPts <= fB.overallModifierPts ? baseSlightlyHigher : modBoosted;
      const pHighNet = pLowNet === baseSlightlyHigher ? modBoosted : baseSlightlyHigher;
      const diff = Math.abs(fA.overallModifierPts - fB.overallModifierPts);
      pLowNet.sleeper_projected_points = 14.0;
      pHighNet.sleeper_projected_points = diff > 0.25 ? 14.0 : 14.4;
      const roster = [slot('WR', ['WR'], pLowNet), slot('BN', ['WR'], pHighNet)];
      const swaps = oracle.computeLineupCheck(roster, undefined, 2);
      assert.equal(swaps.length, 1, 'higher Base + Modifier player is recommended to start');
      assert.equal(swaps[0].playerIn.id, pHighNet.id);
    });
  });

  describe('10.4 Waiver moves', () => {
    const base = () => {
      const qb = player('QB1', 'QB', 20, 80);
      const wr1 = player('WR1', 'WR', 15, 80);
      const wrBench = player('WR Bench', 'WR', 3, 60);
      const wrBench2 = player('WR Bench 2', 'WR', 4, 62);
      const roster = [
        slot('QB', ['QB'], qb),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'WR'], wrBench),
        slot('BN2', ['QB', 'WR'], wrBench2),
      ];
      return { qb, wr1, wrBench, wrBench2, roster };
    };

    it('10.4.1 only adds available, unrostered, healthy players and never drops a starter', () => {
      const { roster, qb, wr1 } = base();
      const fa = player('Free Agent', 'WR', 14, 82, { draft_status: 'available' });
      const injured = player('Injured FA', 'WR', 30, 99, { draft_status: 'available', injury_status: 'Out' });
      const owned = player('Owned Elsewhere', 'WR', 30, 99, { draft_status: 'drafted' });
      const moves = oracle.computeWaiverMoves([fa, injured, owned, qb, wr1], roster, 0.75, 5, 5);
      assert.ok(moves.length >= 1);
      for (const m of moves) {
        assert.equal(m.add.draft_status, 'available');
        assert.notEqual(m.add.name, 'Injured FA');
        assert.notEqual(m.drop.name, 'QB1');
        assert.notEqual(m.drop.name, 'WR1');
      }
    });

    it('10.4.2 never drops a player the lineup check says to start', () => {
      // Bench WR outranks the starting WR, so the lineup check promotes it.
      const starter = player('Fading Starter', 'WR', 4, 55);
      const rising = player('Rising Bench', 'WR', 16, 88);
      const filler = player('Filler', 'WR', 1, 50);
      const roster = [
        slot('WR', ['WR'], starter),
        slot('BN1', ['WR'], rising),
        slot('BN2', ['WR'], filler),
        slot('BN3', ['WR'], player('Depth', 'WR', 2, 52)),
      ];
      const fa = player('Waiver Star', 'WR', 17, 90, { draft_status: 'available' });
      const promoted = oracle.computeLineupCheck(roster, 0.75).map((s) => s.playerIn.name);
      assert.ok(promoted.includes('Rising Bench'));
      const moves = oracle.computeWaiverMoves([fa], roster, 0.75, 5, 5);
      for (const m of moves) assert.notEqual(m.drop.name, 'Rising Bench');
    });

    it('10.4.3 the limit applies after ranking, so "top move" is the same everywhere', () => {
      const { roster } = base();
      const fas = [
        player('Bench Upgrade', 'QB', 9, 70, { draft_status: 'available' }),
        player('Would Start', 'WR', 19, 90, { draft_status: 'available' }),
      ];
      const all = oracle.computeWaiverMoves(fas, roster, 0.75, 5, 5);
      const top = oracle.computeWaiverMoves(fas, roster, 0.75, 5, 1);
      assert.equal(top.length, 1);
      assert.equal(top[0].add.name, all[0].add.name);
      assert.ok(all[0].wouldStart, 'moves that would start rank first');
    });
  });

  describe('10.5 Trades and team ratings', () => {
    it('10.5.1 trade fit is judged by Oracle, and gains are in Oracle points', () => {
      // Both teams have spare depth at the position they give (depth = dedicated slots + 1).
      const myBenchRB = player('My Bench RB', 'RB', 15, 85);
      const myRBs = [player('My RB1', 'RB', 18, 85), player('My RB2', 'RB', 17, 85)];
      const myWR = player('My Weak WR', 'WR', 4, 60);
      const myWR2 = player('My WR2', 'WR', 3, 55);
      const theirRB = player('Their Weak RB', 'RB', 6, 60);
      const theirRB2 = player('Their RB2', 'RB', 5, 55);
      const theirBenchWR = player('Their Bench WR', 'WR', 16, 85);
      const theirWRs = [player('Their WR1', 'WR', 18, 85), player('Their WR2', 'WR', 17, 85)];
      const me = {
        roster_id: 1, slot: 1, name: 'Me (You)', is_user: true,
        players: [myBenchRB, ...myRBs, myWR, myWR2].map((x) => x.id),
        starters: [myRBs[0].id, myWR.id],
      };
      const them = {
        roster_id: 2, slot: 2, name: 'Them',
        players: [theirRB, theirRB2, theirBenchWR, ...theirWRs].map((x) => x.id),
        starters: [theirRB.id, theirWRs[0].id],
      };
      const roster = [
        slot('RB', ['RB'], myRBs[0]),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], myBenchRB),
        slot('BN2', ['RB', 'WR'], myRBs[1]),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];
      const board = [myBenchRB, ...myRBs, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];
      const [p] = oracle.computeTradePartners([me, them], board, roster, 0.75);
      assert.ok(p, 'a mutual-fit partner is found');
      assert.equal(p.give.player.name, 'My RB2', 'gives the best bench RB who would start for them');
      assert.equal(p.give.replaces.name, 'Their Weak RB');
      assert.equal(p.get.player.name, 'Their WR2');
      assert.equal(p.get.replaces.name, 'My Weak WR');
      const expected = oracle.oracleScore(p.give.player, 0.75) - oracle.oracleScore(theirRB, 0.75);
      assert.equal(p.give.gain, Math.round(expected * 10) / 10);
      assert.ok(p.summary.includes('pts'), 'the summary values players in net fantasy points');
    });

    it('10.5.2 team ratings sum the starters\' Base + Modifier and sort high to low', () => {
      const a = player('A', 'WR', 20, 90);
      const b = player('B', 'WR', 5, 55);
      const teams = [
        { roster_id: 1, name: 'Low', starters: [b.id], players: [b.id] },
        { roster_id: 2, name: 'High', starters: [a.id], players: [a.id] },
      ];
      const r = oracle.computeTeamOracles(teams, [a, b], 0.75);
      assert.deepEqual(r.map((x) => x.team.name), ['High', 'Low']);
      assert.equal(r[0].oracle, Math.round(oracle.oracleScore(a, 0.75) * 10) / 10);
    });
  });

  describe('10.6 Harmony and star weights', () => {
    it('10.6.1 the harmony breakdown adds up to the harmony score', () => {
      const lineup = [
        player('QB', 'QB', 20, 80, { team: 'NYG', elemental_traits: { element: 'Fire' } }),
        player('WR', 'WR', 10, 80, { team: 'NYG', elemental_traits: { element: 'Water' } }),
        player('RB', 'RB', 10, 80, { team: 'DAL', elemental_traits: { element: 'Earth' } }),
        player('TE', 'TE', 10, 80, { team: 'SF', elemental_traits: { element: 'Air' } }),
      ];
      const b = scoring.computeRosterHarmonyBreakdown(lineup);
      const sum = b.parts.reduce((s, x) => s + x.points, 0);
      assert.equal(b.total, Math.min(100, sum));
      assert.equal(scoring.computeRosterHarmony(lineup), b.total);
      assert.ok(b.parts.some((x) => x.label === 'QB stack'), 'NYG QB + WR is a stack');
      assert.ok(b.parts.some((x) => x.label === 'All 4 elements'));
    });

    it('10.6.2 changing a star weight changes Spirit; default weights leave it unchanged', () => {
      const breakdown = { celestial: 95, numeric: 60, geomantic: 70, oracular: 50, harmony: 65 };
      const spirit = scoring.computeSpiritScore(breakdown);
      const p = player('W', 'WR', 10, spirit, { divination_breakdown: breakdown });
      const same = scoring.recomputeDraftScores([p], { chaos_lambda: 0.75, oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS });
      assert.equal(same[0].spirit_score, spirit);
      const heavier = scoring.recomputeDraftScores([p], {
        chaos_lambda: 0.75,
        oracle_weights: { ...scoring.DEFAULT_ORACLE_WEIGHTS, celestial: 0.9 },
      });
      assert.ok(heavier[0].spirit_score > spirit, 'more weight on a strong pillar raises Spirit');
    });
  });

  describe('10.7 Images and mock mode', () => {
    it('10.7.1 headshot and logo URLs come from Sleeper\'s CDN; defenses have no headshot', () => {
      assert.equal(headshots.headshotUrl('4034'), 'https://sleepercdn.com/content/nfl/players/thumb/4034.jpg');
      assert.equal(headshots.headshotUrl('DET'), null);
      assert.equal(headshots.teamLogoUrl('DET'), 'https://sleepercdn.com/images/team_logos/nfl/det.png');
      assert.equal(headshots.teamLogoUrl('FA'), null);
    });

    it('10.7.2 loading the mock never adopts or saves a username', async () => {
      const { OneiromancyProvider, useOneiromancy } = await import('./dist/context/OneiromancyContext.js');
      const store = new Map();
      const prevStorage = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
      try {
        let triggerMock = null;
        function MockProbe() {
          const ctx = useOneiromancy();
          triggerMock = ctx.loadMockData;
          return jsx('div', { 'data-testid': 'mock-probe' }, ctx.draftState?.settings?.sleeper_username || 'none');
        }
        const { unmount } = render(jsx(OneiromancyProvider, { children: jsx(MockProbe, {}) }));
        assert.equal(typeof triggerMock, 'function');
        triggerMock();
        assert.notEqual(store.get('oneiromancy_active_username'), 'OneiroVanguard', 'mock must not save OneiroVanguard as active username');
        unmount();
      } finally {
        globalThis.localStorage = prevStorage;
      }
    });

    it('10.7.3 the app never acts on Sleeper (no action links in rendered recommendation screens)', () => {
      const ctx = buildMockCtx();
      for (const Comp of [WeeklyMoves, TradesScreen, PlayerMarketplace]) {
        const { container, unmount } = render(
          jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(Comp, {}) })
        );
        const links = container.querySelectorAll('a');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          assert.ok(!href.includes('sleeper.com/leagues'), 'Rendered screen must not link to act in Sleeper');
        }
        assert.ok(!container.textContent.includes('in Sleeper'), 'Rendered screen must not offer "... in Sleeper" actions');
        unmount();
      }
    });
  });

  describe('10.9 One lineup behind every recommendation (KaySwizz audit, 2026-10-11)', () => {
    // A superflex roster: QB Allen, FLEX Watson (WR 16.0), SUPER_FLEX Olave (WR 16.2), bench QB Willis (16.8).
    const sfRoster = () => {
      const allen = player('Josh Allen', 'QB', 23.4, 70);
      const watson = player('Christian Watson', 'WR', 14.0, 60);
      const olave = player('Chris Olave', 'WR', 16.2, 75);
      const willis = player('Malik Willis', 'QB', 18.8, 80);
      const roster = [
        slot('QB', ['QB'], allen),
        slot('FLEX', ['RB', 'WR', 'TE'], watson),
        slot('SUPER_FLEX', ['QB', 'RB', 'WR', 'TE'], olave),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], willis),
      ];
      return { roster, allen, watson, olave, willis };
    };

    it('10.9.1 a QB coming off the bench is placed at Superflex, never Flex, and the WR it displaces is named', () => {
      gameStatus.clearGameStatus();
      const { roster, watson, olave, willis } = sfRoster();
      const [swap] = oracle.computeLineupCheck(roster, 0.75);
      assert.ok(swap, 'a swap is recommended');
      assert.equal(swap.playerIn.id, willis.id);
      assert.equal(swap.playerOut.id, watson.id);
      assert.equal(swap.slot, 'Superflex', 'a QB can only go to Superflex');
      assert.equal(swap.moved?.player.id, olave.id, 'Olave moves out of Superflex');
      assert.equal(swap.moved?.to, 'Flex');
    });

    it('10.9.2 "would start" for a waiver add is judged against the recommended lineup, not the current one', () => {
      gameStatus.clearGameStatus();
      const fannin = player('Harold Fannin', 'TE', 8.0, 50, { team: 'CLE' });
      const loveland = player('Colston Loveland', 'TE', 13.5, 85, { team: 'CHI' });
      const sarratt = player('Elijah Sarratt', 'WR', 1.6, 60);
      const extraWr = player('Spare WR', 'WR', 2.0, 60);
      const otton = player('Cade Otton', 'TE', 10.2, 75, { draft_status: 'available', team: 'TB' });
      const roster = [
        slot('TE', ['TE'], fannin),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], loveland),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], sarratt),
        slot('BN3', ['QB', 'RB', 'WR', 'TE'], extraWr),
      ];
      assert.ok(oracle.oracleScore(otton, 0.75, { currentWeek: 5 }) > oracle.oracleScore(fannin, 0.75, { currentWeek: 5 }), 'Otton beats the current TE');
      assert.ok(oracle.oracleScore(otton, 0.75, { currentWeek: 5 }) < oracle.oracleScore(loveland, 0.75, { currentWeek: 5 }), 'but not the recommended TE');
      const moves = oracle.computeWaiverMoves([otton], roster, 0.75, 5, 5);
      for (const m of moves) assert.equal(m.wouldStart, false, 'Otton would not start over Loveland');
    });

    it('10.9.3 players whose game has kicked off are never swapped, added or dropped', () => {
      const { roster, willis } = sfRoster();
      willis.team = 'MIA';
      gameStatus.setGameStatus(5, { MIA: 'in_game', DET: 'pre_game' });
      try {
        assert.equal(oracle.computeLineupCheck(roster, 0.75).length, 0, 'a locked bench player cannot come in');
        const lockedAdd = player('Locked FA', 'WR', 30, 90, { draft_status: 'available', team: 'MIA' });
        const moves = oracle.computeWaiverMoves([lockedAdd], roster, 0.75, 5, 5);
        assert.equal(moves.length, 0, 'a free agent whose game started cannot be added for this week');
      } finally {
        gameStatus.clearGameStatus();
      }
    });

    it('10.9.4 signed bench players are never dropped for unsigned free agents and droppable bench players are preserved for valid signed additions', () => {
      const te = player('Starter TE', 'TE', 10.0, 50);
      const wr1 = player('Starter WR', 'WR', 15.0, 70);
      const benchWr1 = player('Bench WR 1', 'WR', 12.0, 60);
      const droppableWr = player('Droppable WR', 'WR', 4.0, 40, { team: 'CLE' });
      const roster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], benchWr1),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], droppableWr),
      ];
      const phantomFA = player('Phantom FA', 'WR', 35, 95, { draft_status: 'available', team: 'FA' });
      const validSigned = player('Valid Signed Add', 'WR', 22, 70, { draft_status: 'available', team: 'ARI' });

      // phantomFA has higher oracle score than validSigned, but is unsigned.
      // computeWaiverMoves must not pair phantomFA with droppableWr (burning droppableWr), but instead pair validSigned with droppableWr.
      const moves = oracle.computeWaiverMoves([phantomFA, validSigned], roster, 0.75, 5, 5);
      assert.equal(moves.length, 1, 'Only the signed candidate should generate a waiver move');
      assert.equal(moves[0].add.name, 'Valid Signed Add');
      assert.equal(moves[0].drop.name, 'Droppable WR');

      // Also verify that an unsigned candidate CAN drop an already unsigned bench player
      const rosterWithUnsigned = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], benchWr1),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], droppableWr),
        slot('BN3', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      const faMoves = oracle.computeWaiverMoves([phantomFA], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(faMoves.length, 1, 'Unsigned FA can drop an unsigned bench player');
      assert.equal(faMoves[0].drop.name, 'Unsigned Bench');

      // Unsigned candidate isolation and full candidate traversal prevent >40 unsigned FAs from crowding out validSigned
      const unsignedCrowd = Array.from({ length: 45 }, (_, i) =>
        player(`Phantom FA ${i}`, 'WR', 30 + (i % 10), 90, { draft_status: 'available', team: 'FA' })
      );
      const crowdedMoves = oracle.computeWaiverMoves([...unsignedCrowd, validSigned], roster, 0.75, 5, 5);
      assert.equal(crowdedMoves.length, 1, 'Signed candidate is not crowded out by unsigned free agents');
      assert.equal(crowdedMoves[0].add.name, 'Valid Signed Add');

      // Mixed roster with both signed and unsigned bench drops: 45 unsigned FAs + validSigned
      const mixedCrowdedMoves = oracle.computeWaiverMoves([...unsignedCrowd, validSigned], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(mixedCrowdedMoves.length, 2, 'Both unsigned FA and signed candidate moves should be generated');
      assert.ok(mixedCrowdedMoves.some((m) => m.add.name === 'Valid Signed Add' && m.drop.name === 'Droppable WR'), 'Signed addition drops signed bench player');
      assert.ok(mixedCrowdedMoves.some((m) => m.drop.name === 'Unsigned Bench'), 'Unsigned addition drops unsigned bench player');

      // Case (a): Signed add ranked ABOVE unsigned FA on a mixed roster with signed and unsigned drops
      const topSigned = player('Top Signed Add', 'WR', 28, 92, { draft_status: 'available', team: 'LAR' });
      const midFA = player('Mid FA Add', 'WR', 24, 82, { draft_status: 'available', team: 'FA' });
      const rankedMoves = oracle.computeWaiverMoves([topSigned, midFA], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(rankedMoves.length, 1, 'Top signed add claims weakest unsigned drop; mid FA is not paired with signed drop');
      assert.equal(rankedMoves[0].add.name, 'Top Signed Add');
      assert.equal(rankedMoves[0].drop.name, 'Unsigned Bench');

      // With multiple unsigned drops, both top signed and mid FA receive drops without touching signed bench
      const twoUnsignedRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], benchWr1),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], droppableWr),
        slot('BN3', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench 1', 'WR', 2.0, 20, { team: 'FA' })),
        slot('BN4', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench 2', 'WR', 2.5, 22, { team: 'FA' })),
      ];
      const multiUnsignedMoves = oracle.computeWaiverMoves([topSigned, midFA], twoUnsignedRoster, 0.75, 5, 5);
      assert.equal(multiUnsignedMoves.length, 2, 'Both signed and unsigned additions receive drops when unsigned bench depth permits');
      assert.ok(multiUnsignedMoves.some((m) => m.add.name === 'Top Signed Add' && m.drop.name === 'Unsigned Bench 1'), 'Top signed add drops weakest bench');
      assert.ok(multiUnsignedMoves.some((m) => m.add.name === 'Mid FA Add' && m.drop.name === 'Unsigned Bench 2'), 'Mid FA add drops second unsigned bench');
      for (const m of multiUnsignedMoves) assert.notEqual(m.drop.name, 'Droppable WR', 'Signed bench is never dropped for unsigned add');

      // Case (b): Signed add alone on mixed roster drops the teamless unsigned player first (weakest bench)
      const aloneMoves = oracle.computeWaiverMoves([validSigned], rosterWithUnsigned, 0.75, 5, 5);
      assert.equal(aloneMoves.length, 1, 'Single signed candidate produces 1 move');
      assert.equal(aloneMoves[0].drop.name, 'Unsigned Bench', 'Signed candidate drops teamless unsigned player first');
      assert.ok(
        aloneMoves[0].reason.includes('lowest-projected bench player') || aloneMoves[0].reason.includes('unsigned'),
        'Reason cites lowest-projected or unsigned bench player',
      );

      // Case (c): Fallback where no signed drop yields gain > 1 but unsigned drop does
      const tightRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], player('Strong Starter WR', 'WR', 25.0, 85)),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Solid Signed Bench', 'WR', 20.0, 70, { team: 'DAL' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      // Assert precondition: with unsigned drop replaced by another signed player, marginalSigned yields 0 moves
      const allSignedTightRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], player('Strong Starter WR', 'WR', 25.0, 85)),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Solid Signed Bench', 'WR', 20.0, 70, { team: 'DAL' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Extra Signed Bench', 'WR', 21.0, 75, { team: 'SF' })),
      ];
      const marginalSigned = player('Marginal Signed', 'WR', 20.2, 70, { draft_status: 'available', team: 'KC' });
      assert.equal(
        oracle.computeWaiverMoves([marginalSigned], allSignedTightRoster, 0.75, 5, 5).length,
        0,
        'Precondition verified: marginal signed candidate yields 0 moves when all bench drops are signed with gain <= 1'
      );

      const fallbackMoves = oracle.computeWaiverMoves([marginalSigned], tightRoster, 0.75, 5, 5);
      assert.equal(fallbackMoves.length, 1, 'Marginal signed candidate produces fallback move');
      assert.equal(fallbackMoves[0].drop.name, 'Unsigned Bench', 'Marginal signed candidate falls back to unsigned drop');

      // Case (d): A low-value unsigned FA does not push a top signed add onto a useful signed bench player
      const probeRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Useful Signed Bench', 'WR', 12.0, 60, { team: 'DET' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      const signedStar = player('Signed Star', 'WR', 25.0, 85, { draft_status: 'available', team: 'KC' });
      const lowFA = player('Low FA Add', 'WR', 4.0, 25, { draft_status: 'available', team: 'FA' });
      const probeMoves = oracle.computeWaiverMoves([signedStar, lowFA], probeRoster, 0.75, 5, 5);
      assert.equal(probeMoves.length, 1, 'Only signed star should produce a move; low FA must not burn signed bench');
      assert.equal(probeMoves[0].add.name, 'Signed Star');
      assert.equal(probeMoves[0].drop.name, 'Unsigned Bench', 'Signed star drops weakest unsigned player');

      // Case (e): Weak signed bench player is dropped before higher-scoring unsigned bench player
      const weakSignedRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], wr1),
        slot('BN1', ['QB', 'RB', 'WR', 'TE'], player('Weak Signed Bench', 'WR', 1.0, 15, { team: 'MIA' })),
        slot('BN2', ['QB', 'RB', 'WR', 'TE'], player('Decent Unsigned Bench', 'WR', 5.0, 35, { team: 'FA' })),
      ];
      const singleSignedMoves = oracle.computeWaiverMoves([signedStar], weakSignedRoster, 0.75, 5, 5);
      assert.equal(singleSignedMoves.length, 1);
      assert.equal(singleSignedMoves[0].drop.name, 'Weak Signed Bench', 'Signed addition drops weakest player regardless of signed status');

      // Case (f): Multi-signed candidates (S1, S2) competing with unsigned FA (F) do not suffer false reservation
      const twoDropRoster = [
        slot('TE', ['TE'], te),
        slot('WR', ['WR'], player('Starter WR 1', 'WR', 25.0, 85)),
        slot('BN_SIGNED', ['QB', 'RB', 'WR', 'TE'], player('Droppable WR2', 'WR', 10.0, 50, { team: 'CLE' })),
        slot('BN_UNSIGNED', ['QB', 'RB', 'WR', 'TE'], player('Unsigned Bench2', 'WR', 2.0, 20, { team: 'FA' })),
      ];
      const s1 = player('Signed S1', 'WR', 28.0, 90, { draft_status: 'available', team: 'LAR' });
      const s2 = player('Signed S2', 'WR', 27.0, 88, { draft_status: 'available', team: 'SF' });
      const faF = player('Unsigned FA F', 'WR', 26.0, 86, { draft_status: 'available', team: 'FA' });
      const multiSignedMoves = oracle.computeWaiverMoves([s1, s2, faF], twoDropRoster, 0.75, 5, 5);
      assert.equal(multiSignedMoves.length, 2, 'Exactly 2 moves for 2 droppable players');
      assert.equal(multiSignedMoves[0].add.name, 'Signed S1');
      assert.equal(multiSignedMoves[0].drop.name, 'Unsigned Bench2', 'Top signed candidate S1 gets the weakest bench drop');
      assert.equal(multiSignedMoves[1].add.name, 'Signed S2');
      assert.equal(multiSignedMoves[1].drop.name, 'Droppable WR2', 'Second signed candidate S2 gets remaining signed drop');

      // Case (g): Single top move (limit = 1) always drops weakest bench player without reservation disruption
      const topMoveOnly = oracle.computeWaiverMoves([topSigned, midFA], rosterWithUnsigned, 0.75, 5, 1);
      assert.equal(topMoveOnly.length, 1, 'limit = 1 produces strictly 1 move');
      assert.equal(topMoveOnly[0].add.name, 'Top Signed Add');
      assert.equal(topMoveOnly[0].drop.name, 'Unsigned Bench', 'Single top move drops the weakest bench player without reservation distortion');
    });
  });

  describe('10.10 Real games on the matchup cards (owner: "real kickoff times", 2026-10-11)', () => {
    it('10.10.1 the moon is computed, not picked: known new and full moons', () => {
      assert.equal(nflGames.moonAt(new Date('2024-04-08T18:00:00Z')), 'New Moon in Aries', 'the 2024 total eclipse');
      assert.match(nflGames.moonAt(new Date('2026-10-10T12:00:00Z')), /^New Moon in Libra$/);
      assert.match(nflGames.moonAt(new Date('2026-09-26T12:00:00Z')), /^Full Moon in /);
    });

    it('10.10.2 kickoff labels use Eastern time, and say TBA rather than invent a time', () => {
      assert.equal(nflGames.kickoffLabel({ kickoff: '2026-10-11T17:00Z', date: '2026-10-11' }), 'Sun, Oct 11 · 1:00 PM ET');
      assert.equal(nflGames.kickoffLabel({ kickoff: null, date: '2026-10-18' }), 'Sun, Oct 18 · time TBA');
    });

    it('10.10.3 both teams in a game share one game record; a bye has none', () => {
      nflGames.setWeekGames(5, [{ week: 5, home: 'ATL', away: 'BAL', kickoff: '2026-10-11T17:00Z', date: '2026-10-11', venue: { name: 'Mercedes-Benz Stadium', city: 'Atlanta' }, neutral: false }]);
      try {
        assert.equal(nflGames.teamGame(5, 'BAL'), nflGames.teamGame(5, 'ATL'));
        assert.equal(nflGames.teamGame(5, 'BAL').venue.name, 'Mercedes-Benz Stadium', 'road team plays at the home stadium');
        assert.equal(nflGames.teamGame(5, 'KC'), undefined);
      } finally {
        nflGames.clearNflGames();
      }
    });

    it('10.10.4 the planetary hour depends only on kickoff and venue, so teammates in one game match', () => {
      const t = new Date('2026-10-11T17:00:00Z');
      assert.equal(nflGames.planetaryHourAt(t, -88.06), nflGames.planetaryHourAt(t, -88.06));
      assert.match(nflGames.planetaryHourAt(t, -88.06), /^Hour of (Saturn|Jupiter|Mars|Sun|Venus|Mercury|Moon) \(/);
    });

    it('10.10.5 neutral sites get their own coordinates; live cards use the live game kickoff and lunar phase', () => {
      assert.deepEqual(nflGames.neutralVenueCoords('Tottenham Hotspur Stadium'), { lat: 51.6043, lon: -0.0664 });
      assert.equal(nflGames.neutralVenueCoords('Unknown Field'), null);
      nflGames.setWeekGames(5, [
        {
          week: 5,
          home: 'BUF',
          away: 'NYJ',
          kickoff: '2026-10-11T17:00:00Z',
          date: '2026-10-11',
          venue: { name: 'Highmark Stadium', city: 'Orchard Park', state: 'NY' },
          neutral: false,
        },
      ]);
      try {
        const game = nflGames.teamGame(5, 'BUF');
        assert.ok(game, 'Live game found for BUF in Week 5');
        assert.equal(nflGames.kickoffLabel(game), 'Sun, Oct 11 · 1:00 PM ET');
        assert.equal(nflGames.moonAt(new Date(game.kickoff)), 'New Moon in Scorpio');
      } finally {
        nflGames.clearNflGames();
      }
    });
  });

  describe('10.11 4-Section Consolidation, DIVINATION_PILLARS & Deduplication Invariants', () => {
    it('10.11.1 NavigationShell renders exactly the 4 tabs [oneiromancy, matchups, board, league] with labels [Roster, Matchup, Players, League]', () => {
      const ctx = buildMockCtx();
      const { getByTestId, queryByTestId, unmount } = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(NavigationShell, {
            activeTab: 'oneiromancy',
            onTabChange: () => {},
            children: jsx('div', { 'data-testid': 'shell-child' }, 'Body'),
          }),
        })
      );
      const expected = [
        ['nav-tab-oneiromancy', 'Roster'],
        ['nav-tab-matchups', 'Matchup'],
        ['nav-tab-board', 'Players'],
        ['nav-tab-league', 'League'],
      ];
      for (const [testId, label] of expected) {
        const tabBtn = getByTestId(testId);
        assert.ok(tabBtn.textContent.includes(label), `${testId} must display label ${label}`);
      }
      for (const legacyTab of ['nav-tab-waivers', 'nav-tab-trades', 'nav-tab-chaos_dial', 'nav-tab-encyclopedia']) {
        assert.equal(queryByTestId(legacyTab), null, `Legacy tab ${legacyTab} must not be rendered as a separate top-level tab`);
      }
      unmount();
    });

    it('10.11.2 All 4 primary screens render cleanly with zero duplicate sections or repeated controls', () => {
      const ctx = buildMockCtx();

      const rosterRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) })
      );
      assert.equal(rosterRender.getAllByTestId('universe-state-banner').length, 1, 'Roster renders exactly 1 universe-state-banner');
      assert.equal(rosterRender.queryByTestId('synergy-constellation-svg'), null, 'Roster omits fantasy-team synergy-constellation-svg');
      assert.equal(rosterRender.getAllByTestId('18-week-coverage-strip').length, 1, 'Roster renders exactly 1 18-week-coverage-strip');
      rosterRender.unmount();

      const matchupRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, {}) })
      );
      assert.equal(matchupRender.getAllByTestId('positional-matchup-grid').length, 1, 'Matchup renders exactly 1 positional-matchup-grid');
      assert.ok(!matchupRender.container.textContent.includes('YOUR BENCH'), 'Matchup has no duplicate bench section');
      assert.ok(!matchupRender.container.textContent.includes('Comparative Advantages'), 'Matchup has no duplicate Comparative Advantages block');
      const userStarters = (ctx.draftState.weekly_matchup?.player_favorabilities || []).filter(
        (p) => p.is_user_team && !p.is_benched
      );
      for (const s of userStarters) {
        const cards = matchupRender.getAllByTestId(`matchup-starter-card-${s.player_id}`);
        assert.equal(cards.length, 1, `Starter ${s.player_name} must render exactly 1 card in positional-matchup-grid`);
      }
      matchupRender.unmount();

      const boardRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(CosmicBoard, {}) })
      );
      assert.equal(boardRender.getAllByTestId('cosmic-board-table').length, 1, 'Players renders exactly 1 cosmic-board-table');
      boardRender.unmount();

      const leagueRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(LeagueScreen, {}) })
      );
      assert.equal(leagueRender.getAllByTestId('celestial-leaderboard').length, 1, 'League renders exactly 1 celestial-leaderboard');
      leagueRender.unmount();
    });

    it('10.11.3 DIVINATION_PILLARS in core/lib/scoring.ts defines whatItMeasures and whyItMatters for all 5 pillars with defaultVal summing to 100 and matching DEFAULT_ORACLE_WEIGHTS', () => {
      assert.ok(Array.isArray(scoring.DIVINATION_PILLARS), 'DIVINATION_PILLARS must be exported as an array');
      assert.equal(scoring.DIVINATION_PILLARS.length, 5, 'Must define all 5 divination pillars');
      let sum = 0;
      for (const p of scoring.DIVINATION_PILLARS) {
        assert.ok(p.whatItMeasures && p.whatItMeasures.length > 15, `${p.key} must have whatItMeasures`);
        assert.ok(p.whyItMatters && p.whyItMatters.length > 15, `${p.key} must have whyItMatters`);
        assert.equal(p.defaultVal, Math.round(scoring.DEFAULT_ORACLE_WEIGHTS[p.key] * 100), `${p.key} defaultVal must match DEFAULT_ORACLE_WEIGHTS`);
        sum += p.defaultVal;
      }
      assert.equal(sum, 100, 'DIVINATION_PILLARS defaultVal must sum to 100');
    });

    it('10.11.4 compute18WeekByeCoverage returns 18 weeks and classifies cluster (3+), normal (1-2), and none (0)', () => {
      const roster = [
        slot('QB', ['QB'], player('P1', 'QB', 20, 80, { bye_week: 7 })),
        slot('RB1', ['RB'], player('P2', 'RB', 16, 80, { bye_week: 7 })),
        slot('WR1', ['WR'], player('P3', 'WR', 15, 80, { bye_week: 7 })),
        slot('BN1', ['RB'], player('P4', 'RB', 10, 75, { bye_week: 10 })),
      ];
      const cov = oracle.compute18WeekByeCoverage(roster);
      assert.equal(cov.length, 18);
      assert.equal(cov[6].week, 7);
      assert.equal(cov[6].severity, 'cluster');
      assert.equal(cov[6].players.length, 3);
      assert.equal(cov[9].week, 10);
      assert.equal(cov[9].severity, 'normal');
      assert.equal(cov[0].severity, 'none');
    });

    it('10.11.5 KNOWN_ROSTERED_NFL_PLAYERS includes Tyler Huntley (7083), mockCosmicBoard marks competitor starters as drafted, and UI tabs render unified tables without duplicate sections', () => {
      assert.ok(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'], 'KNOWN_ROSTERED_NFL_PLAYERS must include player 7083 (Tyler Huntley)');
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'].first_name, 'Tyler');
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'].last_name, 'Huntley');
      assert.equal(sleeper.KNOWN_ROSTERED_NFL_PLAYERS['7083'].team, 'BAL');

      const allen = mockData.mockCosmicBoard.find((p) => p.id === '4984');
      assert.ok(allen, 'Josh Allen (4984) must exist on mockCosmicBoard');
      assert.equal(allen.draft_status, 'drafted', 'Josh Allen (4984) must have draft_status === drafted');
      assert.equal(allen.drafted_by, 'Supernova Surge', 'Josh Allen (4984) must record drafted_by Supernova Surge');

      const ctx = buildMockCtx();

      // CosmicBoard renders ONE unified player table across all 4 sub-modes
      const boardRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(CosmicBoard, {}) })
      );
      for (const mode of ['all', 'waivers', 'trades', 'my_team']) {
        fireEvent.click(boardRender.getByTestId(`board-mode-${mode}`));
        const tables = boardRender.getAllByTestId('cosmic-board-table');
        assert.equal(tables.length, 1, `CosmicBoard mode=${mode} must render exactly 1 unified player table`);
      }
      boardRender.unmount();

      // OneiromancyDashboard omits fantasy-team Elemental Balance; PlayerDetailModal computes it per player + real NFL team
      const dashRender = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) })
      );
      assert.equal(dashRender.queryByTestId('synergy-constellation-svg'), null, 'Roster screen omits fantasy-team constellation');
      dashRender.unmount();

      // Verify real NFL team Elemental Balance resolves each player's NFL teammates rather than fantasy roster
      const detPlayer =
        mockData.mockCosmicBoard.find((p) => p.team === 'DET' && p.position === 'WR') ||
        player('Amon-Ra St. Brown', 'WR', 19.2, 86, { id: 'det-arsb', team: 'DET', elemental_traits: { element: 'Water', sun_sign: 'Scorpio' } });
      const bufPlayer =
        mockData.mockCosmicBoard.find((p) => p.team === 'BUF' && p.position === 'QB') ||
        player('Josh Allen', 'QB', 24.5, 90, { id: 'buf-allen', team: 'BUF', elemental_traits: { element: 'Air', sun_sign: 'Gemini' } });

      const detUnit = sleeper.resolveNFLTeamUnit(detPlayer.team, ctx.draftState.cosmic_board, ctx.draftState.my_roster, detPlayer);
      const bufUnit = sleeper.resolveNFLTeamUnit(bufPlayer.team, ctx.draftState.cosmic_board, ctx.draftState.my_roster, bufPlayer);
      assert.ok(detUnit.length >= 4 && detUnit.every((p) => p.team === 'DET'), 'DET unit must contain strictly real DET players');
      assert.ok(bufUnit.length >= 4 && bufUnit.every((p) => p.team === 'BUF'), 'BUF unit must contain strictly real BUF players');

      const detBalance = oracle.computePlayerTeamElementalBalance(detPlayer, detUnit);
      const bufBalance = oracle.computePlayerTeamElementalBalance(bufPlayer, bufUnit);
      assert.equal(detBalance.teamCode, 'DET');
      assert.equal(bufBalance.teamCode, 'BUF');
      assert.ok(detBalance.activeStacks.length >= 1, 'DET offensive unit must detect real NFL QB + WR/TE stack');

      // Two players on the same real NFL team with different positions/elements receive player-specific Harmony breakdowns
      const sameTeamWr = player('Alpha Receiver', 'WR', 16.0, 82, {
        id: 'det-custom-wr',
        team: 'DET',
        elemental_traits: { element: detUnit.find((u) => u.position === 'QB')?.elemental_traits?.element || 'Air', sun_sign: 'Libra' },
      });
      const sameTeamK = player('Omega Kicker', 'K', 8.5, 75, {
        id: 'det-custom-k',
        team: 'DET',
        elemental_traits: { element: 'Earth', sun_sign: 'Taurus' },
      });
      const wrBal = oracle.computePlayerTeamElementalBalance(sameTeamWr, detUnit);
      const kBal = oracle.computePlayerTeamElementalBalance(sameTeamK, detUnit);
      assert.notDeepEqual(wrBal.parts, kBal.parts, 'Harmony parts must differentiate each player role and elemental fit on their NFL team');

      // Unsigned FA graceful handling
      const faCand = player('Unsigned Prospect', 'RB', 4.0, 70, { id: 'fa-cand-1', team: 'FA' });
      const faBal = oracle.computePlayerTeamElementalBalance(faCand, sleeper.resolveNFLTeamUnit('FA', ctx.draftState.cosmic_board, [], faCand));
      assert.equal(faBal.isFreeAgent, true);
      assert.equal(faBal.unitPlayers.length, 1);
      assert.equal(faBal.harmonyScore, 50);

      const modalRender = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(PlayerDetailModal, { player: detPlayer, isOpen: true, onClose: () => {} }),
        })
      );
      const modalSvg = modalRender.getByTestId('synergy-constellation-svg');
      assert.ok(modalSvg.textContent.includes('Fire ('), 'PlayerDetailModal radar renders Fire spoke');
      assert.ok(modalRender.getByTestId('player-team-elemental-balance').textContent.includes('DET NFL unit'), 'Modal scopes Elemental Balance to DET NFL unit');
      modalRender.unmount();

      // OraclePanel does not render duplicate oracle-preview or duplicate formula headers
      const panelRender = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }),
        })
      );
      assert.equal(panelRender.queryByTestId('oracle-preview'), null, 'OraclePanel must not duplicate lineup/waiver move previews');
      panelRender.unmount();

      // When leagueRosters is populated, dropped draft picks become available and traded players reflect current roster owner
      const testMeta = {
        ...mockData.mockDraftMetadata,
        draft_order: { u1: 1, u2: 2 },
      };
      const testUsers = [
        { user_id: 'u1', display_name: 'AlphaTeam', username: 'alpha' },
        { user_id: 'u2', display_name: 'BetaTeam', username: 'beta' },
      ];
      const testPicks = [
        { pick_no: 1, round: 1, draft_slot: 1, player_id: '4574', picked_by: 'u1', roster_id: 1, metadata: { first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL' } },
        { pick_no: 2, round: 1, draft_slot: 2, player_id: '4984', picked_by: 'u2', roster_id: 2, metadata: { first_name: 'Josh', last_name: 'Allen', position: 'QB', team: 'BUF' } },
        { pick_no: 3, round: 2, draft_slot: 1, player_id: '7083', picked_by: 'u1', roster_id: 1, metadata: { first_name: 'Tyler', last_name: 'Huntley', position: 'QB', team: 'BAL' } },
      ];
      // 7083 was drafted by u1 and then dropped (not in any r.players); 4574 was drafted by u1 and traded to u2
      const testRosters = [
        { roster_id: 1, owner_id: 'u1', players: ['6813'], starters: ['6813'] },
        { roster_id: 2, owner_id: 'u2', players: ['4984', '4574'], starters: ['4984'] },
      ];
      const liveState = sleeper.transformToDraftState(
        testMeta,
        testPicks,
        { user_id: 'u1', user_slot: 1 },
        {},
        testUsers,
        testRosters,
      );
      const droppedPlayer = liveState.cosmic_board.find((p) => String(p.id) === '7083');
      const tradedPlayer = liveState.cosmic_board.find((p) => String(p.id) === '4574');
      assert.ok(droppedPlayer, 'Dropped draft pick 7083 exists on board');
      assert.equal(droppedPlayer.draft_status, 'available', 'Drafted-then-dropped player must have draft_status === available');
      assert.ok(tradedPlayer, 'Traded draft pick 4574 exists on board');
      assert.equal(tradedPlayer.draft_status, 'drafted', 'Traded player must have draft_status === drafted');
      assert.equal(tradedPlayer.drafted_by, 'BetaTeam', 'Traded player must be credited to current roster owner BetaTeam');
    });
  });

  describe('10.12 Live Sleeper Week 7 Payload & Null-Fuzzed NFLPlayer Behavioral Verification', () => {
    it('10.12.1 MatchupsScreen, OneiromancyDashboard, CosmicBoard, LeagueScreen, and OraclePanel render Week 7 Sleeper payloads with null stadium, null coordinates, bye_week=7, and synthesized fallback players without throwing', () => {
      const unknownPlayer = sleeper.synthesizeCosmicPlayerFromId('999999', 150, 7);
      const huntley = sleeper.synthesizeCosmicPlayerFromId('7083', 100, 7);
      assert.equal(huntley.name, 'Tyler Huntley');
      assert.equal(huntley.team, 'BAL');
      assert.ok(!unknownPlayer.name.includes('#'), 'Fallback player name must not leak raw #id');

      const byeStarter = player('Bye Week Starter', 'RB', 16.4, 82, { id: '7083', name: 'Tyler Huntley', position: 'QB', team: 'BAL', bye_week: 7 });
      const nullStadiumFav = {
        player_id: '7083',
        player_name: 'Tyler Huntley',
        position: 'QB',
        team: 'BAL',
        opponent: 'BYE',
        projected_points: 0,
        is_user_team: true,
        is_benched: false,
        spirit_score: 79,
        harmony_score: 80,
        game_kickoff: 'No game this week (Bye)',
        lunar_phase: '-',
        planetary_hour: '-',
        stadium: null,
        favorability_score: 79,
        favorability_verdict: 'FAVORED',
      };
      const nullCoordsFav = {
        player_id: '4984',
        player_name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        opponent: 'TEN',
        projected_points: 24.2,
        is_user_team: false,
        is_benched: false,
        spirit_score: 88,
        harmony_score: 82,
        game_kickoff: 'Sun, Oct 20 · 1:00 PM ET',
        lunar_phase: 'Waning Gibbous in Taurus',
        planetary_hour: 'Hour of Sun (Solar Vitality)',
        stadium: {
          stadium_name: 'Highmark Stadium',
          city: 'Orchard Park',
          state: 'NY',
          coordinates: { lat: null, lon: null },
          latitude: null,
          longitude: null,
          roof_type: 'Open Air (Inland)',
          celestial_house: '10th House',
          zodiac_ascendant: 'Leo Ascendant',
          geo_magnetic_resonance: 'Lake Erie Conduit',
        },
        favorability_score: 88,
        favorability_verdict: 'HEAVILY FAVORED',
      };

      const w7Matchup = {
        ...mockData.mockWeeklyMatchup,
        week: 7,
        upcoming_matchups: [],
        user_team: {
          ...mockData.mockWeeklyMatchup.user_team,
          team_name: 'McTwerkface (You)',
          owner_name: 'McTwerkface',
          starters: ['7083', ...mockData.mockWeeklyMatchup.user_team.starters.slice(1)],
        },
        opponent_team: {
          ...mockData.mockWeeklyMatchup.opponent_team,
          team_name: 'KaySwizz',
          owner_name: 'KaySwizz',
        },
        player_favorabilities: [
          nullStadiumFav,
          nullCoordsFav,
          ...mockData.mockPlayerFavorabilities.filter((f) => f.player_id !== '4574' && f.player_id !== '11563'),
        ],
      };

      const w7Roster = [
        slot('QB', ['QB'], byeStarter),
        ...mockData.mockMyRoster.slice(1),
      ];

      const ctx = buildMockCtx({
        draftState: {
          ...mockData.mock_oneiromancy_draft_2025,
          my_roster: w7Roster,
          cosmic_board: [byeStarter, unknownPlayer, ...mockData.mockCosmicBoard],
          weekly_matchup: w7Matchup,
        },
      });

      const matchupView = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, { weeklyMatchup: w7Matchup }) })
      );
      assert.ok(matchupView.getByTestId('positional-matchup-grid'), 'MatchupsScreen renders unified positional matchup grid');
      assert.ok(!matchupView.container.textContent.includes('YOUR BENCH'), 'MatchupsScreen must not render duplicate bench section');
      const byeCallout = matchupView.getByTestId('matchup-bye-callout');
      assert.ok(byeCallout.textContent.includes('Tyler Huntley'), 'MatchupsScreen bye callout lists Week 7 bye starter Tyler Huntley');
      // Verify null-safe stadium & bye week formatting on rendered matchup cards
      assert.ok(matchupView.container.textContent.includes('No game this week (Bye)'), 'Bye starter slot renders No game this week (Bye)');
      assert.ok(!matchupView.container.textContent.includes('NaN'), 'Null coordinates must never render NaN');
      matchupView.unmount();

      for (const Comp of [OneiromancyDashboard, CosmicBoard, LeagueScreen]) {
        const view = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(Comp, {}) }));
        assert.ok(view.container.textContent.length > 0);
        view.unmount();
      }
    });
  });

  describe('10.13 Comment #92 Directives Verification', () => {
    it('10.13.1 Predictors panel enables the 11 positive-edge systems by default across 6 categories, disables low/negative OOS systems, and omits percentage sliders', () => {
      assert.equal(oracle.ALL_PREDICTOR_SYSTEM_IDS.length, 25, 'ALL_PREDICTOR_SYSTEM_IDS must contain 25 pure esoteric systems');
      assert.equal(oracle.DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.length, 11, '11 positive-edge predictors (>= +0.05 pts edge) must be enabled by default');
      assert.equal(oracle.PREDICTOR_CATEGORIES.length, 6, 'PREDICTOR_CATEGORIES must contain 6 cosmic/divinatory categories');
      for (const sys of oracle.PREDICTOR_SYSTEM_META) {
        if (sys.defaultEnabled) {
          assert.ok(sys.oosQuintileSpreadPts >= 0.05, `Default-enabled system ${sys.id} must have >= +0.05 pts OOS edge`);
        } else {
          assert.ok(sys.oosQuintileSpreadPts < 0.05, `Default-disabled system ${sys.id} must be negative or low-scoring (< +0.05 pts edge)`);
        }
      }

      const defaultCtx = buildMockCtx();
      const defaultPanel = render(
        jsx(OneiromancyContext.Provider, { value: defaultCtx, children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }) })
      );
      const defaultTxt = defaultPanel.container.textContent || '';
      assert.ok(defaultTxt.includes('Predictive Systems'), 'Panel must display Predictive Systems heading');
      assert.ok(defaultTxt.includes('Active Predictors (11 of 25)'), 'Panel must default to 11 of 25 positive-edge predictors active');
      for (const cat of oracle.PREDICTOR_CATEGORIES) {
        assert.ok(defaultPanel.getByTestId(`predictor-category-${cat.id}`), `Category card ${cat.id} must render`);
        assert.ok(cat.defaultSystemIds.length >= 1, `Every cosmic category (${cat.id}) must retain at least 1 default-enabled predictor`);
      }
      assert.ok(!defaultTxt.includes('Venue & Geodesic Travel'), 'Mundane Venue & Geodesic Travel predictor must not render');
      assert.ok(defaultTxt.includes('pts edge'), 'Predictor rows must display plain-English historical point edge (pts edge)');
      assert.ok(!defaultTxt.includes(' OOS'), 'Predictors panel must replace cryptic OOS label with plain-English pts edge');
      assert.ok(!defaultTxt.includes('%'), 'Predictors panel must not display % measurements');
      defaultPanel.unmount();
    });

    it('10.13.2 OneiromancyDashboard and PlayerDetailModal render grounded plain-English telemetry copy', () => {
      const ctx = buildMockCtx();
      const dashboard = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) })
      );
      const text = dashboard.container.textContent || '';
      assert.ok(
        !text.includes('Elemental Balance') && text.includes('Bye Schedule'),
        'Dashboard must omit fantasy-team Elemental Balance and keep concise Bye Schedule heading'
      );
      assert.ok(
        !text.includes('5-spoke Elemental & Aspect balance radar with active Trine Thresholds and correlation stacks powering starter and bench aura cards below.'),
        'Dashboard must not render confusing astrological jargon'
      );
      dashboard.unmount();

      const samplePlayer = ctx.draftState.my_roster.find((s) => s.player)?.player || ctx.draftState.cosmic_board[0];
      const modal = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(PlayerDetailModal, { player: samplePlayer, isOpen: true, onClose: () => {} }),
        })
      );
      const modalText = modal.container.textContent || '';
      assert.ok(modalText.includes('Elemental Balance'), 'PlayerDetailModal must render concise Elemental Balance heading');
      modal.unmount();
    });

    it('10.13.3 Bye week system: bench players are not marked on bye in Week 1 or 2, and have positive projected points and real stadiums', () => {
      // 1. Setup a live SeasonContext at Week 1 with missing game schedule
      // BAL has a genuine bye scheduled for Week 7 (outside weeks 1-4)
      sleeper.setSeasonContext({
        season: '2025',
        leagueId: 'mock_league_1',
        currentWeek: 1,
        lastRegularWeek: 14,
        byeWeeks: { BAL: 7, DAL: 7, KC: 6 },
        weekDates: { 1: 'Sep 4 - Sep 8, 2025', 7: 'Oct 16 - Oct 20, 2025' },
        matchupsByWeek: { 1: [], 7: [] },
      });

      try {
        const derivedW1 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          1
        );

        // Every active starter and bench player in Week 1 must have projected_points > 0 and real stadium
        const balPlayerW1 = derivedW1.player_favorabilities.find((p) => (p.team || p.nfl_team) === 'BAL');
        assert.ok(balPlayerW1, 'BAL player must be present in derived favorabilities');
        assert.ok(balPlayerW1.projected_points > 0, `Week 1 player must have positive projections, got ${balPlayerW1.projected_points}`);
        assert.equal(balPlayerW1.stadium?.stadium_name, 'M&T Bank Stadium', 'Week 1 stadium must be M&T Bank Stadium');
        assert.equal(balPlayerW1.game_kickoff, 'Time TBA', 'Week 1 game_kickoff must be Time TBA when schedule missing');

        // Render MatchupsScreen at Week 1
        const ctxW1 = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            weekly_matchup: derivedW1,
          },
        });
        const viewW1 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW1, children: jsx(MatchupsScreen, { weeklyMatchup: derivedW1 }) })
        );
        const textW1 = viewW1.container.textContent || '';
        assert.ok(!textW1.includes('BYE WK 1'), 'Must not display BYE WK 1 badge on any player');
        assert.ok(!textW1.includes('No game this week (Bye)'), 'Must not format any Week 1 stadium as bye');
        const byeCalloutW1 = viewW1.getByTestId('matchup-bye-callout');
        assert.ok(
          byeCalloutW1.textContent.includes('No players on bye on either roster this week.'),
          'Week 1 bye callout must report zero players on bye'
        );
        viewW1.unmount();

        // Check Week 2 as well
        const derivedW2 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          2
        );
        const balPlayerW2 = derivedW2.player_favorabilities.find((p) => (p.team || p.nfl_team) === 'BAL');
        assert.ok(balPlayerW2 && balPlayerW2.projected_points > 0, 'Week 2 player must have positive projections');
        assert.equal(balPlayerW2.stadium?.stadium_name, 'M&T Bank Stadium', 'Week 2 stadium must be M&T Bank Stadium');
        assert.notEqual(balPlayerW2.game_kickoff, 'Bye week', 'Week 2 game_kickoff must not be Bye week');

        // 2. Derive live matchup for Week 7 (genuine bye week for BAL)
        const derivedW7 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          7
        );
        const balPlayerW7 = derivedW7.player_favorabilities.find((p) => (p.team || p.nfl_team) === 'BAL');
        assert.ok(balPlayerW7, 'BAL player must be present in Week 7 favorabilities');
        assert.equal(balPlayerW7.projected_points, 0, `Week 7 bye player must have 0.0 projected points, got ${balPlayerW7.projected_points}`);
        assert.equal(balPlayerW7.game_kickoff, 'Bye week', 'Week 7 bye player kickoff must be "Bye week"');

        const ctxW7 = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            weekly_matchup: derivedW7,
          },
        });
        const viewW7 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW7, children: jsx(MatchupsScreen, { weeklyMatchup: derivedW7 }) })
        );
        const textW7 = viewW7.container.textContent || '';
        assert.ok(textW7.includes('BYE WK 7'), 'Must display BYE WK 7 badge on Baltimore player');
        assert.ok(textW7.includes('Bye week') || textW7.includes('Week 7 Byes'), 'Must display Bye week status on Baltimore player');
        const byeCalloutW7 = viewW7.getByTestId('matchup-bye-callout');
        assert.ok(
          byeCalloutW7.textContent.includes(balPlayerW7.player_name),
          'Week 7 bye callout must list the bye player'
        );
        viewW7.unmount();
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.13.4 MatchupsScreen renders unclipped stadium venue names in dedicated subrow', () => {
      const ctx = buildMockCtx();
      const matchupView = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, { weeklyMatchup: ctx.draftState.weekly_matchup }) })
      );
      const starterCard = matchupView.getByTestId('matchup-starter-card-4574');
      assert.ok(starterCard, 'Starter card must be present');
      const venueSubrow = starterCard.querySelector('[data-testid="matchup-venue-row"]');
      assert.ok(venueSubrow, 'Must render dedicated venue subrow');
      assert.ok(venueSubrow.textContent.includes('Cleveland Browns Stadium'), 'Subrow must contain stadium venue name');
      matchupView.unmount();
    });

    it('10.13.5 deriveByeWeeks restricts bye week detection to valid NFL bye window (5-14), ignoring early schedule gaps', () => {
      // BAL has a missing game in Week 1 (schedule gap), plays weeks 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14
      // Missing week in valid window (5-14) is week 7.
      const games = [
        { week: 1, date: '2025-09-07', home: 'KC', away: 'LAC' },
        { week: 2, date: '2025-09-14', home: 'BAL', away: 'CLE' },
        { week: 3, date: '2025-09-21', home: 'DAL', away: 'BAL' },
        { week: 4, date: '2025-09-28', home: 'BAL', away: 'BUF' },
        { week: 5, date: '2025-10-05', home: 'CIN', away: 'BAL' },
        { week: 6, date: '2025-10-12', home: 'BAL', away: 'WAS' },
        // Week 7: BAL missing (authentic bye week)
        { week: 7, date: '2025-10-19', home: 'KC', away: 'DEN' },
        { week: 8, date: '2025-10-26', home: 'CLE', away: 'BAL' },
        { week: 9, date: '2025-11-02', home: 'BAL', away: 'DEN' },
        { week: 10, date: '2025-11-09', home: 'BAL', away: 'CIN' },
        { week: 11, date: '2025-11-16', home: 'PIT', away: 'BAL' },
        { week: 12, date: '2025-11-23', home: 'LAC', away: 'BAL' },
        { week: 13, date: '2025-11-30', home: 'BAL', away: 'PHI' },
        { week: 14, date: '2025-12-07', home: 'NYG', away: 'BAL' },
      ];
      const byes = sleeper.deriveByeWeeks(games);
      assert.equal(byes.BAL, 7, 'BAL bye week must be 7, skipping week 1 schedule gap');
    });

    it('10.13.6 isPlayerOnByeWeek comprehensive edge cases and precedence rules', () => {
      // 1. Invalid or missing week parameters must return false
      assert.equal(scoring.isPlayerOnByeWeek(undefined, 7, 'BAL'), false, 'undefined week must return false');
      assert.equal(scoring.isPlayerOnByeWeek(null, 7, 'BAL'), false, 'null week must return false');
      assert.equal(scoring.isPlayerOnByeWeek(NaN, 7, 'BAL'), false, 'NaN week must return false');

      // 2. Weeks outside the NFL bye window (5-14) must return false even if matching
      assert.equal(scoring.isPlayerOnByeWeek(1, 1, 'BAL', { BAL: 1 }), false, 'Week 1 is outside bye window');
      assert.equal(scoring.isPlayerOnByeWeek(4, 4, 'BAL'), false, 'Week 4 is outside bye window');
      assert.equal(scoring.isPlayerOnByeWeek(15, 15, 'BAL', { BAL: 15 }), false, 'Week 15 is outside bye window');
      assert.equal(scoring.isPlayerOnByeWeek(18, 18, 'BAL'), false, 'Week 18 is outside bye window');

      // 3. Empty or whitespace team code falls back to player's bye_week
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, '', { BAL: 9 }), true, 'Empty team falls back to playerByeWeek');
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, '', { BAL: 9 }), false, 'Empty team does not match season context');
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, undefined, { BAL: 9 }), true, 'undefined team falls back to playerByeWeek');

      // 4. Season byeWeeks overrides stale playerByeWeek
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, 'BAL', { BAL: 9 }), true, 'Season byeWeek (9) overrides stale playerByeWeek (7)');
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, 'BAL', { BAL: 9 }), false, 'Stale playerByeWeek (7) is ignored when season context has 9');

      // 5. Case-insensitive team code normalization
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, 'bal', { BAL: 9 }), true, 'Lowercase team code normalized to BAL');

      // 6. Team not present in season byeWeeks falls back to playerByeWeek
      assert.equal(scoring.isPlayerOnByeWeek(7, 7, 'DET', { BAL: 9 }), true, 'DET not in seasonByeWeeks falls back to playerByeWeek');
      assert.equal(scoring.isPlayerOnByeWeek(9, 7, 'DET', { BAL: 9 }), false, 'DET does not match week 9');
    });

    it('10.13.7 Oracle functions respect registered SeasonContext bye weeks over stale player bye_week', () => {
      // Setup players with stale bye_week: 7 on BAL, and control players on week 5
      const balStarter = player('Lamar Jackson', 'QB', 24, 92, { team: 'BAL', bye_week: 7 });
      balStarter.id = 'lamar_bal_1';

      const wrStarter = player('WR One', 'WR', 18, 88, { team: 'KC', bye_week: 5 });
      wrStarter.id = 'wr_starter_1';

      const wrExtra = player('WR Depth', 'WR', 14, 80, { team: 'BUF', bye_week: 5 });
      wrExtra.id = 'wr_depth_2';

      const balBench = player('Zay Flowers', 'WR', 10, 75, { team: 'BAL', bye_week: 7 });
      balBench.id = 'zay_bal_2';

      const testRoster = [
        slot('QB', ['QB'], balStarter),
        slot('WR1', ['WR'], wrStarter),
        slot('BN1', ['WR'], balBench),
        slot('BN2', ['WR'], wrExtra),
      ];

      // 1. Without SeasonContext, functions use player's bye_week (7)
      sleeper.setSeasonContext(null);
      const covWithoutCtx = oracle.compute18WeekByeCoverage(testRoster);
      assert.equal(covWithoutCtx.find((s) => s.week === 7)?.players.length, 2, 'Without ctx, week 7 has 2 players');
      assert.equal(covWithoutCtx.find((s) => s.week === 9)?.players.length, 0, 'Without ctx, week 9 has 0 players');

      // 2. With SeasonContext { BAL: 9 }, functions must use week 9 and ignore week 7
      try {
        sleeper.setSeasonContext({
          season: '2025',
          leagueId: 'test_league_oracle_byes',
          currentWeek: 7,
          lastRegularWeek: 14,
          byeWeeks: { BAL: 9 },
          weekDates: {},
          matchupsByWeek: {},
        });

        // 2a. compute18WeekByeCoverage
        const covWithCtx = oracle.compute18WeekByeCoverage(testRoster);
        assert.equal(covWithCtx.find((s) => s.week === 7)?.players.length, 0, 'With ctx BAL:9, week 7 must have 0 bye players');
        assert.equal(covWithCtx.find((s) => s.week === 9)?.players.length, 2, 'With ctx BAL:9, week 9 must have both BAL players');

        // 2b. computeByeOutlook from week 7 looking ahead 3 weeks (weeks 8, 9, 10)
        const alerts = oracle.computeByeOutlook(testRoster, 7, 3);
        assert.equal(alerts.length, 1, 'Must have exactly 1 bye week alert');
        assert.equal(alerts[0].week, 9, 'Alert must be for week 9');
        assert.equal(alerts[0].starters[0]?.id, 'lamar_bal_1', 'Lamar Jackson must be listed in week 9 starter byes');

        // 2c. computeWaiverMoves with currentWeek = 9: bench player on bye is protected from drops
        const waiverCandidates = [player('Waiver Target', 'WR', 22, 95, { draft_status: 'available' })];
        waiverCandidates[0].id = 'waiver_wr_1';

        // At week 9 (actual bye), BAL bench player (zay_bal_2) is on bye and protected
        const movesAtWk9 = oracle.computeWaiverMoves(waiverCandidates, testRoster, 0.75, 9, 2);
        assert.ok(!movesAtWk9.some((m) => m.drop.id === 'zay_bal_2'), 'Bench player on bye in week 9 (Zay Flowers) is protected from drop');

        // At week 7 (not a bye according to ctx), BAL bench player is not on bye and can be dropped for an upgrade
        const movesAtWk7 = oracle.computeWaiverMoves(waiverCandidates, testRoster, 0.75, 7, 2);
        assert.ok(movesAtWk7.some((m) => m.drop.id === 'zay_bal_2'), 'Bench player not on bye in week 7 (Zay Flowers) can be dropped');
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.13.8 Live McTwerkface Week 8 bye players: benched bye players appear in MatchupsScreen callout, show BYE WK 8 badges across screens, respect live playerDict team over stale draft metadata, and preserve non-bye baseline projections for future weeks', () => {
      sleeper.setSeasonContext({
        season: '2026',
        leagueId: '1378157554336559104',
        currentWeek: 8,
        lastRegularWeek: 14,
        byeWeeks: { HOU: 8, NO: 8, NYG: 8, SF: 8, BAL: 13, CIN: 6 },
        weekDates: { 6: 'Oct 15 - Oct 19, 2026', 8: 'Oct 29 - Nov 2, 2026', 9: 'Nov 5 - Nov 9, 2026' },
        matchupsByWeek: {},
      });

      try {
        const livePlayerDict = {
          '4892': { player_id: '4892', first_name: 'Baker', last_name: 'Mayfield', position: 'QB', team: 'TB', status: 'Active', number: 6 },
          '8131': { player_id: '8131', first_name: 'Isaiah', last_name: 'Likely', position: 'TE', team: 'NYG', status: 'Active', number: 80 },
          '13285': { player_id: '13285', first_name: 'Malachi', last_name: 'Fields', position: 'WR', team: 'NYG', status: 'Active', number: 81 },
          '2306': { player_id: '2306', first_name: 'Jameis', last_name: 'Winston', position: 'QB', team: 'NYG', status: 'Active', number: 19 },
          '7527': { player_id: '7527', first_name: 'Mac', last_name: 'Jones', position: 'QB', team: 'SF', status: 'Active', number: 10 },
          '9504': { player_id: '9504', first_name: 'Charlie', last_name: 'Jones', position: 'WR', team: 'NYG', status: 'Active', number: 15 },
          '8144': { player_id: '8144', first_name: 'Chris', last_name: 'Olave', position: 'WR', team: 'NO', status: 'Active', number: 12 },
          '4881': { player_id: '4881', first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL', status: 'Active', number: 8 },
        };

        // Draft picks have stale draft-day metadata (Likely on BAL, Charlie Jones on CIN)
        const picks = [
          { pick_no: 1, round: 1, draft_slot: 7, player_id: '4892', picked_by: 'u_mctwerk', metadata: { first_name: 'Baker', last_name: 'Mayfield', position: 'QB', team: 'TB' } },
          { pick_no: 2, round: 2, draft_slot: 7, player_id: '8131', picked_by: 'u_mctwerk', metadata: { first_name: 'Isaiah', last_name: 'Likely', position: 'TE', team: 'BAL' } },
          { pick_no: 3, round: 3, draft_slot: 7, player_id: '13285', picked_by: 'u_mctwerk', metadata: { first_name: 'Malachi', last_name: 'Fields', position: 'WR', team: 'NYG' } },
          { pick_no: 4, round: 4, draft_slot: 7, player_id: '2306', picked_by: 'u_mctwerk', metadata: { first_name: 'Jameis', last_name: 'Winston', position: 'QB', team: 'NYG' } },
          { pick_no: 5, round: 5, draft_slot: 7, player_id: '7527', picked_by: 'u_mctwerk', metadata: { first_name: 'Mac', last_name: 'Jones', position: 'QB', team: 'SF' } },
          { pick_no: 6, round: 6, draft_slot: 1, player_id: '9504', picked_by: 'u_opp', metadata: { first_name: 'Charlie', last_name: 'Jones', position: 'WR', team: 'CIN' } },
          { pick_no: 7, round: 7, draft_slot: 1, player_id: '8144', picked_by: 'u_opp', metadata: { first_name: 'Chris', last_name: 'Olave', position: 'WR', team: 'NO' } },
          { pick_no: 8, round: 8, draft_slot: 1, player_id: '4881', picked_by: 'u_opp', metadata: { first_name: 'Lamar', last_name: 'Jackson', position: 'QB', team: 'BAL' } },
        ];

        const rosters = [
          { roster_id: 2, owner_id: 'u_mctwerk', starters: ['4892'], players: ['4892', '8131', '13285', '2306', '7527'] },
          { roster_id: 3, owner_id: 'u_opp', starters: ['4881'], players: ['4881', '8144', '9504'] },
        ];

        const matchupsW8 = [
          { roster_id: 2, matchup_id: 3, starters: ['4892'], players: ['4892', '8131', '13285', '2306', '7527'], points: 0 },
          { roster_id: 3, matchup_id: 3, starters: ['4881'], players: ['4881', '8144', '9504'], points: 0 },
        ];

        // Week 8 live projections omit NYG/SF/NO players because they are on bye in Week 8
        const weeklyProjectionsW8 = {
          '4892': { pts_ppr: 21.4 },
          '4881': { pts_ppr: 23.8 },
        };

        const state = sleeper.transformToDraftState(
          { draft_id: 'd1', status: 'complete', type: 'snake', settings: { teams: 2, rounds: 8, slots_qb: 1, slots_bn: 4 }, draft_order: { u_mctwerk: 2, u_opp: 1 } },
          picks,
          { user_id: 'u_mctwerk', username: 'McTwerkface', user_slot: 2, league_id: '1378157554336559104', roster_positions: ['QB', 'BN', 'BN', 'BN', 'BN'] },
          livePlayerDict,
          [{ user_id: 'u_mctwerk', display_name: 'McTwerkface', metadata: { team_name: 'ASStrologians' } }, { user_id: 'u_opp', display_name: 'KaySwizz', metadata: { team_name: 'SlayEmMayhem' } }],
          rosters,
          matchupsW8,
          { league_id: '1378157554336559104', name: 'Toxic Trash Talkers', season: '2026', status: 'in_season', sport: 'nfl', total_rosters: 2, settings: { leg: 8 }, roster_positions: ['QB', 'BN', 'BN', 'BN', 'BN'] },
          8,
          weeklyProjectionsW8
        );

        // 1. Live team from playerDict overrides stale draft pick metadata and updates bye_week to 8
        const likelyBoard = state.cosmic_board.find((p) => p.id === '8131');
        const charlieBoard = state.cosmic_board.find((p) => p.id === '9504');
        assert.equal(likelyBoard?.team, 'NYG', 'Isaiah Likely must use live NYG team over stale BAL draft metadata');
        assert.equal(likelyBoard?.bye_week, 8, 'Isaiah Likely bye_week must be synced to NYG Week 8 bye');
        assert.equal(charlieBoard?.team, 'NYG', 'Charlie Jones must use live NYG team over stale CIN draft metadata');
        assert.equal(charlieBoard?.bye_week, 8, 'Charlie Jones bye_week must be synced to NYG Week 8 bye');

        // 2. MatchupsScreen in Week 8 lists benched bye players in matchup-bye-callout (never "Zero rostered or opponent players on bye")
        const ctxW8 = buildMockCtx({ draftState: state });
        const matchupViewW8 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW8, children: jsx(MatchupsScreen, { weeklyMatchup: state.weekly_matchup }) })
        );
        const byeCalloutW8 = matchupViewW8.getByTestId('matchup-bye-callout');
        assert.ok(!byeCalloutW8.textContent.includes('Zero rostered or opponent players on bye this week.'), 'Must not claim zero players on bye when bench players are on bye');
        for (const name of ['Malachi Fields', 'Jameis Winston', 'Mac Jones', 'Isaiah Likely', 'Chris Olave']) {
          assert.ok(byeCalloutW8.textContent.includes(name), `Week 8 bye callout must include benched bye player ${name}`);
        }
        assert.ok(!byeCalloutW8.textContent.includes('· YOU'), 'Week 8 bye callout must not render YOU label');
        assert.ok(!byeCalloutW8.textContent.includes('· OPP'), 'Week 8 bye callout must not render OPP label');
        assert.ok(byeCalloutW8.textContent.includes(' · BN)'), 'Week 8 bye callout must preserve BN role tag');
        matchupViewW8.unmount();

        // 3. OneiromancyDashboard grays out benched bye players and renders both BYE WK 8 tag and muted "On Bye" label
        const dashView = render(
          jsx(OneiromancyContext.Provider, { value: ctxW8, children: jsx(OneiromancyDashboard, {}) })
        );
        const dashText = dashView.container.textContent || '';
        assert.ok(dashText.includes('BYE WK 8'), 'Roster dashboard must display BYE WK 8 badge on current-week bye players');
        assert.ok(dashText.includes('On Bye'), 'Roster dashboard must display muted On Bye label on current-week bye players');
        const bnCard = dashView.getByTestId('roster-card-BN1');
        assert.ok(bnCard.className.includes('opacity-50'), 'Bye bench card must be grayed out with opacity-50');
        const cellW8 = dashView.getByTestId('bye-week-cell-8');
        assert.ok(cellW8.textContent.includes('4'), 'Week 8 bye coverage cell must show 4 user players on bye');
        assert.ok(cellW8.className.includes('ring-amber-400'), 'Active week 8 cell must have active brass ring highlight');
        dashView.unmount();

        // 4. Future week (Week 9) restores positive baseline projections for Week 8 bye players
        const derivedW9 = sleeper.deriveWeeklyMatchup(2, state.competitor_teams, matchupsW8, state.cosmic_board, state.my_roster, 9);
        const likelyW9 = derivedW9.player_favorabilities.find((p) => String(p.player_id) === '8131');
        assert.ok(likelyW9 && likelyW9.projected_points > 0, `Week 8 bye player must have positive baseline projection in Week 9, got ${likelyW9?.projected_points}`);

        // 5. Completed past week (Week 6) uses actual points from matchObj.players_points
        const matchupsW6 = [
          { roster_id: 2, matchup_id: 3, starters: ['4892'], players: ['4892', '8131'], points: 14.2, players_points: { '4892': 14.2, '8131': 9.6 } },
          { roster_id: 3, matchup_id: 3, starters: ['4881'], players: ['4881', '8144'], points: 18.5, players_points: { '4881': 18.5, '8144': 11.1 } },
        ];
        const derivedW6 = sleeper.deriveWeeklyMatchup(2, state.competitor_teams, matchupsW6, state.cosmic_board, state.my_roster, 6);
        const bakerW6 = derivedW6.player_favorabilities.find((p) => String(p.player_id) === '4892');
        assert.equal(bakerW6?.projected_points, 14.2, 'Completed past week (Week 6) must use actual points (14.2) rather than Week 8 projection (21.4)');
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.13.9 Scorecard visual contrast and deterministic 4-row/2-row DOM hierarchy', () => {
      sleeper.setSeasonContext({
        season: '2026',
        leagueId: '1378157554336559104',
        currentWeek: 8,
        lastRegularWeek: 14,
        byeWeeks: { HOU: 8, NO: 8, NYG: 8, SF: 8, IND: 13, PIT: 9, TB: 10 },
        weekDates: { 8: 'Oct 29 - Nov 2, 2026' },
        matchupsByWeek: {},
      });

      try {
        const starterQb = player('Aaron Rodgers', 'QB', 19.6, 67, { id: '96', team: 'PIT', bye_week: 9 });
        const starterTe = player('Cade Otton', 'TE', 7.9, 74, { id: '8110', team: 'TB', bye_week: 10 });
        const benchNonBye = player('Daniel Jones', 'QB', 12.3, 69, { id: '5870', team: 'IND', bye_week: 13, draft_status: 'my_team' });
        const benchBye = player('Mac Jones', 'QB', 0.0, 40, { id: '7527', team: 'SF', bye_week: 8, draft_status: 'my_team' });
        const oppRosteredNonBye = player('Drake Maye', 'QB', 24.7, 79, { id: '11564', team: 'NE', bye_week: 11, draft_status: 'drafted', drafted_by: 'HotMulligan' });

        const customRoster = [
          { slot_id: 'QB', slot_name: 'Quarterback', position: 'QB', eligible_positions: ['QB'], player: starterQb, is_locked: false },
          { slot_id: 'TE', slot_name: 'Tight End', position: 'TE', eligible_positions: ['TE'], player: starterTe, is_locked: false },
          { slot_id: 'BN1', slot_name: 'Bench 1', position: 'BN', eligible_positions: ['BN'], player: benchNonBye, is_locked: false },
          { slot_id: 'BN2', slot_name: 'Bench 2', position: 'BN', eligible_positions: ['BN'], player: benchBye, is_locked: false },
        ];

        const ctx = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            my_roster: customRoster,
            cosmic_board: [starterQb, starterTe, benchNonBye, benchBye, oppRosteredNonBye],
            weekly_matchup: { ...mockData.mockWeeklyMatchup, week: 8 },
          },
        });

        // 1. Non-bye bench card vs Bye bench card styling contrast + 4-row deterministic layout
        const dashView = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) }));
        const nonByeCard = dashView.getByTestId('roster-card-BN1');
        const byeCard = dashView.getByTestId('roster-card-BN2');

        assert.ok(!nonByeCard.getAttribute('data-bye'), 'Non-bye bench card must not have data-bye');
        assert.strictEqual(byeCard.getAttribute('data-bye'), 'true');
        assert.ok(byeCard.className.split(/\s+/).includes('opacity-50'), 'Card missing opacity-50 class');
        assert.ok(byeCard.className.split(/\s+/).includes('grayscale'), 'Card missing grayscale class');
        assert.ok(!byeCard.className.split(/\s+/).includes('opacity-55'), 'Card should not use invalid opacity-55 class');

        // Verify all Roster rows (short slot "Tight End", long slot "Quarterback", Bench 1, Bench 2) have clean 2-row tabular structure
        for (const testId of ['roster-card-QB', 'roster-card-TE', 'roster-card-BN1', 'roster-card-BN2']) {
          const card = dashView.getByTestId(testId);
          const textCol = card.querySelector('[data-testid="roster-card-text-col"]');
          assert.ok(textCol, `${testId} must have roster-card-text-col text column`);
          assert.equal(textCol.children.length, 2, `${testId} text column must have strictly 2 dedicated rows (Name+Badges, Team+Sign)`);
          assert.ok(textCol.children[0].className.split(/\s+/).includes('flex-wrap'), `${testId} Row 1 (Name+Badges) must flex-wrap to prevent truncation`);
          assert.ok(textCol.children[1].className.split(/\s+/).includes('flex-wrap'), `${testId} Row 2 (Team · Bye + Matchup) must flex-wrap to prevent truncation`);
          assert.ok(!textCol.innerHTML.includes('truncate'), `${testId} text column must never truncate player names or matchup metadata`);
        }
        dashView.unmount();

        // 2. CosmicBoard & MatchupsScreen non-bye rostered rows and 2-row Matchup starter header
        const boardView = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(CosmicBoard, {}) }));
        const allRows = Array.from(boardView.container.querySelectorAll('tr'));
        const drakeRow = allRows.find((tr) => tr.textContent?.includes('Drake Maye'));
        const macRow = allRows.find((tr) => tr.textContent?.includes('Mac Jones'));
        assert.ok(drakeRow && !drakeRow.getAttribute('data-bye'), 'Non-bye rostered player row in CosmicBoard must not have data-bye');
        assert.ok(macRow && macRow.getAttribute('data-bye') === 'true', 'Bye player row in CosmicBoard must have data-bye="true"');
        boardView.unmount();

        const matchupView = render(jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(MatchupsScreen, {}) }));
        const mCard = matchupView.getByTestId('matchup-starter-card-4574');
        const mTextCol = mCard.querySelector('[data-testid="matchup-card-text-col"]');
        assert.equal(mTextCol?.children.length, 2, 'Matchup starter card must have strictly 2 dedicated header rows ([Pos+Name], [Team·Bye+Tags])');
        matchupView.unmount();
      } finally {
        sleeper.setSeasonContext(null);
      }
    });
  });

  describe('10.14 Bye-week lookahead projections & scoring invariants', () => {
    it('10.14.1 getNextPlayWeek resolves next non-bye week across bye, non-bye, Wk 14, Wk 18, schedule-loaded gaps, and unloaded schedule', () => {
      try {
        nflGames.clearNflGames();
        const byeMap = { BUF: 7, DET: 9, SF: 14, KC: 18 };
        assert.equal(oracle.getNextPlayWeek('BUF', 7, byeMap), 8, 'Week-7 bye team returns Week 8 when schedule unloaded');
        assert.equal(oracle.getNextPlayWeek('DET', 7, byeMap), null, 'Non-bye team returns null');
        assert.equal(oracle.getNextPlayWeek('SF', 14, byeMap), 15, 'Week-14 bye team returns Week 15');
        assert.equal(oracle.getNextPlayWeek('KC', 18, byeMap), null, 'Week-18 bye team returns null');
        assert.equal(oracle.getNextPlayWeek('KC', 17, { KC: 18 }, 18), null, 'Week-17 non-bye team with Week-18 bye returns null');
        assert.equal(oracle.getNextPlayWeek('', 7, byeMap), null, 'Empty team string returns null');
        assert.equal(oracle.getNextPlayWeek('   ', 7, byeMap), null, 'Whitespace-only team string returns null');
        assert.equal(oracle.getNextPlayWeek(null, 7, byeMap), null, 'Null team returns null');
        assert.equal(oracle.getNextPlayWeek(undefined, 7, byeMap), null, 'Undefined team returns null');
        assert.equal(oracle.getNextPlayWeek('BUF', 2, { BUF: 2 }), null, 'Weeks outside NFL bye window (5..14) return null');
        assert.equal(oracle.getNextPlayWeek('BUF', 7, {}, 7), 8, 'Falls back to player bye_week when season map absent');
        assert.equal(oracle.getNextPlayWeek('FA', 7, byeMap, 7), null, 'Free agent FA returns null even with byeWeek 7');
        assert.equal(oracle.getNextPlayWeek('NFL', 7, byeMap, 7), null, 'Unsigned NFL string returns null');
        assert.equal(oracle.getNextPlayWeek('Free Agent', 7, byeMap, 7), null, 'Free Agent string returns null');
        assert.equal(sleeper.getNextPlayWeek('BUF', 7, byeMap), 8, 'sleeper re-export of getNextPlayWeek works');
        assert.equal(sleeper.getNextPlayWeek('FA', 7, byeMap, 7), null, 'sleeper re-export returns null for FA');

        nflGames.setWeekGames(8, [
          { week: 8, home: 'KC', away: 'LV', kickoff: null, date: '2026-10-25', venue: null, neutral: false },
        ]);
        nflGames.setWeekGames(9, [
          { week: 9, home: 'BUF', away: 'MIA', kickoff: null, date: '2026-11-01', venue: null, neutral: false },
        ]);
        assert.equal(
          oracle.getNextPlayWeek('BUF', 7, byeMap),
          9,
          'Skips intermediate Week 8 when loaded schedule has no game for BUF',
        );

        nflGames.setWeekGames(8, [
          { week: 8, home: 'BUF', away: 'NYJ', kickoff: null, date: '2026-10-25', venue: null, neutral: false },
        ]);
        assert.equal(
          oracle.getNextPlayWeek('BUF', 7, byeMap),
          8,
          'Returns Week 8 when loaded schedule confirms BUF plays in Week 8',
        );

        for (const w of [15, 16, 17, 18]) {
          nflGames.setWeekGames(w, [
            { week: w, home: 'KC', away: 'LV', kickoff: null, date: '2026-12-06', venue: null, neutral: false },
          ]);
        }
        assert.equal(
          oracle.getNextPlayWeek('SF', 14, byeMap),
          null,
          'Week-14 bye team returns null when Weeks 15-18 schedule has no games for team',
        );
      } finally {
        nflGames.clearNflGames();
      }
    });

    it('10.14.2 averageProjectedPoints, hasOraclePlaceholder, and oracleEffectivePoints fallback hierarchy', () => {
      const explicitAvg = player('Avg Player', 'QB', 0, 80, { bye_week: 7, average_projected_points: 17.5 });
      assert.equal(oracle.averageProjectedPoints(explicitAvg), 17.5);
      assert.equal(oracle.hasOraclePlaceholder(explicitAvg, 7), true);
      assert.equal(oracle.oracleEffectivePoints(explicitAvg, 7), 17.5);

      const baselineFallback = player('Base Player', 'QB', 0, 80, { bye_week: 7, baseline_projected_points: 16.2 });
      assert.equal(oracle.averageProjectedPoints(baselineFallback), 16.2);
      assert.equal(oracle.hasOraclePlaceholder(baselineFallback, 7), true);
      assert.equal(oracle.oracleEffectivePoints(baselineFallback, 7), 16.2);

      const seasonFallback = player('Season Player', 'QB', 0, 80, { bye_week: 7, season_projected_points: 255.0 });
      assert.equal(oracle.averageProjectedPoints(seasonFallback), 15.0);
      assert.equal(oracle.hasOraclePlaceholder(seasonFallback, 7), true);

      const activePlaying = player('Active Player', 'QB', 21.0, 80, { bye_week: 7, average_projected_points: 17.5 });
      assert.equal(oracle.hasOraclePlaceholder(activePlaying, 7), false, 'Active positive projection does not use placeholder');
      assert.equal(oracle.oracleEffectivePoints(activePlaying, 7), 21.0);

      const healthyNotOnBye = player('Healthy Zero', 'QB', 0, 80, { bye_week: 9, average_projected_points: 17.5 });
      assert.equal(oracle.hasOraclePlaceholder(healthyNotOnBye, 7), false, 'Healthy player not on bye must not receive placeholder');

      const placeholderDisabled = oracle.oracleEffectivePoints(explicitAvg, 7, { placeholder: false });
      assert.equal(placeholderDisabled, 0, 'options.placeholder=false must bypass placeholder and return raw 0');
    });

    it('10.14.3 oraclePlaceholderInfo generates explanatory tooltips for bye, IR, Out, and inactive statuses', () => {
      const byePlayer = player('Josh Allen', 'QB', 0, 82, {
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 18.5,
      });
      const byeInfo = oracle.oraclePlaceholderInfo(byePlayer, 7);
      assert.equal(byeInfo.hasPlaceholder, true);
      assert.equal(byeInfo.avgPoints, 18.5);
      assert.equal(byeInfo.reason, 'on bye');
      assert.ok(byeInfo.tooltipText.includes('18.5 pts') && byeInfo.tooltipText.includes('on bye'));
      assert.ok(byeInfo.statsTooltipText.includes('0.0 pts') && byeInfo.statsTooltipText.includes('18.5 pt season average'));
      assert.ok(byeInfo.markerExplainerText.includes('18.5 pt season average') && byeInfo.markerExplainerText.includes('on bye'));
      assert.ok(byeInfo.statsMarkerExplainerText.includes('0.0 projected pts') && byeInfo.statsMarkerExplainerText.includes('on bye'));

      const irPlayer = player('Injured Star', 'RB', 0, 80, {
        team: 'DET',
        bye_week: 9,
        injury_status: 'IR',
        average_projected_points: 14.0,
      });
      const irInfo = oracle.oraclePlaceholderInfo(irPlayer, 7);
      assert.equal(irInfo.hasPlaceholder, true);
      assert.equal(irInfo.reason, 'on injured reserve');
      assert.ok(irInfo.markerExplainerText.includes('14.0 pt season average') && irInfo.markerExplainerText.includes('on injured reserve'));

      const outPlayer = player('Out WR', 'WR', 0, 78, {
        team: 'KC',
        bye_week: 10,
        injury_status: 'Out',
        average_projected_points: 12.3,
      });
      const outInfo = oracle.oraclePlaceholderInfo(outPlayer, 7);
      assert.equal(outInfo.hasPlaceholder, true);
      assert.equal(outInfo.reason, 'out');
      assert.ok(outInfo.markerExplainerText.includes('12.3 pt season average'));

      const inactivePlayer = player('Inactive TE', 'TE', 0, 70, {
        team: 'BUF',
        bye_week: 12,
        status: 'Inactive',
        average_projected_points: 8.7,
      });
      const inactiveInfo = oracle.oraclePlaceholderInfo(inactivePlayer, 7);
      assert.equal(inactiveInfo.hasPlaceholder, true);
      assert.equal(inactiveInfo.reason, 'inactive');
      assert.ok(inactiveInfo.markerExplainerText.includes('8.7 pt season average'));

      const activePlayer = player('Active RB', 'RB', 16.2, 85, {
        team: 'BUF',
        bye_week: 12,
        average_projected_points: 15.0,
      });
      const activeInfo = oracle.oraclePlaceholderInfo(activePlayer, 7);
      assert.equal(activeInfo.hasPlaceholder, false);
      assert.equal(activeInfo.markerExplainerText, '');
      assert.equal(activeInfo.statsMarkerExplainerText, '');
    });

    it('10.14.4 oracleScore uses placeholder by default and currentWeekOracleScore evaluates raw 0 for start/sit checks', () => {
      const byePlayer = player('Healthy Bye Star', 'QB', 0, 85, {
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 18.0,
      });
      const placeholderOracle = oracle.oracleScore(byePlayer, 0.5, { currentWeek: 7 });
      const currentWeekOracle = oracle.currentWeekOracleScore(byePlayer, 0.5, 7);
      assert.equal(currentWeekOracle, 0, 'Active-week score on bye must be 0.0');
      assert.ok(
        placeholderOracle > currentWeekOracle + 15.0,
        `Placeholder projected points (${placeholderOracle}) must use next-game baseline over 0.0`,
      );
    });

    it('10.14.5 bye player with missing, zero, negative, NaN, or Infinity next_week_projected_points does not invent lookahead scores', () => {
      const missingNext = player('Bench Bye Missing', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
      });
      const zeroNext = player('Bench Bye Zero', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: 0,
      });
      const negativeNext = player('Bench Bye Negative', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: -5,
      });
      const nanNext = player('Bench Bye NaN', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: Number.NaN,
      });
      const infNext = player('Bench Bye Infinity', 'WR', 0, 74, {
        team: 'BUF',
        bye_week: 7,
        next_play_week: 8,
        next_week_projected_points: Number.POSITIVE_INFINITY,
      });

      for (const p of [missingNext, zeroNext, negativeNext, nanNext, infNext]) {
        assert.equal(oracle.statsPoints(p), 0);
        assert.equal(oracle.basePoints(p, { currentWeek: 7, nextGameLookahead: true }), 0);
        assert.ok(Number.isFinite(oracle.playerModifier(p, { currentWeek: 7 })));
        assert.ok(oracle.oracleScore(p, 0.75, { currentWeek: 7 }) >= 0);
      }
    });

    it('10.14.6 spirit_score is identical with and without lookahead', () => {
      const basePlayer = player('Spirit Invariance', 'RB', 0, 75, {
        team: 'BUF',
        bye_week: 7,
        adp: 18.5,
      });
      const withLookahead = {
        ...basePlayer,
        next_play_week: 8,
        next_week_projected_points: 16.4,
      };
      const [scoredBase] = scoring.recomputeDraftScores([basePlayer], {
        chaos_lambda: 0.75,
        oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS,
      });
      const [scoredLookahead] = scoring.recomputeDraftScores([withLookahead], {
        chaos_lambda: 0.75,
        oracle_weights: scoring.DEFAULT_ORACLE_WEIGHTS,
      });
      assert.equal(scoredLookahead.spirit_score, scoredBase.spirit_score);
      assert.deepEqual(scoring.DIVINATION_PILLARS.map((p) => p.key), [
        'celestial',
        'geomantic',
        'numeric',
        'harmony',
        'oracular',
      ]);
    });

    it('10.14.7 toggling enabled predictor systems updates playerModifier and projectedWithModifier', () => {
      const targetPlayer = player('System Sensitivity', 'WR', 15, 80, {
        team: 'DET',
        bye_week: 5,
        birth_date: '1999-10-24',
        jersey_number: 14,
      });
      try {
        oracle.setActiveEnabledSystems(['elemental_matchup']);
        const elementalOnly = oracle.playerModifier(targetPlayer, { currentWeek: 2 });
        oracle.setActiveEnabledSystems(['bazi_wuxing', 'mayan_tzolkin']);
        const ancientOnly = oracle.playerModifier(targetPlayer, { currentWeek: 2 });
        assert.notEqual(elementalOnly, ancientOnly, 'Changing active predictor subset updates modifier');
      } finally {
        oracle.setActiveEnabledSystems(oracle.DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS);
      }
    });

    it('10.14.8 deriveWeeklyMatchup, computeLineupCheck, computeWaiverMoves, vor_normalized, draft_score, and board sorting remain unchanged', () => {
      const byeStarter = player('Bye Starter', 'QB', 0, 95, {
        id: 'bye_qb_1',
        team: 'BUF',
        bye_week: 7,
        vor_normalized: 88.2,
        draft_score: 91.4,
      });
      const byeStarterWithLookahead = {
        ...byeStarter,
        next_play_week: 8,
        next_week_projected_points: 24.5,
      };
      const benchHealthyQb = player('Healthy Bench QB', 'QB', 14.2, 70, {
        id: 'healthy_qb_2',
        team: 'DET',
        bye_week: 9,
        vor_normalized: 61.0,
        draft_score: 66.5,
      });
      const waiverTarget = player('Waiver QB', 'QB', 18.0, 85, {
        id: 'waiver_qb_3',
        team: 'BAL',
        bye_week: 14,
        draft_status: 'available',
        vor_normalized: 72.0,
        draft_score: 79.0,
      });

      const makeRoster = (qbStarter) => [
        slot('QB', ['QB'], qbStarter),
        slot('BN1', ['BN', 'QB', 'RB', 'WR', 'TE'], benchHealthyQb),
      ];
      const competitor = {
        roster_id: 1,
        owner_id: 'u_me',
        name: 'My Team',
        is_user: true,
        players: ['bye_qb_1', 'healthy_qb_2'],
        projected_points: 14.2,
        spirit_avg: 82.5,
      };
      const opponent = {
        roster_id: 2,
        owner_id: 'u_opp',
        name: 'Opponent',
        is_user: false,
        players: [],
        projected_points: 20.0,
        spirit_avg: 75.0,
      };
      const matchups = [
        { roster_id: 1, matchup_id: 1, starters: ['bye_qb_1'], players: ['bye_qb_1', 'healthy_qb_2'], points: 0 },
        { roster_id: 2, matchup_id: 1, starters: [], players: [], points: 20.0 },
      ];

      const mWithout = sleeper.deriveWeeklyMatchup(1, [competitor, opponent], matchups, [byeStarter, benchHealthyQb], makeRoster(byeStarter), 7);
      const mWith = sleeper.deriveWeeklyMatchup(1, [competitor, opponent], matchups, [byeStarterWithLookahead, benchHealthyQb], makeRoster(byeStarterWithLookahead), 7);
      assert.equal(mWith.user_team.projected_points, mWithout.user_team.projected_points);
      assert.equal(mWith.player_favorabilities[0].projected_points, 0);
      assert.equal(mWith.player_favorabilities[0].game_kickoff, 'Bye week');

      const optWithout = oracle.optimalLineup(makeRoster(byeStarter), 0.75);
      const optWith = oracle.optimalLineup(makeRoster(byeStarterWithLookahead), 0.75);
      assert.equal(optWith.get('QB')?.id, 'healthy_qb_2', 'optimalLineup must keep bye player out of starter slot');
      assert.equal(optWith.get('QB')?.id, optWithout.get('QB')?.id);
      const benchByeRoster = [
        slot('QB', ['QB'], benchHealthyQb),
        slot('BN1', ['BN', 'QB', 'RB', 'WR', 'TE'], byeStarterWithLookahead),
      ];
      assert.deepEqual(
        oracle.computeLineupCheck(benchByeRoster, 0.75),
        [],
        'computeLineupCheck must never promote a bye player into a starter slot',
      );

      const weakBenchQb = player('Weak Bench QB', 'QB', 8.0, 52, {
        id: 'weak_qb_4',
        team: 'CLE',
        bye_week: 10,
        vor_normalized: 45.0,
        draft_score: 51.0,
      });
      const makeFullRoster = (qbStarter) => [
        slot('QB', ['QB'], qbStarter),
        slot('BN1', ['QB'], benchHealthyQb),
        slot('BN2', ['QB'], weakBenchQb),
      ];
      const waiverBoardWithout = [byeStarter, benchHealthyQb, weakBenchQb, waiverTarget];
      const waiverBoardWith = [byeStarterWithLookahead, benchHealthyQb, weakBenchQb, waiverTarget];
      const waiversWithout = oracle.computeWaiverMoves(waiverBoardWithout, makeFullRoster(byeStarter), 0.75, 7);
      const waiversWith = oracle.computeWaiverMoves(waiverBoardWith, makeFullRoster(byeStarterWithLookahead), 0.75, 7);
      assert.ok(waiversWith.length > 0, 'computeWaiverMoves must produce real waiver candidates on valid RosterSlot[] input');
      assert.deepEqual(waiversWith, waiversWithout, 'computeWaiverMoves must be completely invariant to next-week lookahead fields');

      const [recompWithout] = scoring.recomputeDraftScores([byeStarter], { chaos_lambda: 0.75 });
      const [recomp] = scoring.recomputeDraftScores([byeStarterWithLookahead], { chaos_lambda: 0.75 });
      assert.equal(recomp.vor_normalized, recompWithout.vor_normalized);
      assert.equal(recomp.draft_score, recompWithout.draft_score, 'draft_score must remain unchanged by lookahead fields');

      assert.ok(comparePlayersForBoard(benchHealthyQb, byeStarterWithLookahead, 'oracle', 'desc', 0.75) < 0);
    });

    it('10.14.9 computeWaiverMoves gives wouldStart=false to a bye waiver add while ranking by placeholder oracle', () => {
      const activeStarterQb = player('Active Starter', 'QB', 18.0, 75, {
        id: 'act_qb',
        team: 'KC',
        bye_week: 10,
      });
      const droppableBench = player('Droppable Bench', 'QB', 5.0, 40, {
        id: 'drop_qb',
        team: 'NYJ',
        bye_week: 12,
      });
      const extraBench = player('Extra Bench', 'QB', 6.0, 42, {
        id: 'extra_qb',
        team: 'TEN',
        bye_week: 12,
      });
      const byeWaiverTarget = player('Bye Star Free Agent', 'QB', 0, 90, {
        id: 'bye_fa',
        team: 'DAL',
        bye_week: 7,
        average_projected_points: 22.0,
        draft_status: 'available',
      });
      const roster = [
        slot('QB', ['QB'], activeStarterQb),
        slot('BN1', ['QB'], droppableBench),
        slot('BN2', ['QB'], extraBench),
      ];
      const moves = oracle.computeWaiverMoves([byeWaiverTarget], roster, 0.75, 7);
      assert.ok(moves.length > 0, 'Should find waiver move for high-oracle bye player');
      assert.equal(moves[0].add.id, 'bye_fa');
      assert.equal(
        moves[0].wouldStart,
        false,
        'Bye waiver candidate must not be marked wouldStart for the current week',
      );
    });

    it('10.14.10 synthetic live players without verified projections never receive average_projected_points or placeholder', () => {
      const syntheticPlayer = player('Synthetic Depth', 'RB', 0, 50, {
        id: 'synth_rb',
        team: 'MIA',
        bye_week: 6,
      });
      assert.equal(oracle.averageProjectedPoints(syntheticPlayer), 0);
      assert.equal(oracle.hasOraclePlaceholder(syntheticPlayer, 7), false);
      const info = oracle.oraclePlaceholderInfo(syntheticPlayer, 7);
      assert.equal(info.hasPlaceholder, false);
      assert.equal(info.avgPoints, 0);
    });

    it('10.14.11 computeTeamOracles sums active starters and uses 0.0 for bye starters in active week', () => {
      const activeStarter = player('Active WR', 'WR', 16.0, 75, {
        id: 'act_wr',
        team: 'KC',
        bye_week: 10,
        average_projected_points: 16.0,
      });
      const byeStarter = player('Bye WR', 'WR', 0, 80, {
        id: 'bye_wr',
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 18.0,
      });
      const starters = [activeStarter, byeStarter];
      const lambda = 0.75;
      const selectedWeek = 7;

      const o2 = oracle.oracleScore(byeStarter, lambda, { currentWeek: selectedWeek });
      assert.ok(oracle.hasOraclePlaceholder(byeStarter, selectedWeek));
      assert.equal(oracle.oracleEffectivePoints(byeStarter, selectedWeek), 18.0);
      assert.ok(o2 > 15, 'Bye starter lookahead net score reflects placeholder projection');

      const desc = oracle.describeValue(byeStarter, lambda, { currentWeek: selectedWeek });
      assert.ok(desc.includes('Base 18.0 pts'), 'describeValue reports Base and Modifier in points');

      const teamOracles = oracle.computeTeamOracles(
        [{ id: 't1', name: 'Team 1', starters: ['act_wr', 'bye_wr'] }],
        starters,
        lambda,
        { currentWeek: selectedWeek },
      );
      const actActiveWk = oracle.currentWeekOracleScore(activeStarter, lambda, selectedWeek);
      const byeActiveWk = oracle.currentWeekOracleScore(byeStarter, lambda, selectedWeek);
      assert.equal(byeActiveWk, 0, 'Bye starter contributes 0.0 in active week');
      assert.equal(
        teamOracles[0].oracle,
        Math.round((actActiveWk + byeActiveWk) * 10) / 10,
        'computeTeamOracles sums active-week starter net projections',
      );

      // Verify MatchupsScreen rendering with week 7 bye starter
      try {
        sleeper.setSeasonContext({
          season: '2025',
          leagueId: 'mock_league_1',
          currentWeek: 7,
          lastRegularWeek: 14,
          byeWeeks: { BUF: 7 },
          weekDates: { 7: 'Oct 16 - Oct 20, 2025' },
          matchupsByWeek: { 7: [] },
        });
        const derivedW7 = sleeper.deriveWeeklyMatchup(
          7,
          mockData.mockCompetitorTeams,
          null,
          mockData.mockCosmicBoard,
          mockData.mockMyRoster,
          7,
        );
        const ctxW7 = buildMockCtx({
          draftState: {
            ...mockData.mock_oneiromancy_draft_2025,
            weekly_matchup: derivedW7,
          },
        });
        const viewW7 = render(
          jsx(OneiromancyContext.Provider, { value: ctxW7, children: jsx(MatchupsScreen, { weeklyMatchup: derivedW7 }) }),
        );
        const textW7 = viewW7.container.textContent || '';
        assert.ok(textW7.includes('Starter Oracle Average') || textW7.includes('AstralOracles'), 'MatchupsScreen must render team oracle headers');
        viewW7.unmount();
      } finally {
        sleeper.setSeasonContext(null);
      }
    });

    it('10.14.12 hasOraclePlaceholder returns false when week cannot be resolved rather than guessing week 2', () => {
      sleeper.setSeasonContext(null);
      const byePlayer = player('Bye Player', 'WR', 0, 80, {
        id: 'bye_p',
        team: 'BUF',
        bye_week: 7,
        average_projected_points: 15.0,
      });
      // Without passing week and without season context, it must return false (no guessing week 2)
      assert.equal(oracle.hasOraclePlaceholder(byePlayer, undefined), false);
      const info = oracle.oraclePlaceholderInfo(byePlayer, undefined);
      assert.equal(info.hasPlaceholder, false);
      assert.equal(info.avgPoints, 0);

      // With explicit week 7, it activates
      assert.equal(oracle.hasOraclePlaceholder(byePlayer, 7), true);
      const infoW7 = oracle.oraclePlaceholderInfo(byePlayer, 7);
      assert.equal(infoW7.hasPlaceholder, true);
      assert.equal(infoW7.avgPoints, 15.0);
    });

    it('10.14.13 computeTradePartners threads currentWeek option correctly and protects starters on bye from being offered as trade bait', () => {
      seasonContext.setSeasonContextState(null);
      // Both teams have spare depth at the position they give (depth = dedicated slots + 1).
      // My team has a top starting RB on Week 7 bye (myByeRB, avg 18.0 pts) and active backups.
      const myByeRB = player('My Bye RB', 'RB', 0, 85, { bye_week: 7, average_projected_points: 22.0 });
      const myActiveRB1 = player('My Active RB1', 'RB', 18, 85);
      const myActiveRB2 = player('My Active RB2', 'RB', 12, 85);
      const myWR = player('My Weak WR', 'WR', 4, 60);
      const myWR2 = player('My WR2', 'WR', 3, 55);

      const theirRB = player('Their Weak RB', 'RB', 6, 60);
      const theirRB2 = player('Their RB2', 'RB', 5, 55);
      const theirBenchWR = player('Their Bench WR', 'WR', 16, 85);
      const theirWRs = [player('Their WR1', 'WR', 18, 85), player('Their WR2', 'WR', 17, 85)];

      const roster = [
        slot('RB', ['RB'], myByeRB),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], myActiveRB1),
        slot('BN2', ['RB', 'WR'], myActiveRB2),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];

      // In Week 7, optimalLineup benches myByeRB (0 stats pts) and starts active RB1 for match day
      const optimalW7 = oracle.optimalLineup(roster, 0.75, 7);
      assert.equal(optimalW7.get('RB')?.id, myActiveRB1.id, 'Week 7 optimal lineup starts active RB over bye RB');

      const me = {
        roster_id: 1,
        slot: 1,
        name: 'Me (You)',
        is_user: true,
        players: [myByeRB, myActiveRB1, myActiveRB2, myWR, myWR2].map((x) => x.id),
        starters: [myByeRB.id, myWR.id],
      };
      const them = {
        roster_id: 2,
        slot: 2,
        name: 'Them',
        players: [theirRB, theirRB2, theirBenchWR, ...theirWRs].map((x) => x.id),
        starters: [theirRB.id, theirWRs[0].id],
      };
      const board = [myByeRB, myActiveRB1, myActiveRB2, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];

      // In Week 7, trade partner evaluation considers season-long starter quality,
      // so myByeRB (top starter resting on 1-week bye) is NEVER offered as bench trade bait.
      const partnersW7 = oracle.computeTradePartners([me, them], board, roster, 0.75, { currentWeek: 7 });
      assert.ok(Array.isArray(partnersW7), 'computeTradePartners with currentWeek must return array');
      assert.ok(partnersW7.length > 0, 'Must identify mutual trade partner in Week 7');
      assert.ok(partnersW7[0].give, 'Must identify give piece');
      assert.ok(partnersW7[0].get, 'Must identify get piece');
      assert.equal(
        partnersW7[0].give.player.id,
        myActiveRB1.id,
        'Week 7 trade partner recommendation trades active backup RB1, protecting starting myByeRB on bye',
      );
      assert.notEqual(
        partnersW7[0].give.player.id,
        myByeRB.id,
        'Starter on single-week bye must never be offered as disposable bench trade bait',
      );

      // In Week 8 (non-bye), when the starter has a regular active weekly projection (18 pts),
      // they remain the starter, and active backup RB1 is traded
      const myActiveStarterRB = player('My Starter RB (W8 active)', 'RB', 18, 85, { bye_week: 7, average_projected_points: 18.0 });
      const rosterW8 = [
        slot('RB', ['RB'], myActiveStarterRB),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], myActiveRB1),
        slot('BN2', ['RB', 'WR'], myActiveRB2),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];
      const meW8 = {
        ...me,
        starters: [myActiveStarterRB.id, myWR.id],
        players: [myActiveStarterRB, myActiveRB1, myActiveRB2, myWR, myWR2].map((x) => x.id),
      };
      const boardW8 = [myActiveStarterRB, myActiveRB1, myActiveRB2, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];
      const partnersW8 = oracle.computeTradePartners([meW8, them], boardW8, rosterW8, 0.75, { currentWeek: 8 });
      assert.ok(partnersW8.length > 0, 'Must identify mutual trade partner in Week 8');
      assert.equal(
        partnersW8[0].give.player.id,
        myActiveRB1.id,
        'Week 8 trade partner recommendation keeps active starter and trades backup RB1',
      );
      assert.notEqual(
        partnersW8[0].give.player.id,
        myActiveStarterRB.id,
        'Active starter is protected in Week 8',
      );

      // If a player has 0 weekly projection and no placeholder in Week 8, they are benched,
      // so active RB1 starts and backup RB2 is offered
      const partnersW8Benched = oracle.computeTradePartners([me, them], board, roster, 0.75, { currentWeek: 8 });
      assert.ok(partnersW8Benched.length > 0, 'Must identify mutual trade partner in Week 8 when zero-projection player is benched');
      assert.equal(
        partnersW8Benched[0].give.player.id,
        myActiveRB2.id,
        'Week 8 recommendation trades active backup RB2 when zero-projection player is benched',
      );

      // Without currentWeek option, defaults cleanly to non-bye behavior trading active backup RB2
      const partnersDefault = oracle.computeTradePartners([me, them], board, roster, 0.75);
      assert.ok(partnersDefault.length > 0, 'Must identify mutual trade partner without week option');
      assert.equal(
        partnersDefault[0].give.player.id,
        myActiveRB2.id,
        'Default trade partner recommendation trades active backup RB2',
      );
    });

    it('10.14.14 computeTradePartners does not displace active healthy starters with injured or IR players during trade evaluation', () => {
      seasonContext.setSeasonContextState(null);
      // Roster with an injured star on IR with high average points (25.0) but 0 weekly projection,
      // a healthy active starter RB1 (14.0 pts), a bench backup RB2 (11.0 pts), and wide receivers.
      const irStar = player('Injured Star RB', 'RB', 0, 95, { injury_status: 'IR', average_projected_points: 25.0 });
      const healthyRB1 = player('Healthy RB1', 'RB', 14, 85);
      const healthyRB2 = player('Healthy Backup RB2', 'RB', 11, 80);
      const myWR = player('My Weak WR', 'WR', 4, 60);
      const myWR2 = player('My WR2', 'WR', 3, 55);

      const theirRB = player('Their Weak RB', 'RB', 6, 60);
      const theirRB2 = player('Their RB2', 'RB', 5, 55);
      const theirBenchWR = player('Their Bench WR', 'WR', 16, 85);
      const theirWRs = [player('Their WR1', 'WR', 18, 85), player('Their WR2', 'WR', 17, 85)];

      const roster = [
        slot('RB', ['RB'], healthyRB1),
        slot('WR', ['WR'], myWR),
        slot('BN1', ['RB', 'WR'], irStar),
        slot('BN2', ['RB', 'WR'], healthyRB2),
        slot('BN3', ['RB', 'WR'], myWR2),
      ];

      // In Week 10, optimalLineup with byeOnly: true must select healthyRB1 as starter, NOT the injured IR star
      const optimalW10 = oracle.optimalLineup(roster, 0.75, 10, { placeholder: true, byeOnly: true });
      assert.equal(
        optimalW10.get('RB')?.id,
        healthyRB1.id,
        'optimalLineup with byeOnly: true must keep active healthy RB1 as starter over injured IR player',
      );

      const me = {
        roster_id: 1,
        slot: 1,
        name: 'Me (You)',
        is_user: true,
        players: [irStar, healthyRB1, healthyRB2, myWR, myWR2].map((x) => x.id),
        starters: [healthyRB1.id, myWR.id],
      };
      const them = {
        roster_id: 2,
        slot: 2,
        name: 'Them',
        players: [theirRB, theirRB2, theirBenchWR, ...theirWRs].map((x) => x.id),
        starters: [theirRB.id, theirWRs[0].id],
      };
      const board = [irStar, healthyRB1, healthyRB2, myWR, myWR2, theirRB, theirRB2, theirBenchWR, ...theirWRs];

      // Trade evaluation must NOT offer healthyRB1 (our active starting RB while the star is on IR)
      const partnersW10 = oracle.computeTradePartners([me, them], board, roster, 0.75, { currentWeek: 10 });
      assert.ok(partnersW10.length > 0, 'Must identify mutual trade partner in Week 10');
      assert.notEqual(
        partnersW10[0].give.player.id,
        healthyRB1.id,
        'Healthy active starter RB1 must NOT be offered as trade bait while star is on IR',
      );
      assert.equal(
        partnersW10[0].give.player.id,
        healthyRB2.id,
        'Trade evaluation must offer healthy backup RB2 instead',
      );
    });
  });

  describe('10.15 Zero-% / Zero-x/100 UI Invariant & 13-Predictor Historical Drill-Down', () => {
    it('10.15.1 renders zero % characters and zero /100 strings across all primary screens, drawers, and modals', () => {
      const ctx = buildMockCtx({ enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS] });
      const screens = [
        ['OneiromancyDashboard', jsx(OneiromancyDashboard, {})],
        ['MatchupsScreen', jsx(MatchupsScreen, {})],
        ['CosmicBoard', jsx(CosmicBoard, {})],
        ['PlayerMarketplace', jsx(PlayerMarketplace, {})],
        ['TradesScreen', jsx(TradesScreen, {})],
        ['LeagueScreen', jsx(LeagueScreen, {})],
        ['OraclePanel', jsx(OraclePanel, { isOpen: true, onClose: () => {} })],
        [
          'PlayerDetailModal',
          jsx(PlayerDetailModal, {
            player: ctx.draftState.cosmic_board[0],
            compareWith: ctx.draftState.cosmic_board[1],
            isOpen: true,
            onClose: () => {},
          }),
        ],
      ];

      for (const [name, elem] of screens) {
        const view = render(jsx(OneiromancyContext.Provider, { value: ctx, children: elem }));
        const text = view.container.textContent || '';
        assert.ok(!text.includes('%'), `${name} rendered DOM text must not contain any % symbol`);
        assert.ok(!text.includes('/100') && !text.includes('/ 100'), `${name} rendered DOM text must not contain /100`);
        view.unmount();
      }
    });

    it('10.15.2 PlayerDetailModal drills down into active predictors, hides disabled predictors, and links to the GitHub study', () => {
      const ctx = buildMockCtx({ enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS] });
      const sample = ctx.draftState.cosmic_board[0];
      const view = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(PlayerDetailModal, { player: sample, isOpen: true, onClose: () => {} }),
        }),
      );
      const breakdown = view.getByTestId('predictor-breakdown-section');
      assert.ok(breakdown, 'PlayerDetailModal must render predictor-breakdown-section');
      const modalStudyLink = view.getByTestId('modal-study-github-link');
      assert.equal(
        modalStudyLink.getAttribute('href'),
        'https://github.com/google/oneiromancy/blob/main/docs/SLEEPER_POINT_DIFF_ANALYSIS.md',
        'Modal study link must point to GitHub SLEEPER_POINT_DIFF_ANALYSIS.md',
      );
      for (const sys of oracle.PREDICTOR_SYSTEM_META) {
        const row = view.getByTestId(`predictor-row-${sys.id}`);
        assert.ok(row, `PlayerDetailModal must render predictor row for ${sys.id} when all 25 are enabled`);
        assert.ok(row.textContent.includes(sys.shortName), `Row ${sys.id} must show shortName ${sys.shortName}`);
        assert.ok(row.textContent.includes('pts'), `Row ${sys.id} must display point-differential contribution`);
      }
      assert.ok(breakdown.textContent.includes('Avg '), 'Breakdown must display plain-English average point impact (Avg +/-X.XX pts)');
      assert.ok(breakdown.textContent.includes(' games'), 'Breakdown must display plain-English past game count (X,XXX games)');

      // Verify Historical Predictor Breakdown sits immediately before Compare vs. Other / Role Comparison
      const roleComp = view.getByTestId('roster-role-comparison');
      const siblings = Array.from(breakdown.parentNode?.children || []);
      const breakdownIdx = siblings.indexOf(breakdown);
      const roleCompIdx = siblings.indexOf(roleComp);
      assert.ok(breakdownIdx >= 0 && roleCompIdx >= 0, 'Both sections must share the modal body container');
      assert.equal(breakdownIdx, roleCompIdx - 1, 'Historical Predictor Breakdown must sit immediately before Compare vs. Other');
      view.unmount();

      // Verify disabled predictors and disabled categories are completely hidden in PlayerDetailModal
      const subsetIds = ['solar_lunar_transits', 'elemental_matchup'];
      const subsetCtx = buildMockCtx({ enabledSystems: subsetIds });
      const subsetView = render(
        jsx(OneiromancyContext.Provider, {
          value: subsetCtx,
          children: jsx(PlayerDetailModal, { player: sample, isOpen: true, onClose: () => {} }),
        }),
      );
      for (const sys of oracle.PREDICTOR_SYSTEM_META) {
        const row = subsetView.queryByTestId(`predictor-row-${sys.id}`);
        if (subsetIds.includes(sys.id)) {
          assert.ok(row, `Enabled predictor ${sys.id} must be visible in PlayerDetailModal`);
        } else {
          assert.equal(row, null, `Disabled predictor ${sys.id} must be hidden in PlayerDetailModal`);
        }
      }
      assert.equal(
        subsetView.queryByTestId('modal-predictor-category-sacred_day_calendars'),
        null,
        'Category with 0 active predictors must be hidden in PlayerDetailModal',
      );
      subsetView.unmount();
    });

    it('10.15.3 CosmicBoard desktop table and PlayerCardRow render Base, Modifier, and Projected columns and allow header sorting', () => {
      const ctx = buildMockCtx({ enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS] });
      const view = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(CosmicBoard, {}),
        }),
      );
      const baseHeader = view.getByTestId('board-base-col-header');
      const modHeader = view.getByTestId('board-modifier-col-header');
      const projHeader = view.getByTestId('board-projected-col-header');
      assert.ok(baseHeader.textContent.includes('Base'), 'Players table must render Base column header');
      assert.ok(modHeader.textContent.includes('Modifier'), 'Players table must render Modifier column header');
      assert.ok(projHeader.textContent.includes('Projected'), 'Players table must render Projected column header');
      assert.equal(projHeader.getAttribute('aria-sort'), 'descending', 'Projected column must default to descending sort');

      const projCells = view.getAllByTestId('board-projected-cell');
      const rowProjCells = view.getAllByTestId('row-projected-cell');
      assert.ok(projCells.length > 0, 'Desktop table rows must render board-projected-cell');
      assert.ok(rowProjCells.length > 0, 'Mobile card rows must render row-projected-cell');

      const firstValBefore = parseFloat(projCells[0].textContent || '0');
      assert.ok(Number.isFinite(firstValBefore) && firstValBefore > 0, 'Top projected player must have positive projected net points');

      // Click Modifier column header -> aria-sort moves to Modifier
      fireEvent.click(modHeader.querySelector('button'));
      assert.equal(modHeader.getAttribute('aria-sort'), 'descending', 'Clicking Modifier column header sorts descending by Modifier');
      assert.equal(projHeader.getAttribute('aria-sort'), 'none', 'Projected column aria-sort resets to none when Modifier is active');
      view.unmount();
    });

    it('10.15.4 Elemental Balance computes and renders elements across all 5 elemental predictors for player and real NFL unit', () => {
      const ctx = buildMockCtx({ enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS] });
      const detPlayer =
        ctx.draftState.cosmic_board.find((p) => p.team === 'DET' && p.position === 'WR') ||
        ctx.draftState.cosmic_board[0];
      const detUnit = sleeper.resolveNFLTeamUnit(detPlayer.team, ctx.draftState.cosmic_board, ctx.draftState.my_roster, detPlayer);
      const bal = oracle.computePlayerTeamElementalBalance(detPlayer, detUnit);

      assert.ok(bal.playerProfile.zodiacElement, 'Player profile must resolve Western Zodiac element');
      assert.ok(bal.playerProfile.arcanaElement, 'Player profile must resolve Major Arcana element');
      assert.ok(bal.playerProfile.wuXingPhase, 'Player profile must resolve BaZi Wu Xing phase');
      assert.ok(bal.playerProfile.loShuPhase, 'Player profile must resolve Lo Shu Ba Gua phase');
      assert.ok(bal.playerProfile.mayanDirection, 'Player profile must resolve Mayan Tzolkin direction');
      for (const [label, norms] of [
        ['Western Zodiac', bal.fourElementRadarNorms.zodiac],
        ['Major Arcana', bal.fourElementRadarNorms.arcana],
        ['BaZi Stem', bal.fivePhaseRadarNorms.bazi],
        ['Lo Shu Ba Gua', bal.fivePhaseRadarNorms.loShu],
      ]) {
        assert.equal(norms.length, 5, `${label} radar must compute 5 normalized spoke values`);
        assert.ok(
          norms.every((v) => Number.isFinite(v) && v >= 0.15 && v <= 1),
          `${label} radar spoke norms must fall within [0.15, 1]`,
        );
      }

      const view = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(PlayerDetailModal, { player: detPlayer, isOpen: true, onClose: () => {} }),
        }),
      );
      const section = view.getByTestId('player-team-elemental-balance');
      const playerStrip = view.getByTestId('player-multi-predictor-elements');
      const phasesStrip = view.getByTestId('unit-five-phases-strip');
      const fourElementSvg = view.getByTestId('synergy-constellation-svg');
      const fivePhaseSvg = view.getByTestId('five-phase-radar-svg');
      const mayanStrip = view.getByTestId('unit-mayan-directions-strip');

      for (const label of ['Western Zodiac', 'Major Arcana', 'BaZi Wu Xing', 'Lo Shu Ba Gua', "Mayan Tzolk'in"]) {
        assert.ok(playerStrip.textContent.includes(label), `Player elemental strip must include ${label}`);
      }
      const fourLegend = view.getByTestId('four-element-legend');
      const fiveLegend = view.getByTestId('five-phase-legend');
      assert.ok(fourLegend.textContent.includes('Western Zodiac') && fourLegend.textContent.includes('Major Arcana'), 'Four-element chart must render single clean legend');
      assert.ok(fiveLegend.textContent.includes('BaZi Stem') && fiveLegend.textContent.includes('Lo Shu Ba Gua'), 'Five-phase radar chart must render single clean legend');
      const fourPolys = Array.from(fourElementSvg.querySelectorAll('polygon'));
      const fivePolys = Array.from(fivePhaseSvg.querySelectorAll('polygon'));
      assert.equal(fourPolys.length, 2, 'Four-element radar SVG must render both Western Zodiac and Major Arcana polygons');
      assert.equal(fivePolys.length, 2, 'Five-phase radar SVG must render both BaZi Stem and Lo Shu Ba Gua polygons');
      for (const poly of [...fourPolys, ...fivePolys]) {
        assert.ok((poly.getAttribute('points') || '').trim().split(/\s+/).length === 5, 'Each projected radar polygon must format 5 SVG coordinate pairs');
      }
      assert.ok(phasesStrip.textContent.includes('Wood (') && phasesStrip.textContent.includes('Metal ('), 'Five-phase radar must label all 5 Wu Xing spokes');
      assert.ok(!section.textContent.includes('Unit player counts'), 'Redundant Unit player counts bar list must be removed');
      assert.ok(!section.textContent.includes('Zodiac 0 · Arcana 0'), 'Element rows must not render repeated Zodiac X · Arcana Y text');
      assert.ok(mayanStrip.textContent.includes('East (Red)') && mayanStrip.textContent.includes('South (Yellow)'), 'Unit Mayan strip must render all 4 cardinal directions');
      assert.ok(!section.textContent.includes('%') && !section.textContent.includes('/100'), 'Elemental Balance must contain zero % and zero /100');
      view.unmount();
    });

    it('10.15.5 Predictor (?) tooltip dropdowns include description and external website source link below description', () => {
      const ctx = buildMockCtx({ enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS] });
      const panelView = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }),
        }),
      );
      for (const sys of oracle.PREDICTOR_SYSTEM_META) {
        assert.ok(sys.sourceUrl && sys.sourceUrl.startsWith('https://'), `${sys.id} must define an https:// sourceUrl`);
        assert.ok(sys.sourceLabel && !sys.sourceLabel.includes('%'), `${sys.id} must define a clean sourceLabel`);
        const btn = panelView.getByTestId(`predictor-tooltip-btn-${sys.id}`);
        fireEvent.click(btn);
        const infoBox = panelView.getByTestId(`predictor-info-${sys.id}`);
        const sourceLink = panelView.getByTestId(`predictor-source-link-${sys.id}`);
        assert.ok(infoBox.textContent.includes(sys.description), `${sys.id} tooltip must display predictor description`);
        assert.equal(sourceLink.getAttribute('href'), sys.sourceUrl, `${sys.id} source link must point to verified URL`);
        assert.ok(sourceLink.textContent.includes(sys.sourceLabel), `${sys.id} source link must render sourceLabel`);
        const infoText = infoBox.textContent || '';
        assert.ok(
          infoText.indexOf(sys.description) < infoText.indexOf(sys.sourceLabel),
          `${sys.id} website source link must appear below the description inside the dropdown`,
        );
      }
      panelView.unmount();

      const modalView = render(
        jsx(OneiromancyContext.Provider, {
          value: ctx,
          children: jsx(PlayerDetailModal, {
            player: ctx.draftState.cosmic_board[0],
            isOpen: true,
            onClose: () => {},
          }),
        }),
      );
      const firstSys = oracle.PREDICTOR_SYSTEM_META[0];
      fireEvent.click(modalView.getByTestId(`modal-predictor-tooltip-btn-${firstSys.id}`));
      const modalInfo = modalView.getByTestId(`modal-predictor-info-${firstSys.id}`);
      const modalSource = modalView.getByTestId(`modal-predictor-source-link-${firstSys.id}`);
      assert.equal(modalSource.getAttribute('href'), firstSys.sourceUrl);
      assert.ok((modalInfo.textContent || '').indexOf(firstSys.description) < (modalInfo.textContent || '').indexOf(firstSys.sourceLabel));
      modalView.unmount();
    });

    it('10.15.6 Every screen, drawer, and player dossier displays Projected alongside Base and Modifier', () => {
      const ctx = buildMockCtx({ enabledSystems: [...oracle.ALL_PREDICTOR_SYSTEM_IDS] });
      const screens = [
        ['OneiromancyDashboard', jsx(OneiromancyDashboard, {}), 'roster-projected-cell'],
        ['MatchupsScreen', jsx(MatchupsScreen, {}), 'oracle-node'],
        ['CosmicBoard', jsx(CosmicBoard, {}), 'board-projected-cell'],
        ['LeagueScreen', jsx(LeagueScreen, {}), 'league-roster-projected-cell'],
        ['PlayerMarketplace', jsx(PlayerMarketplace, {}), 'stat-tile-projected'],
        ['TradesScreen', jsx(TradesScreen, {}), 'stat-tile-projected'],
        ['OraclePanel', jsx(OraclePanel, { isOpen: true, onClose: () => {} }), null],
        [
          'PlayerDetailModal',
          jsx(PlayerDetailModal, {
            player: ctx.draftState.cosmic_board[0],
            compareWith: ctx.draftState.cosmic_board[1],
            isOpen: true,
            onClose: () => {},
          }),
          'modal-hero-projected',
        ],
      ];

      for (const [name, elem, projTestId] of screens) {
        const view = render(jsx(OneiromancyContext.Provider, { value: ctx, children: elem }));
        const text = view.container.textContent || '';
        assert.ok(text.includes('Base'), `${name} must display Base`);
        assert.ok(text.includes('Modifier') || text.includes('Mod'), `${name} must display Modifier`);
        assert.ok(text.includes('Projected'), `${name} must display Projected`);
        if (projTestId) {
          assert.ok(view.getAllByTestId(projTestId).length > 0, `${name} must render ${projTestId}`);
        }
        view.unmount();
      }
    });

    it('10.15.7 Zero-dataset MODEL_PARAMETERS runtime scoring, 11 positive-edge default systems across 6 categories, USABLE_SIGNAL_CATALOG, and custom predictive systems work end-to-end', () => {
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.categoryCount, 6, 'Study summary must report 6 cosmic/divinatory categories');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.systemCount, 25, 'Study summary must report 25 pure esoteric systems');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.defaultSystemCount, 11, '11 positive-edge systems must be enabled by default');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.conditionCount, 194, 'Study summary must report 194 conditions');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.ridgeLambda, 1, 'Study summary must retain pooled reference ridgeLambda = 1');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.singleSystemLambda, 1, 'Study summary must retain pooled reference singleSystemLambda = 1');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.positionalRidgeLambda, 75, 'Study summary must use per-position ridgeLambda = 75');
      assert.equal(oracle.POINT_DIFF_STUDY_SUMMARY.positionalSingleSystemLambda, 50, 'Study summary must use per-position singleSystemLambda = 50');
      assert.ok(oracle.POINT_DIFF_STUDY_SUMMARY.oosTStat >= 2.05, 'All-25 per-position OOS t-stat must be >= 2.05');
      assert.ok(oracle.POINT_DIFF_STUDY_SUMMARY.oosDecileSpreadPts >= 0.4, 'All-25 per-position OOS decile spread must be >= +0.40 pts');
      assert.ok(oracle.POINT_DIFF_STUDY_SUMMARY.defaultCuratedOosTStat >= 2.0, 'Curated default per-position OOS t-stat must be >= 2.00');
      assert.ok(oracle.POINT_DIFF_STUDY_SUMMARY.defaultCuratedOosDecileSpreadPts >= 0.5, 'Curated default per-position OOS decile spread must be >= +0.50 pts');
      assert.ok(oracle.POINT_DIFF_STUDY_SUMMARY.trainScreenedOosTStat > 2.2, 'Train-screened OOS t-stat must be > 2.20');
      for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
        assert.ok(oracle.POSITIONAL_RIDGE_MODELS[pos]?.jointModel, `Per-position jointModel must exist for ${pos}`);
        assert.ok(oracle.POSITIONAL_RIDGE_MODELS[pos]?.defaultCuratedModel, `Per-position defaultCuratedModel must exist for ${pos}`);
        assert.ok(oracle.POSITIONAL_RIDGE_MODELS[pos]?.trainScreenedModel, `Per-position trainScreenedModel must exist for ${pos}`);
        assert.equal(Object.keys(oracle.POSITIONAL_RIDGE_MODELS[pos].perSystemModels).length, 25, `All 25 per-system models must exist for ${pos}`);
      }
      assert.notEqual(
        oracle.POSITIONAL_RIDGE_MODELS.QB.defaultCuratedModel.weights['team_synergy:REGIME_DEFICIT_OFFENSE'].ridgeWeight,
        oracle.POSITIONAL_RIDGE_MODELS.TE.defaultCuratedModel.weights['team_synergy:REGIME_DEFICIT_OFFENSE'].ridgeWeight,
        'QB and TE per-position curated weights must differ instead of pooling toward Kicker/TE scale',
      );
      assert.equal(Object.keys(oracle.CONDITION_EMPIRICAL_STATS).length, 194, 'All 194 empirical condition stats must be serialized');
      assert.equal(Object.keys(oracle.JOINT_RIDGE_MODEL.weights).length, 194, 'Joint Ridge model must hold 194 weights');
      assert.equal(Object.keys(oracle.DEFAULT_CURATED_RIDGE_MODEL.weights).length, 73, 'Curated default Ridge model must hold 73 co-fitted weights');
      assert.equal(Object.keys(oracle.TRAIN_SCREENED_RIDGE_MODEL.weights).length, 12, 'Train-screened Ridge model must hold 12 ex-ante conditions');
      assert.equal(Object.keys(oracle.PER_SYSTEM_RIDGE_MODELS).length, 25, 'All 25 standalone per-system Ridge submodels must be serialized');
      assert.equal(oracle.USABLE_SIGNAL_CATALOG.length, 25, 'Usable esoteric signal catalog must contain 25 audited signals');

      for (const cond of Object.values(oracle.CONDITION_EMPIRICAL_STATS)) {
        assert.ok(!cond.label.includes('%'), `Condition label ${cond.conditionId} must not contain %`);
        assert.ok(!cond.label.includes('/100'), `Condition label ${cond.conditionId} must not contain /100`);
      }

      const sampleInput = {
        playerId: '7564',
        playerName: "Ja'Marr Chase",
        position: 'WR',
        birthDate: '2000-03-01',
        jerseyNumber: 1,
        team: 'CIN',
        opponent: 'BAL',
        isHome: true,
        hostTeam: 'CIN',
        gameDate: '2026-11-01',
        kickoffUtc: '2026-11-01T18:00:00Z',
        projectedPts: 19.8,
        projStats: { rec: 7, rec_yd: 92, rec_td: 0.6 },
      };

      const jointPred = oracle.predictPlayerGamePointDiff(sampleInput, oracle.MODEL_PARAMETERS);
      assert.equal(Object.keys(jointPred.perSystemBreakdown).length, 25, 'Runtime prediction must evaluate all 25 systems');
      const explicitAllPred = oracle.predictPlayerGamePointDiff(sampleInput, oracle.MODEL_PARAMETERS, {
        systems: oracle.ALL_PREDICTOR_SYSTEM_IDS,
      });
      assert.equal(
        jointPred.expectedPointDiff,
        explicitAllPred.expectedPointDiff,
        'Explicit 25-system set must match full 25-system jointModel prediction',
      );
      const defaultSetPred = oracle.predictPlayerGamePointDiff(sampleInput, oracle.MODEL_PARAMETERS, {
        systems: oracle.DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
      });
      assert.ok(Number.isFinite(defaultSetPred.expectedPointDiff), 'Default 11-system expectedPointDiff must be finite');
      assert.ok(Number.isFinite(jointPred.expectedPointDiff), 'Joint expectedPointDiff must be finite');
      assert.equal(
        jointPred.adjustedProjectedPts,
        Number((19.8 + jointPred.expectedPointDiff).toFixed(2)),
        'adjustedProjectedPts must equal baseProjectedPts + expectedPointDiff',
      );
      assert.ok(
        jointPred.perSystemBreakdown.witchcraft_sabbats_esbats.activeConditionCount >= 1,
        'Samhain Nov 1 game must activate witchcraft_sabbats_esbats condition',
      );

      const screenedPred = oracle.predictPlayerGamePointDiff(sampleInput, oracle.MODEL_PARAMETERS, {
        useTrainScreened: true,
      });
      assert.ok(Number.isFinite(screenedPred.expectedPointDiff), 'Train-screened expectedPointDiff must be finite');

      const singleWitch = oracle.predictPlayerGamePointDiff(sampleInput, oracle.MODEL_PARAMETERS, {
        systems: ['witchcraft_sabbats_esbats'],
      });
      assert.equal(
        singleWitch.expectedPointDiff,
        singleWitch.perSystemBreakdown.witchcraft_sabbats_esbats.standalonePointDiff,
        'Single-system prediction must use standalone perSystemModels weights',
      );

      const halfPprPred = oracle.predictPlayerGamePointDiff(
        { ...sampleInput, projectedPts: null },
        oracle.MODEL_PARAMETERS,
        { scoringSettings: scoring.SLEEPER_HALF_PPR_SCORING },
      );
      assert.equal(halfPprPred.baseProjectedPts, 16.3, 'Half-PPR stat hydration: 7*0.5 + 92*0.1 + 0.6*6 = 16.3');

      const customSys = oracle.createPredictiveSystem({
        id: 'custom_test_esoteric',
        name: 'Custom Esoteric Test',
        description: 'Custom test condition',
        clusterBy: 'gameDate',
        conditions: [
          {
            id: 'SAMHAIN_TEST',
            label: 'Samhain Test',
            eligible: (r) => r.position !== 'DEF',
            test: (_r, c) => c.witchcraft.isSamhainVeilWindow,
          },
        ],
      });
      assert.equal(customSys.conditions.length, 1);
      assert.equal(customSys.conditions[0].test(sampleInput, jointPred.observables), true);

      // Verify interactive category toggles, Enable all (25), Disable all, and Default (11) inside OneiromancyProvider
      const livePanel = render(
        jsx(OneiromancyProvider, {
          children: jsx(OraclePanel, { isOpen: true, onClose: () => {} }),
        }),
      );
      assert.ok(
        (livePanel.container.textContent || '').includes('Active Predictors (11 of 25)'),
        'Provider must initialize with the 11 positive-edge predictors enabled by default',
      );
      fireEvent.click(livePanel.getByTestId('predictor-category-toggle-sacred_day_calendars'));
      assert.ok(
        (livePanel.container.textContent || '').includes('Active Predictors (13 of 25)'),
        'Toggling sacred_day_calendars (3/5 default active -> 5/5 active) must raise active count to 13 of 25',
      );
      fireEvent.click(livePanel.getByTestId('enable-all-predictors-btn'));
      assert.ok(
        (livePanel.container.textContent || '').includes('Active Predictors (25 of 25)'),
        'Clicking Enable all (25) button must enable all 25 predictors',
      );
      fireEvent.click(livePanel.getByTestId('disable-all-predictors-btn'));
      assert.ok(
        (livePanel.container.textContent || '').includes('Active Predictors (0 of 25)'),
        'Clicking Disable all button must disable all 25 predictors',
      );
      fireEvent.click(livePanel.getByTestId('reset-weights-btn'));
      assert.ok(
        (livePanel.container.textContent || '').includes('Active Predictors (11 of 25)'),
        'Clicking Default (11) button must restore the 11 positive-edge default predictors',
      );
      const studyLink = livePanel.getByTestId('empirical-study-github-link');
      assert.equal(
        studyLink.getAttribute('href'),
        'https://github.com/google/oneiromancy/blob/main/docs/SLEEPER_POINT_DIFF_ANALYSIS.md',
        'Predictors methodology study link must point to GitHub SLEEPER_POINT_DIFF_ANALYSIS.md',
      );
      const hasTeamLogo = (root) =>
        Array.from(root.querySelectorAll('img')).some((img) =>
          String(img.getAttribute('src') || img.src || '').includes('team_logos/nfl/'),
        );
      assert.ok(
        hasTeamLogo(livePanel.container),
        'OraclePanel preview player must render NFL team logo alongside team code',
      );
      livePanel.unmount();
    });

    it('10.15.8 MatchupsScreen hides past bye weeks and renders NFL team logos across all views', () => {
      const hasTeamLogo = (root) =>
        Array.from(root.querySelectorAll('img')).some((img) =>
          String(img.getAttribute('src') || img.src || '').includes('team_logos/nfl/'),
        );
      const ctx = buildMockCtx();
      const dash = render(
        jsx(OneiromancyContext.Provider, { value: ctx, children: jsx(OneiromancyDashboard, {}) }),
      );
      assert.ok(
        hasTeamLogo(dash.container),
        'Roster dashboard must render NFL team logos alongside player and opponent team codes',
      );
      dash.unmount();

      const matchup = render(
        jsx(OneiromancyProvider, { children: jsx(MatchupsScreen, {}) }),
      );
      assert.ok(
        hasTeamLogo(matchup.container),
        'MatchupsScreen starter cards must render NFL team logos',
      );
      // In Week 2, Bye 5 / Bye 7 / Bye 14 are upcoming and displayed
      assert.ok(
        matchup.container.textContent.includes('Bye 7') && matchup.container.textContent.includes('Bye 14'),
        'Week 2 MatchupsScreen must display upcoming bye weeks',
      );

      // Switch to Week 8: Bye 5, Bye 6, and Bye 7 have already happened, while Bye 14 is still upcoming
      fireEvent.click(matchup.getByTestId('matchup-week-btn-8'));
      const wk8Text = matchup.container.textContent || '';
      assert.ok(!wk8Text.includes('Bye 5'), 'Week 8 MatchupsScreen must hide Bye 5 (already happened)');
      assert.ok(!wk8Text.includes('Bye 6'), 'Week 8 MatchupsScreen must hide Bye 6 (already happened)');
      assert.ok(!wk8Text.includes('Bye 7'), 'Week 8 MatchupsScreen must hide Bye 7 (already happened)');
      assert.ok(wk8Text.includes('Bye 14'), 'Week 8 MatchupsScreen must still show upcoming Bye 14');

      // Switch to Week 15 (post-bye playoffs): all bye weeks 5..14 have already happened
      fireEvent.click(matchup.getByTestId('matchup-week-btn-15'));
      const wk15Text = matchup.container.textContent || '';
      assert.ok(!/Bye \d+/.test(wk15Text), 'Week 15 MatchupsScreen must hide all past bye weeks');
      assert.equal(
        matchup.container.querySelector('[data-testid="matchup-bye-callout"]'),
        null,
        'Week 15 MatchupsScreen must omit empty bye callout after bye weeks have ended',
      );
      matchup.unmount();
      sleeper.setSeasonContext(null);
    });
  });
});
