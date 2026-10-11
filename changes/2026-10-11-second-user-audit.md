# 2026-10-11: Audit as a second user (KaySwizz)

The owner asked for an exhaustive look at what the app shows a friend,
logging in as **KaySwizz** (roster 3, "SlayEmMayhem", draft slot 1, same
league). Every screen was captured in a browser (desktop and 390 px) and
checked against Sleeper's API: league, rosters, users, matchups weeks 1–6,
week-5 projections, the NFL schedule and the draft.

## What was right

- Player list: all 50 rows checked match Sleeper's projection and bye week;
  ownership labels (Yours / Rostered / Free agent) are correct.
- League: all 12 teams' starters, benches, records and points-for match.
- Trades: every card's record, "your bench" / "their starter" placement and
  replaced player match the rosters.
- Past matchups weeks 1–4: opponents and scores match.
- One Spirit / Stars / Oracle per player across screens (0 of 15 roster and 0
  of 30 matchup mismatches), and after changing λ and weights.
- No page errors; no horizontal scroll at 390 px.

## Found and fixed

| # | Problem | Fix |
| --- | --- | --- |
| 1 | **Every user except draft slot 7 saw McTwerkface's team as their own.** On the first sync the context guessed slot 7 (the mock default) and let the guess override the slot Sleeper resolved from the username. The owner is slot 7, so it never showed for him | The resolved slot wins; the guess is only a fallback. The resolved slot is saved. Verified: fresh login, switching users, reload |
| 2 | "Start Malik Willis over Christian Watson" labeled **Flex**: a QB can't play Flex. The real move is Willis into Superflex, Olave to Flex, Watson to the bench | The swap names the slot the new player takes and who moves where ("Chris Olave moves to Flex") |
| 3 | Waivers said Cade Otton "would start for you at TE" while the lineup card started Loveland there (Loveland outscores Otton). Trades did the same ("starts over your Harold Fannin") | One `optimalLineup` behind lineup check, waivers and your side of trades |
| 4 | Recommended adding Cade Otton, whose game (TB, Thursday) was already over. Lineup advice could likewise move players whose game had started | Game status per team from Sleeper's schedule (refreshed every 5 min). Locked players are never swapped, added or dropped |
| 5 | The projected total used max(actual, projection) even for **finished** games, so a player who scored below projection (or 0) kept his projection | Finished games count only the actual score; in-progress games keep max(actual, projection) |
| 6 | Players on bye (all of KC and CAR in week 5) read "6th House affliction: no projection this week" | "🌑 Fallow week: … is on bye (−22 Stars)" |
| 7 | The Squad Harmony stack panel listed a bench stack (Caleb Williams + Loveland, "+18 Harmony") that the score (62) doesn't count | Stacks come from starters only, like the score; an empty state says "No QB stacks among your starters" |
| 8 | Bye cards with one or two players on bye said "OK", contradicting their explainer | They say "BYE" (amber); the explainer matches |

Tests: Tier 10 10.9.1–10.9.3 (Superflex move, waiver vs best lineup, locked
players); 28.7 updated for the slot rule. npm test: 465 passed.

## Owner follow-up: real games, Harmony as %, roster-specific text

The owner chose: "real kickoff times", "let's do %", and fix the same-for-
everyone text.

- **Real games on matchup cards** (`core/lib/nflGames.ts`). Kickoff, venue and
  opponent come from ESPN's public scoreboard (CORS-open), fetched for every
  regular-season week once per session (the current week refreshes every 5
  minutes). Without ESPN, cards fall back to Sleeper's date and the home team's
  stadium with "time TBA". Road games show the home stadium; neutral sites show
  the real venue (PHI–JAX: Tottenham Hotspur Stadium, London, 9:30 AM ET). Bye
  players show "No game this week". Kickoffs read "Sun, Oct 11 · 1:00 PM ET · @ GB".
- **Moon** is computed for the kickoff (phase plus sign, low-precision
  ephemeris; checked against the 2024-04-08 eclipse, New Moon in Aries). The
  **planetary hour** is computed from the kickoff and the venue's longitude
  (Chaldean order, 12 equal hours from 6:00 solar time, an approximation).
  Everyone in the same game now shares both. Coordinates show N/S/E/W
  correctly and hide when unknown. Sample (mock) data keeps the illustrative
  values. Stars are unchanged: venue never fed the score.
- ESPN returns 403 to headless browsers ("HeadlessChrome"), so automated QA
  must use a normal user agent; real visitors are unaffected.
- **Harmony is a percentage everywhere** ("62%"): header, telemetry, deltas,
  bonus chips, explainer, stack badges, player popup and draft pick hero.
- **Roster-specific text.** "Fire & Air Kinetic Combustion" appears only when
  the starting QB is Fire with Air pass catchers, and names them; otherwise
  the card lists the QB's complementary / same / opposed targets. "Earth
  Bedrock" names the starting Earth RBs (or says there are none). The aspect
  reader shows the aspect between the starters' two leading elements
  (Sextile 60° complementary, Square 90° in tension, Conjunction 0° single).

Tests: Tier 10 10.10.1–10.10.5; 20.4 and 21.6 updated for %. npm test: 471
passed. Verified in the browser for KaySwizz and McTwerkface.

## Open (owner's call)

- **Leaderboard tier chip** follows average Spirit, so 9 of 12 teams (including
  #1) read "Discordant (At Risk)".
