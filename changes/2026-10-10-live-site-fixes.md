# 2026-10-10: Fixes from the live site audit

> **Status (2026-10-11):** historical log. The Standings tab added here was later removed at the owner's request (Sleeper already shows standings), and the tiers 1–4 "loader bug" was an import-order bug in those test files, fixed on 2026-10-11. See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`DECISIONS.md`](DECISIONS.md).

Follow-up to `2026-10-10-live-site-audit.md`. Goal: make every data point
that has a real-world source come from Sleeper, make labels agree with their
legends, and stop the request storm. Verified in Chromium against a local
`wrangler dev` build with user **McTwerkface** (league Toxic Trash Talkers),
compared programmatically with Sleeper's API.

## Approach: a season context

`core/lib/sleeper.ts` now loads a **season context** on every live sync
(`loadSeasonContext`) and registers it module-wide, like the existing player
dictionary cache:

- NFL schedule from `GET https://api.sleeper.app/schedule/nfl/regular/<season>`
  (public, CORS-enabled), giving each team's **bye week** and each week's
  **date range**.
- League matchups for every regular-season week (`1 … playoff_week_start - 1`).

Why module-level: `deriveWeeklyMatchup` is called from the context *and* from
three components (Matchups, Dashboard, context reconciliation). Threading the
data through every call site would touch far more code. Mock mode clears the
context (`setSeasonContext(null)`) so mock teams never pick up real pairings,
and everything falls back to the previous behaviour when no context exists.

Caching: the schedule is cached per season and matchups per league and week,
as promises, so concurrent syncs share one request. Completed weeks are cached
for good. Future pairings are re-fetched when the NFL week advances. Empty or
failed responses are never cached.

## Fixes, by audit item

| # | Issue | Fix |
|---|---|---|
| 1 | Bye weeks were a hash of the player ID | `bye_week` comes from the schedule (`getTeamByeWeek`) in `synthesizeCosmicPlayerFromId` and `enrichCosmicBoardWithNFLPlayers`. Unknown byes show "—". Bye matrix, board, modal and marketplace all follow. |
| 2 | Season schedule invented (round-robin) | `generateMatchupWeeks` uses real pairings via the new `generateSeasonMatchupWeeks`; `deriveWeeklyMatchup` falls back to the context's matchups for the requested week. Regular-season weeks only. |
| 3 | Completed weeks showed projections | Completed weeks show **final scores** and **WIN/LOSS**; `WeeklyMatchup` gained `status`, `date_range`, `score_user`, `score_opponent`, `result`. "Completed League Duels" is filled from real results. |
| 4 | Waiver advice dropped players for being on bye | Bench players whose team is on bye this week are excluded from the drop pool. The fallback that could recommend dropping a **starter** is removed. "(x tot)" is removed, and the injury row reflects real statuses instead of a constant "Zero Risk". |
| 5 | Competitor "rosters" were draft picks | Cards list the current Sleeper roster (starters first), tagged "Rd N" or "Added". Team metrics use the current roster, not picks ∪ roster. Live-sync reconciliation prefers the roster over picks. |
| 6 | Dates hard-coded to 2025 | Week dates come from the schedule. |
| 7 | Harmony saturated at 100 | `computeRosterHarmony` scales element counts to an 8-player basis and counts each QB/pass-catcher stack once. Team harmony is scored on the starting lineup. Range is now 60–90% instead of 100% for 9/12 teams. |
| 8 | Tier labels contradicted legends | Team rating = SpiritScore tier everywhere (`classifySpiritScoreTier`, 85/75, which matches the on-screen legend). Weekly favorability uses one shared `classifyWeeklyFavorability` that classifies the **rounded** score (so "75" can no longer read "CHG"). The Matchups legend gains the NEUTRAL (65–74) band the scorer already used. |
| 9 | "Standings" ignored records | Teams carry `wins/losses/ties/points_for`. The leaderboard has a **Standings** tab, default when records exist, sorted by wins and then points for. |
| 10 | Live scores ignored | Active week shows "Live: x" under each team's projection, on the Dashboard and Matchups. |
| 11 | Draft leftovers after draft complete | Spotlight reads "Top Available Free Agent"; ADP shows "—" when unknown (was a constant 50.0). |
| 12 | "Half-PPR" label on full-PPR number | Relabelled "NFL PPR Proj / Standard PPR Baseline (4-pt pass TD)". |
| 13 | Placeholder data looked live before sign-in | On first load a child effect saw the demo username before the provider's hydration effect cleared it, so the config-change effect synced "OneiroVanguard". The username ref now starts from saved storage, and the config-change effect is skipped while no account is configured. The LIVE SYNC banner is hidden while offline. |
| 14 | Divine Swaps always empty in live mode | Not implemented for live leagues (only mock data has proposals). The empty state now says so instead of claiming an analysis ran. |
| 15 | Polling storm | (a) The poller's in-flight `refreshDraft` could schedule an orphan loop after the effect was torn down, so loops piled up; a `cancelled` flag stops that. (b) Completed drafts poll every 60 s (`COMPLETE_INTERVAL_MS`). (c) Projections are cached 10 min and a completed draft's picks permanently. (d) Concurrent forced syncs with the same parameters share one in-flight sync. |
| 16 | Modal ignored Escape | Escape closes the player modal. |
| 17 | Mock mode showed "Live (OneiroVanguard)" | Shows the saved username. |
| 19 | "Classical" rulers listed modern ones | Text corrected. |

Not changed: #18 (Travis Hunter DB→WR; the app only models QB/RB/WR/TE/K/DEF).
The bye matrix still shows simulated projections for already-played weeks; it
is labelled a simulation and its bye conflicts are now real.

## Verification

- `npx tsc --noEmit` clean; `npm run build` passes with the same 4 pre-existing
  `react-hooks/exhaustive-deps` warnings.
- `npm test`: 140 pass; tiers 1–4 still fail to load with the existing
  `ERR_MODULE_NOT_FOUND` loader bug (unchanged baseline).
- One test changed: `component_identity_audit` 3.3 asserted that mock team
  AstralOracles outranks LunarEclipse. That only held because both had
  harmony pinned at 100 (AstralOracles' lineup scores 60, LunarEclipse's 90).
  The assertion now checks the invariant instead: leaderboard ordered by
  composite, harmony varies and does not saturate.
- Browser checks against Sleeper (local build, McTwerkface):
  - Weeks 1–8: opponent, final score/result and dates all match Sleeper
    (e.g. W1 W 156.76–104.24 vs KirTeaBaggers; W3 L 102.20–148.22 vs The Squeal
    Queens; W6 vs FantaCTE, 88.56 proj = 127.15 minus St. Brown and Chase Brown
    on bye).
  - Bye weeks: 15/15 roster players and 196/196 board rows correct.
  - Standings: all 12 teams' order, record and PF match.
  - Competitor cards: 12/12 match current rosters exactly.
  - Marketplace no longer recommends dropping Rashee Rice (KC bye week 5).
  - Network: before sign-in no Sleeper user/league requests; one sync about 40
    requests (was about 75); idle 2 minutes 17 requests, no projections or picks
    (was 207 requests, ~4.5 MB/min).
  - All tabs, filters, sorts, toggles, slider, settings and mock↔live work
    with no console errors.
