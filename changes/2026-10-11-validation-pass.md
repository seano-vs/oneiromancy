# 2026-10-11: Validation pass (tests and full UI walkthrough)

The owner asked to stop, revisit the tests, and step through every part of the
UI interactively, validating changes, data and features without assumptions,
then update these docs. This log covers that pass.

| Commit | Summary |
| --- | --- |
| `e8d1986` | Tests: tiers 1–4 run again; stale UI checks updated; new Tier 10; original visual details restored |
| `b304688` | Matchups: no constant "Astral Alignment: Aligned" on past weeks |
| (this commit) | Docs: `ARCHITECTURE.md`, `DECISIONS.md`, this log, `README.md`, status notes on older logs, guidelines |

## 1. Tests

### Tiers 1–4 had never run

Since setup, `npm test` reported tiers 1–4 as "failed to load"
(`ERR_MODULE_NOT_FOUND` for `core/types/oneiromancy` imported from
`core/lib/scoring.ts`). The original instruction was not to fix the loader. The
loader turned out to be fine:

- Those four files imported app code with a **static** `import`.
- Node evaluates static imports **before** the module body, so the in-file
  `register(loader)` call hadn't run yet.
- Node then loaded the raw `.ts`, whose extension-less imports don't resolve.

The fix is in the test files: register the loader, then `await import(...)`,
the same pattern the passing Tier 8 already used.

### What surfaced

With the tiers running, 288 tests came back and 34 failed. The same tests
against untouched upstream (`b7b9c82`) passed 255/255, so all 34 came from our
changes. Every one asserted pre-rework UI text:

- seven tabs in a fixed order
- the 0.35 default λ
- "Weekly Matchup & Start/Sit Oracle"
- the "FREE AGENT • WAIVER WIRE" cards
- "Draft Score" sorting
- competitor roster cards on This Week, and similar

How each was handled:

- **Restored**, not re-tested: four were original details the rework had
  dropped without being asked:
  - the glowing active-tab bar
  - the glowing "live" status dot
  - the "Divination Spotlight Pick (Read-Only)" heading
  - the "Active Transits & Conjunctions" heading (now with a plain "QB stacks
    this week" subtitle)
- **Updated** to assert the current, owner-approved behavior, each with a
  comment.
- **Marked `REMOVED:`** where a feature no longer exists (see §4). They
  weren't silently rewritten to approve the removal.

### New Tier 10

`tests/oracle_model.test.mjs` has 20 tests covering:

- the owner's defaults, with no hard-coded fallback λ
- symmetric presets
- the Stats / Stars / Oracle formula
- tone thresholds, which classify the displayed rounded value
- injury text
- lineup check and flip λ
- the waiver rules, including never dropping a player the lineup check starts
  and limiting after ranking
- Oracle-based trade fit and gains
- team ratings
- the harmony breakdown summing to harmony
- star weights changing Spirit, while default weights leave it unchanged
- headshot and logo URLs
- mock never saving a username
- the read-only rule

### Result

`npm test`: **457 passed, 0 failed**, all 11 tiers. Before this pass, the
runner had 146 runnable tests, 4 of them failing. `npx tsc --noEmit` is clean;
`npm run build` passes with the 4 existing lint warnings.

## 2. UI walkthrough against Sleeper ground truth

**Method.** Fresh data was pulled straight from Sleeper for the McTwerkface
league, week 5 of 2026: state, league, rosters, users, matchups for weeks 1–6,
the NFL schedule, all players, and projections. Playwright then drove every
screen and control of the local build at 1440×900 and 390×844. A script
compared every rendered value with the ground truth. The expected projections
were computed independently in Python from the raw stats and the league's
scoring settings.

**Results:** about 680 automated checks, 0 failures after fixing my own
parsers.

| Area | Verified |
| --- | --- |
| Header | 4 tabs, Oracle chip at λ 0.75, "Synced" status |
| This Week | Week label and dates (from the schedule), both teams, managers, projected totals (sum of starters), live scores, win probability, telemetry; every roster slot's player, order, points, team, bye and injury chip; each move (swap players on the right side, waiver add unrostered, drop on the bench, injury wording, bye plan's starters and bench for the next bye week, trade players on the correct benches and lineups); matchup-detail starters for weeks 3, 4 and 5; past results and scores for weeks 1–4 |
| Oracle panel | 4 presets set λ 0, 0.25, 0.75 (default, highlighted), 1; every preset's preview is consistent (swaps valid, waiver add unrostered, never drops a player it starts, flip λ in (0, 1)); weights 30/25/20/15/10; Escape closes |
| Waivers | Every move's add, drop, team, bye and stats; TE and QB filters; Free agents only (default on, then off); search (free agent, rostered with filter off, by team); sort by Stats, Stars and Oracle; Show more; the unsigned toggle |
| Player directory | 50+ rows: status (Yours, Rostered, Free agent), position, team and bye, projected points, injury chip, and that each **headshot's player id matches the row** |
| Trades | Every partner's record; give is on your bench and starts over their real starter; get is on their bench and starts over yours; point values; partner roster list = their real roster |
| League | All 4 leaderboard tabs: 12 teams with real names, sorted, exactly one "YOU"; all 12 teams' lineup breakdowns (starters in order, bench, points, records) |
| Popups | Head-to-head pairing from each recommendation, the right headshot, pillar weights, own-player and other-player headings |
| Settings | No polling or fake engine sections; profile and leagues for a connected account |
| Mock | Fresh browser: storage untouched, 0 Sleeper API calls, honest notices. Connected: username kept, "Back to McTwerkface" returns live |
| Persistence | A weight change moves leaderboard Overall (77.6 → 76.8) and survives the background sync and a reload |
| Phone | All four tabs at 390 px with no horizontal overflow; bottom nav; Oracle panel; trade popups |
| Health | 0 console errors in every run |

Also checked: the app's 12-category projection formula equals full league
scoring for every rostered player. The league scores no K, DEF or bonus
categories, and has no K or DEF slots.

## 3. Findings

| Finding | Status |
| --- | --- |
| Past weeks showed a constant "Astral Alignment: Aligned", even for losses | **Fixed** (`b304688`): shown only when the data has a value |
| Same player, two "Stars": matchup-detail cards score bench players with the upstream role penalty (Isaiah Likely 65.6, below Ferguson's 74.7), while every other screen scores them as a starter (★80, above Ferguson's ★75). Your moves says stars favor Likely | **Open: owner decision** |
| The leaderboard's #1 Overall team can wear "⚠️ Discordant (At Risk)", because the chip follows average Spirit, not rank | Kept (owner's original design); owner told |
| The Bye outlook disclosure is titled "Why 18-Week Coverage Matters" but shows the remaining weeks (5–13) | Minor; left as-is |
| Travis Hunter shows as "DB" with 0.9 pts | Correct per Sleeper's data |

## 4. Features the rework removed (owner may want some back)

The upstream tests made these visible:

- This Week **competitor roster cards** with team tier badges and 75.0
  "equilibrium" mini-gauges
- The **"SpiritScore & Harmony Calibration Spectrum"** legend
- The Marketplace **10-stat head-to-head matrix** (Proj PPG, Season VOR,
  DraftScore, SpiritScore, element, bye, catalysts, risks, injury, net-delta
  badges). The popup's head-to-head mode covers six of these.
- The **"FREE AGENT • WAIVER WIRE"** waiver cards with "PROPOSED ADD"

The tests now assert the current replacements and carry `REMOVED:` comments.
