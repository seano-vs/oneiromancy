# Decision log

Product and architecture decisions, newest first. **Owner** means the
repository owner decided it; **agent** means an agent chose it while doing the
work. Owner decisions override agent decisions. A **superseded** row stays for
history, with a pointer to what replaced it. Before changing anything listed as
an owner decision, ask.

| # | Date | Decision | By | Status | Details |
| --- | --- | --- | --- | --- | --- |
| 32 | 2026-10-11 | Lineup, waiver and trade advice share one best lineup; players whose game has kicked off are never moved; the slot Sleeper resolves from the username always identifies "you" | agent (owner: "use a friend's username… exhaustive analysis") | current | [second-user audit](2026-10-11-second-user-audit.md) |
| 31 | 2026-10-11 | **One vocabulary**: Stats, Spirit, Stars, Oracle, and the legend's four verdicts, the same on every screen. Every explainer matches the real formula (Stars rows sum to the score, Harmony = 50 + trine + stacks + balance), and numbers that aren't in any score are removed | **owner** ("make sure our wording is consistent") | current | [ux-rework § wording pass](2026-10-10-ux-rework.md) |
| 30 | 2026-10-11 | The Oracle panel always shows the star weights and the astrology reference expanded (no disclosure) | **owner** | current | [ux-rework § small cleanups](2026-10-10-ux-rework.md) |
| 29 | 2026-10-11 | **No bench penalty.** A player's weekly favorability / Stars is always scored as a starter (+8), never −6 for sitting on the bench, so it never depends on the lineup slot. Applies to the matchup detail cards, board favorability and matchup recompute | **owner** | current | [validation pass § findings](2026-10-11-validation-pass.md) |
| 28 | 2026-10-11 | Waivers and Trades cards use the original Marketplace look (colored columns, tags, stat tiles incl. weekly Stars) on the Stats/Stars/Oracle numbers; no repeated summary text under You give / You get | **owner** | current | [ux-rework § Marketplace look](2026-10-10-ux-rework.md) |
| 27 | 2026-10-11 | Never show a constant placeholder for a celestial value; hide the line when the data has none (past-week "Astral Alignment") | agent | current | [validation pass](2026-10-11-validation-pass.md) |
| 26 | 2026-10-11 | Run tiers 1–4 again (register the loader before dynamic imports). Update tests pinned to the old UI to current behavior, marking removed features `REMOVED:`. Never skip or delete a test | agent (on the owner's "revisit our tests") | current | [validation pass](2026-10-11-validation-pass.md) |
| 25 | 2026-10-11 | Restore original visual details the rework dropped: glowing active-tab bar and status dot, "Divination Spotlight Pick", "Active Transits & Conjunctions" | agent, following #20 | current | [validation pass](2026-10-11-validation-pass.md) |
| 24 | 2026-10-11 | λ presets are symmetric around the default: 0, 1 − default, default, 1 | agent, following #22 | current | [ux-rework § Divination Equilibrium](2026-10-10-ux-rework.md) |
| 23 | 2026-10-11 | Player popup pillars show the owner's live weights, not fixed 30/25/20/15/10 | owner flagged | current | same |
| 22 | 2026-10-11 | **Default λ is 0.75** (upstream shipped 0.35). Star weights stay at 30/25/20/15/10 ("carefully determined") | **owner** | current | [ux-rework § default λ](2026-10-10-ux-rework.md) |
| 21 | 2026-10-11 | This Week leads with the Team Celestial Telemetry; the "Weekly Matchup & Start/Sit Oracle" card is removed as redundant | **owner** | current | [ux-rework § This Week](2026-10-10-ux-rework.md) |
| 20 | 2026-10-11 | **League shows the original Celestial Leaderboard** (Overall / Spirit / Draft / Harmony, colored chips). Keep the owner's original celestial screens; don't restyle them unasked | **owner** | current; supersedes #17 | [ux-rework § leaderboard](2026-10-10-ux-rework.md) |
| 19 | 2026-10-11 | Every number on screen is explained where it appears | **owner** ("what is an Oracle number?") | current | guidelines |
| 18 | 2026-10-11 | Clicking a name in an "X over Y" recommendation opens a head-to-head popup. Own players compare with "your other {POS}s", never themselves. Headshots and logos only on the player directory and popup ("don't overdo it") | **owner** | current | [ux-rework § headshots](2026-10-10-ux-rework.md) |
| 17 | 2026-10-11 | League opens on "Oracle rankings" of every lineup | agent, after the owner rejected standings | **superseded by #20** | — |
| 16 | 2026-10-11 | **Never default a view to what the Sleeper app already shows** (standings, records, raw projections). The value is the owner's scoring metrics | **owner** | current | guidelines (mission) |
| 15 | 2026-10-11 | **The chaos dial is a control, not decoration.** The star weights must change Spirit, Stars, Oracle and rankings, and λ and weights persist across reloads | **owner** | current | [ux-rework § mission](2026-10-10-ux-rework.md) |
| 14 | 2026-10-11 | Mock mode never fills in, saves or syncs a username, and never looks connected | **owner** | current | [ux-rework § welcome](2026-10-10-ux-rework.md) |
| 13 | 2026-10-11 | Welcome screen highlights "Enter your Sleeper username"; polling-frequency options and the fake "Engine Calibration" box are removed | **owner** | current | same |
| 12 | 2026-10-10 | **Stars and Oracle are part of every player value**; never projections alone. Rank and compare by Oracle | **owner** | current | guideline 10 |
| 11 | 2026-10-10 | **The app is read-only.** No buttons or links that act in Sleeper | **owner** | current | guideline 7 |
| 10 | 2026-10-10 | Matchup Astral Favorability = mean of this week's starters' Stars (was whole-roster season Spirit, overwritten on one side only) | agent (owner flagged identical numbers) | current | [ux-rework § telemetry](2026-10-10-ux-rework.md) |
| 9 | 2026-10-10 | League opens on Sleeper standings | agent | **superseded by #16, #20** | — |
| 8 | 2026-10-10 | Four tabs (This Week, Waivers, Trades, League) replace seven; old ids alias | agent (owner approved the review) | current | [ux-rework](2026-10-10-ux-rework.md) |
| 7 | 2026-10-10 | Stats / Stars / Oracle model with one λ, set in one Oracle panel; one tone scale | agent (owner approved the review) | current | same |
| 6 | 2026-10-10 | Recommendations honor the league: depth, superflex, byes, injuries; never drop a starter | agent | current | [oracle.ts](../core/lib/oracle.ts) |
| 5 | 2026-10-10 | Starters come from the current week's matchup; byes, dates, opponents and scores from real Sleeper data | agent | current | [live-site fixes](2026-10-10-live-site-fixes.md) |
| 4 | 2026-10-10 | Mystical names stay as eyebrows, with plain titles | agent (owner liked the voice) | current | guideline 14 |
| 3 | 2026-10-10 | Deploy the static export to a static-assets cloud host via CI builds on push | owner request | current | [private copy](2026-10-10-private-copy-build-fixes-cloud-deploy.md) |
| 2 | 2026-10-10 | Private copy of google/oneiromancy; never push upstream | **owner** | current | same |
| 1 | 2026-10-10 | Don't fix the test loader unless asked | **owner** | **resolved by #26**: the loader was fine; the test files' import order was the bug | — |
