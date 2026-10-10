# 2026-10-10: Live site audit (one.seance.sh, user McTwerkface)

## Method

- Drove https://one.seance.sh in headless Chromium (Playwright) at desktop
  (1440×900) and mobile (390×844). Set the Sleeper username to `McTwerkface`,
  synced, then visited every tab and clicked every button, filter, sort, toggle,
  slider, modal and expander.
- Pulled ground truth directly from Sleeper's API at the same time:
  user, leagues, league, users, rosters, draft, all 180 picks, matchups for
  weeks 1–7, week-5 projections, the full player dictionary, and the 2026 NFL
  schedule (used to derive bye weeks).
- Compared every rendered data point that has a real-world source against that
  data with scripts. Astrology-derived values (spirit score, tarot, elements,
  favorability) have no ground truth, so I checked them only for internal
  consistency.

League under test: **Toxic Trash Talkers** (`1378157554336559104`), 12-team
dynasty superflex PPR with 6-pt passing TDs, 2026 week 5 in progress. McTwerkface is
roster 2, **ASStrologians**, draft slot 7, 2-2, 520.74 PF.

## What is correct

- User and league resolution, league selector (one league, correct name).
- Current-week matchup: opponent **toots n' scoots** (gagagoblin), matchup #6.
- Week-5 projections in league scoring: **127.15 vs 121.21**, exact match.
  Every starter and bench player's projection matches to 0.1.
- Roster: all 8 starters in the right slots and all 7 bench players; team, position and
  injury badges (Rice Q, Douglas Out, Jacobs NA) match Sleeper.
- Player Board: all 196 "available" players really are unrostered; every
  team and week-5 projection matches. Filters, search, sort all work and
  counts are consistent (QB 40, RB 108, WR 164, TE 102).
- Leaderboard draft slots match `slot_to_roster_id` for all 12 teams.
- Draft picks: 179 of 180 shown exactly right (team, round, pick no., player).
- Scoring Model formula: 0.65×99.0 + 0.35×62.9 = 86.4 ✓; slider at 0 and 1
  gives 99.0 and 62.9 ✓.
- Mock ↔ Live switching works; username persists across reload.
- No JavaScript errors or console errors during any interaction.
- Mobile: no horizontal page overflow on any tab.

## Problems found

Severity: **High** = wrong real-world data or advice, **Medium** = misleading or
internally inconsistent, **Low** = cosmetic or wasteful.

### High

1. **Bye weeks are fabricated.** `bye_week: 7 + (absHash % 8)` in
   `core/lib/sleeper.ts:2150` hashes the player ID. 179/196 board rows and all
   15 of your roster's bye weeks are wrong; teammates disagree with each other
   (Winston NYG bye 12, Fields NYG bye 13, Likely NYG bye 10; real NYG bye is 8).
   Real 2026 byes for your teams: NYG 8, IND 13, CIN 6, DET 6, DAL 14, PIT 9,
   KC 5, NYJ 13, MIA 6, CHI 10, GB 11, ATL 11.
   Knock-on: the **18-Week Bye Coverage matrix** is entirely wrong (flags week
   7/10 conflicts that don't exist; misses the real week-6 DET/CIN/MIA and
   week-8 NYG holes).

2. **Season schedule is invented.** Only `matchups/<current week>` is fetched;
   every other week's opponent comes from a generic round-robin
   (`getDeterministicMatchupOpponentSlot`, `core/lib/sleeper.ts:2372`).

   | Week | App opponent | Real opponent | Real result |
   |---|---|---|---|
   | 1 | KirTeaBaggers ✓ | KirTeaBaggers | W 156.76–104.24 |
   | 2 | BakchodLaunde ✓ | BakchodLaunde | L 107.62–138.54 |
   | 3 | HotMulligan ✗ | The Squeal Queens | L 102.20–148.22 |
   | 4 | SlayEmMayhem ✗ | Skwheel Kweenz | W 154.16–115.74 |
   | 6 | SlayEmMayhem ✗ | FantaCTE Football Team | — |
   | 7 | The Wheezing Warriors ✗ | Neel before me | — |

3. **Completed weeks never show results.** Weeks 1–4 show the week-5
   projection (127.15) and a win probability instead of the final score.
   Week 1 shows "42.4% SLIGHT DOG" with a 127 vs 95 projection; you actually
   won by 52.

4. **Waiver advice drops players for being on bye.** The Marketplace ranks
   drops by this week's projection only, so Rashee Rice (0.0 because KC is on
   bye in week 5, while the app says his bye is week 9) is a recommended drop
   for Greg Dulcich. Tua Tagovailoa is a recommended drop for the same reason.
   "Proj PPG 8.7 (8.7 tot)" shows the season total equal to one week.

5. **Competitor "rosters" are the draft board, not current rosters.** 52
   players have moved since the draft. Your own card lists Jerry Jeudy, Geno
   Smith, Isiah Pacheco (gone) and omits Winston, Fields, Ferguson, Douglas,
   Raymond, contradicting "Your Team's Active Roster Slots" on the same page.

### Medium

6. **Dates are hard-coded to 2025** (`core/lib/sleeper.ts:2507`). Week 5 shows
   "Oct 2 – Oct 6, 2025"; it is Oct 8–12, 2026.
7. **Harmony is saturated.** 9 of 12 teams show 100% team harmony and both
   matchup teams show 100.0/100. `computeRosterHarmony`
   (`core/lib/scoring.ts:596`) adds bonuses with no adjustment for team size
   (stack bonuses are counted from each player's side), so a 15-man roster
   clamps at 100. It feeds 30% of every team's overall score. (Live sync was switched
   to this function in commit `1c43c64`, replacing a flat 50.)
8. **Tier labels contradict their legends.**
   - Team legend: 3 tiers at 85 / 75; code (`core/lib/scoring.ts:1044`):
     4 tiers at 85 / 80 / 70 (its comment says 90). SlayEmMayhem spirit 73.0
     is "Harmonic"; "Volatile (Flux)" isn't in the legend.
   - Weekly favorability legend: ≥84 / 75–83 / <75, but players are labelled
     "NEUTRAL" (not in legend). Cade Otton's 75 shows as "CHG" on the board,
     "Challenged Transit" in the spotlight, "NEUTRAL" in the modal; the legend
     says 75 is "Astrally Favored".
9. **"Standings" leaderboard ignores standings.** No W-L or points anywhere;
   BakchodLaunde (4-0, the only unbeaten) ranks 10th.
10. **Live scores are ignored.** Week 5 is in progress (you lead 19.1–0.0);
    the app shows only projections.
11. **Draft-mode leftovers after the draft is complete.** Player Board
    "Divination Spotlight: Round 15 Target"; ADP is a constant 50.0 for every
    player.
12. **"NFL Standard Proj … Half-PPR Baseline"** in the player modal is
    actually full-PPR (Otton 8.65 = `pts_ppr`; half-PPR is 6.86).
13. **Placeholder data looks live before you sign in.** On first load,
    before any username, the header reads "LIVE • RD 5 PK 49" over mock data
    and requests real Sleeper users `OneiroVanguard`/`OneiroVangard`, league
    `9000000000000000001`, and two fake avatar IDs (blocked by the browser).
14. **"Divine Swaps (0)" is always empty in live mode**: live sync sets
    `trade_proposals: []` (`core/lib/sleeper.ts:5706`, `:6085`).

### Low

15. **Polling storm.** With the draft complete and the tab idle, the page made
    207 Sleeper requests in 2 minutes: 6 endpoints about every 4 s (config says
    10 s idle, suggesting duplicate pollers), plus the 572 KB projections file
    and the 77 KB draft picks about every 8 s (~4.5 MB/min). A single sync sends 3–9
    copies of each request, and the first sync aborted many of them.
16. Player modal doesn't close on Escape.
17. In Mock mode the Live button reads "Live (OneiroVanguard)" instead of the
    saved username.
18. Travis Hunter shown as WR; Sleeper lists him as DB (unknown positions fall
    back to WR in `synthesizeCosmicPlayerFromId`).
19. Reference guide calls the planetary rulers "classical" but lists the
    modern ones (Pluto/Scorpio, Uranus/Aquarius, Neptune/Pisces).

## Suggested fix order

1. Bye weeks from the real schedule (`/schedule/nfl/regular/<season>`), which
   fixes the bye matrix, board, modals and waiver logic in one place.
2. Fetch `matchups/1..N` for real opponents and results; derive week dates
   from the schedule.
3. Competitor cards and team scores from `rosters`, not `picks`, once the
   draft is complete.
4. Waiver advice: use rest-of-season value, skip players whose team is on bye.
5. Normalize `computeRosterHarmony` by roster size; align tier cutoffs and
   labels with their legends.
6. Stop polling when the draft is complete (or poll matchups only, slowly) and
   dedupe concurrent syncs.
