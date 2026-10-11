# Oneiromancy architecture (current state)

This is the map of the app as of 2026-10-11, for anyone (human or agent) about
to change it. It describes what *is*. For why things are the way they are,
see [`DECISIONS.md`](DECISIONS.md). For the rules every change must follow,
see [`AGENT_UX_GUIDELINES.md`](AGENT_UX_GUIDELINES.md). Read the mission at the
top of the guidelines first.

## 1. What the app is

A read-only companion to a Sleeper fantasy football league. It rates every
player and team with the **owner's own scoring model** and turns that into
weekly moves: who to start, who to add or drop, and who to trade with. It never
writes to Sleeper and never links out to act there.

## 2. Stack and deployment

- Next.js 14 (App Router) built as a **static export** (`next build` → `out/`).
- Deployed as a **Cloudflare Worker serving static assets** (`wrangler.jsonc`)
  through Workers Builds on pushes to `main`. Live at https://one.seance.sh.
- All Sleeper calls happen **in the browser**. There is no server, database or
  pipeline. (An upstream "Python Pipeline SQLite Daemon" label described
  something that doesn't exist and was removed.)
- `seano-vs/oneiromancy` is a private copy of `google/oneiromancy`, which is
  read-only upstream. Never push to it.
- Local preview: `npm run build && npx wrangler dev --port 8787`. Restart
  wrangler after every rebuild, and don't commit the `next-env.d.ts` that the
  build rewrites.

## 3. Code map

| Area | File(s) | Role |
| --- | --- | --- |
| Page router | `app/page.tsx` | Picks the screen for the active tab, opens the Oracle panel (also on the `oneiromancy:open-oracle` window event) |
| State | `context/OneiromancyContext.tsx` | Draft/league state, sync and polling, settings, mock mode, persistence |
| Sleeper data | `core/lib/sleeper.ts` | Fetching, caching, rate limiting, season context, transform to app state, weekly matchup derivation |
| Scoring engine | `core/lib/scoring.ts` | Defaults, Spirit (weighted divination breakdown), Draft score, weekly favorability, harmony (+ breakdown), team metrics, win probability, `recomputeDraftState` |
| Oracle model | `core/lib/oracle.ts` | Stats / Stars / Oracle, tone scale, lineup check, waiver moves, bye outlook, trade partners, team ratings, element text |
| Types | `core/types/oneiromancy.ts` | `CosmicPlayer`, `RosterSlot`, `CompetitorTeam`, `WeeklyMatchup`, settings |
| Shell | `components/common/NavigationShell.tsx` | Header (tabs, Oracle chip, status, avatar), mock banner, phone tab bar |
| Shared UI | `components/common/PlayerLink.tsx`, `PlayerHeadshot.tsx`, `PositionalBadge.tsx`, `UserAvatar.tsx`, `GlassCard.tsx` | Clickable names, Sleeper CDN images, badges |
| Player popup | `components/modals/PlayerDetailModal.tsx` | Extended view; role comparison or head-to-head (`compareWith`) |
| Oracle panel | `components/oracle/OraclePanel.tsx` (+ `screens/ChaosDial.tsx` embedded) | λ slider and presets, preview, star weights, astrology reference |
| Screens | `components/screens/*.tsx`, `components/oneiromancy/*.tsx` | See §6 |
| Settings | `components/settings/SettingsDrawer.tsx` | Welcome / username, league picker, mock, auto-update |

## 4. Data flow

1. **Identity.** A username → `/v1/user/<name>` → `/v1/user/<id>/leagues/nfl/<season>`.
   The first league is chosen unless the owner picks another.
2. **League.** `/v1/league/<id>`, `/rosters`, `/users`, `/drafts`, `/v1/draft/<id>`
   and `/picks`, plus `/v1/players/nfl` (cached 24 h in memory).
3. **Season context**, loaded on every live sync:
   - `/v1/state/nfl` gives the current week.
   - `api.sleeper.app/schedule/nfl/regular/<season>` gives the real bye weeks
     and game dates.
   - `/matchups/<week>` for every regular-season week gives opponents, scores,
     W/L and live points.
   - Requests are cached, and concurrent syncs share them.
4. **Projections.** `/v1/projections/nfl/regular/<season>/<week>` (cached
   10 min) is re-scored with the league's `scoring_settings` by
   `calculateSleeperLeagueProjection`. It covers pass, rush and rec yards/TDs,
   2-pt, INT, receptions and fumbles lost. That is every offensive category
   this league scores. The league has no K or DEF slots; add those categories
   if a league needs them.
5. **Starters** come from the **current week's matchup**, falling back to
   `/rosters` `starters`, which lags behind lineup changes.
6. **Transform** (`transformToDraftState`) builds `cosmic_board` (every player with
   Spirit, divination breakdown, projections, status), `my_roster` (slots in
   league order), `competitor_teams` (record, PF, players, starters, team metrics)
   and `weekly_matchup` (both sides, per-player favorability, team comparison,
   past and upcoming weeks).
7. **Recompute.** Changing λ or a star weight runs `recomputeDraftState`. It
   re-derives Spirit from the breakdown with the weights, then Draft score,
   team metrics, matchup favorability and team Stars. All of it happens in
   memory with no refetch.

**Polling.** About every 60 s once the draft is complete (`COMPLETE_INTERVAL_MS`),
with a sliding-window rate limiter. There are no Sleeper calls until an account
is configured, and none in mock mode.

## 5. The scoring model

Owner defaults (`core/lib/scoring.ts`), which are **not to be changed unless the
owner asks**:

- `DEFAULT_CHAOS_LAMBDA = 0.75`
- `DEFAULT_ORACLE_WEIGHTS`:

  | Pillar | Weight |
  | --- | --- |
  | Celestial Transits (celestial) | 0.30 |
  | Stadium Feng Shui (geomantic) | 0.25 |
  | Jersey Gematria (numeric) | 0.20 |
  | Squad Alchemy (harmony) | 0.15 |
  | Tarot & I-Ching (oracular) | 0.10 |

Player numbers:

| Number | Definition | Where |
| --- | --- | --- |
| **Spirit** | Divination breakdown (5 pillars) weighted by the star weights, 0–100 | `computeSpiritScore` |
| **Stars** | This week's favorability from Spirit, projection, injury and stadium, **scored as a starter** so bench players aren't pre-judged, 0–100 | `starsScore` (oracle.ts) → `computeWeeklyPlayerFavorability` |
| **Stats** | Projected points; Stats score = pts / 25 × 100, capped | `statsPoints`, `statsScore` |
| **Oracle** | `(1 − λ) × Stats score + λ × Stars` | `oracleScore` |
| Draft score | `(1 − λ) × VOR_normalized + λ × Spirit` (draft-time; feeds team metrics) | `computeDraftScore` |

Team numbers:

| Number | Definition |
| --- | --- |
| Overall (leaderboard) | 0.4 × avg Spirit + 0.3 × avg Draft + 0.3 × Harmony, over the roster (`calculateTeamCelestialMetrics`) |
| Squad Harmony | 50 + trine (12/18) + QB stacks (9/18 each, cap 30) + 10 if all four elements, scored on the lineup (`computeRosterHarmonyBreakdown`) |
| Astral Favorability (matchup) | Mean Stars of each side's starters this week |
| Team tier chip | `classifySpiritScoreTier(avg Spirit)`: ≥85 Favorable, ≥75 Harmonic, else Discordant |

One tone scale colors every Stars value: `favorabilityTone` gives ≥84 apex,
75–83 good, 65–74 neutral, <65 bad. It classifies the **rounded, displayed**
value.

## 6. Screens (in-season information architecture)

Four tabs. Old ids resolve through `TAB_ALIASES`; `chaos` and `dial` open the
Oracle panel.

| Tab (id) | Contents, top to bottom |
| --- | --- |
| **This Week** (`oneiromancy`) | Team comparison card for the current week: head-to-head banner, Team Celestial Telemetry (`MatchupsScreen part="comparison"`) · Your moves (`WeeklyMoves`: lineup swaps, top waiver, bye plan, trade idea) · Team harmony (one collapsible card) · roster slots · bye outlook · Matchup details (`MatchupsScreen part="details"`: explainer, week selector, player cards, past matchups) |
| **Waivers** (`market`) | Need-aware waiver moves (`PlayerMarketplace section="waivers"`) · player directory (`CosmicBoard`: headshots, logos, Stats / Stars / Oracle, sort, search, Free agents only, 25 per page) |
| **Trades** (`trades`) | Partners by mutual Oracle fit: give, get, who each replaces, roster list. Sample swaps in mock only |
| **League** (`league`) | The **original** Celestial Leaderboard (Overall / Spirit / Draft / Harmony, default Overall) · lineup breakdown for any team (Oracle, pts, Stars) |

Header: tabs, the **Oracle chip** (λ and leaning; opens the Oracle panel), a
single sync status, and an avatar that opens Settings. The phone tab bar is
phone-only.

## 7. Recommendation rules (enforced in `oracle.ts`, tested in Tier 10)

- **Lineup check:** fills the most restrictive slots first, using Oracle.
  Reports both players' Stats and Stars, and the λ at which the call flips.
- **Waivers:**
  - Adds are only available, unrostered, healthy players.
  - Never drops a starter, a player the lineup check says to start, a player
    whose only problem is this week's bye, or needed positional depth
    (dedicated slots + 1; QB = 3 in superflex).
  - Moves that would start rank first, and the limit applies after ranking.
- **Trades:** a 1-for-1 where your bench player would start for them and theirs
  for you, judged by Oracle. Gains are in Oracle points.
- **Every player value** shows Oracle with points and Stars, never projections
  alone.

## 8. UI conventions

- **Player names in recommendations** use `<PlayerLink player vs>`. Clicking opens
  `PlayerDetailModal` with `compareWith` (head-to-head) and a link to the
  roster view. Your own players compare against "your other {POS}s" and never
  against themselves.
- **Images** come from Sleeper's CDN:
  - headshot: `sleepercdn.com/content/nfl/players/thumb/<id>.jpg`
  - team logo: `sleepercdn.com/images/team_logos/nfl/<team>.png`
  - Defenses and failed headshots fall back to the team logo, then to initials.
- **Mystical names stay**, with a plain label beside them ("Alchemical
  Transmutations" over "Waivers").

## 9. Persistence (browser localStorage)

| Key | Holds |
| --- | --- |
| `oneiromancy_active_username` | The owner's Sleeper username. Never the mock persona; a stale `OneiroVanguard` from older builds is cleared on load |
| `oneiromancy_active_slot` | Draft slot |
| `oneiromancy_oracle_v2` | `{ chaos_lambda?, oracle_weights? }`, each saved only when the owner changes it |

## 10. Mock mode

`loadMockData` shows a sample league (slot 7, roster 2). It never fills in,
saves or syncs a username, makes no Sleeper calls, and shows a "Viewing sample
data" notice, "Sample league (not on Sleeper)" and auto-update off. The banner
offers "Back to {user}" or "Connect your Sleeper account".

## 11. Tests

`npm test` runs `tests/e2e_runner.mjs`: 11 tiers and 457 tests, **all passing**
as of 2026-10-11.

| Tier | File | Covers |
| --- | --- | --- |
| 0 | `architecture_invariants.test.mjs` | Leakage and architectural invariants |
| 1–4 | `tier1_features` … `tier4_workloads` | Features, boundaries, pairwise, workloads (largely source-level checks) |
| 5 | `real_sleeper_fixtures.test.mjs` | Transform on real Sleeper fixtures |
| 6 | `component_identity_audit.test.mjs` | Exactly one user team, mock identity |
| 7 | `msw_network.test.mjs` | Offline network interception |
| 8 | `component_suite.test.mjs` | React components rendered with a test shim |
| 9 | `live_sleeper_matchup_audit.test.mjs` | Matchup derivation, projections, favorability |
| 10 | `oracle_model.test.mjs` | Owner defaults, Oracle model, recommendation rules, harmony, weights, mock, read-only |

Gotchas:

- Test files must call `register(new URL('./loader.mjs', import.meta.url))`
  **before** importing app code, and must import app code **dynamically**
  (`await import(...)`). Static imports run before the registration. This is
  why tiers 1–4 never ran until 2026-10-11.
- The React shim (`tests/helpers/react_shim.mjs`) stubs `lucide-react`. Only
  icons it lists can be used in components under test. `screen` has
  `getByText`, `queryByText`, `getByTestId` and `queryByTestId`; there is no
  `getAllByText`.
- Many tier 1–2 tests assert on component **source text**. When you change a
  UI string they reference, update the test to the new behavior and say so in
  a comment. If a feature is removed, mark it `REMOVED:` in the test and tell
  the owner. Never delete or skip a test to get green.
- `tests/challenger_*`, `tier5_adversarial_*` and `debug_repro_session.mjs` are
  outside the runner. `tier5_adversarial_data_engine.mjs` has 3 failures that
  predate this work (7.1, 7.3, 7.6).

## 12. Validating a change (beyond tests)

The definition of done is in the guidelines. In practice:

1. Build, start `wrangler dev`, and drive Chromium with Playwright, signed in
   as a real Sleeper user. Check 1440×900 and 390×844, with no console errors
   and no horizontal overflow.
2. Pull ground truth straight from Sleeper: state, league, rosters, users,
   matchups by week, schedule, players and projections. Compare what each
   screen renders against it with a script, not by eye. The 2026-10-11
   validation pass did this with about 680 checks; see that log.
3. Move λ and a star weight and confirm that every screen you touched changes.

## 13. Known gaps and open questions

- **Bench Stars mismatch.** Matchup-detail player cards score bench players
  with the upstream role penalty, so the same player shows different "Stars"
  there (e.g. Isaiah Likely 65.6) and everywhere else (★80, scored as a
  starter). This needs an owner decision.
- **Leaderboard tier chip.** It follows average Spirit, not rank, so the #1
  Overall team can show "Discordant (At Risk)". Kept as the owner's original
  design.
- **Past-week alignment.** Past matchups carry no astral alignment, so the line
  is hidden rather than showing a constant.
- **Removed features.** The rework removed some upstream This Week pieces:
  competitor roster cards with tier badges and 75.0 equilibrium mini-gauges,
  the "SpiritScore & Harmony Calibration Spectrum" legend, the Marketplace
  10-stat head-to-head matrix, and the "FREE AGENT • WAIVER WIRE" cards. Tests
  mark these `REMOVED:`. The owner may want some back.
