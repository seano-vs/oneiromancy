# Lessons learned

Mistakes made (and caught) while building this copy of Oneiromancy, and the
habit that prevents each one. Read this before changing anything.
`AGENT_UX_GUIDELINES.md` says *what* the app must do; this file says *how
things went wrong* getting there. Each lesson names the incident so you can
find it in the logs.

## Working with the owner

1. **Never change an owner default unasked.** λ drifted from the owner's 0.75
   to 0.35 at some point and nobody noticed until the owner did. The star
   weights (30/25/20/15/10) were "carefully determined". Defaults live in
   `scoring.ts` and are pinned by Tier 10 test 10.1.1. *(DECISIONS #22)*
2. **"Stop defaulting to what you think is best."** A restyled leaderboard
   and a "cleaner" Marketplace were both rolled back because the owner
   preferred the originals. Improve the owner's screens in place; don't
   replace them. *(DECISIONS #20, #28)*
3. **Short replies answer your last list, in order.** "Yeah, real kickoff
   times. Let's do %. Yeah, same text" mapped one-to-one onto the three open
   items. Do what is clearly asked, and say what you left alone (the tier
   labels weren't mentioned, so they stayed).

## Test as someone other than the owner

4. **A default that equals the owner's value hides bugs.** Every user except
   draft slot 7 saw the owner's team as their own, because the app's fallback
   slot was 7 and the owner *is* slot 7. It took logging in as a friend
   (KaySwizz) to see it. Always check a second, non-default user: fresh
   login, switching users, and a reload. *(second-user audit #1)*
5. **Check that tests actually run.** Tiers 1–4 silently ran zero tests for
   a long time: static imports executed before the TypeScript loader was
   registered. Look at the per-tier counts in `npm test`, not just "PASSED".
   *(DECISIONS #26)*
6. **A new test must fail on the old code.** Test 7.1 (one Spirit per player)
   passed with and without the fix, because the test fixtures don't
   reproduce the live sync path. Run every new test against `git show
   HEAD:<file>` before trusting it, and say so when it can't catch the bug.
7. **String tests pin old UI; update them, never skip them.** Add a comment
   with the date and reason; mark removed features `REMOVED:`.

## One source of truth per number

8. **A cached copy will drift.** The same player showed Stars 62 in one place
   and 60 in another (the popup read the cached `favorability_score`), and
   Spirit differed between the roster and the player list (the sync handler
   blended the harmony pillar a second time, on the list only). Compute
   display values with the one function (`starsScore`, `oracleScore`), and
   when you change a number, find every copy of it. *(ux-rework § "one Stars
   number"; DECISIONS #32)*
9. **Probe the real app state, not just the screen.** The React fiber walk in
   the QA scripts (find `memoizedProps.value.draftState`) compares every copy
   of a player across `cosmic_board`, `my_roster` and `weekly_matchup`. It
   found 15/15 and 30/30 mismatches the screens only hinted at.
10. **Recommendations must share one lineup.** Lineup check said "start
    Loveland at TE" while Waivers said Otton "would start at TE" and Trades
    said a player "starts over" someone already being benched. All three now
    judge against `optimalLineup`. Any new advice must too.
11. **Don't borrow a label from a fallback.** "Start Malik Willis over
    Christian Watson" was labeled Flex because the code paired Willis with any
    benched starter and reused that slot's name; a QB can't play Flex. When a
    move is a chain (QB into Superflex, WR down to Flex), say so.

## Real-world data

12. **Never invent real-world facts.** Kickoff times came from a fixed list,
    venues were always the home stadium (wrong for road games and for London),
    and moon phases differed between players in the same game. If the primary
    source lacks a field, find a real one (ESPN's scoreboard has kickoffs and
    venues) or show "TBA". Synthetic celestial values are fine, but the same
    game or day must give the same value. *(DECISIONS #33)*
13. **Game days change everything.** Players lock at kickoff; finished games
    count actual points only; in-progress games are neither. The app
    suggested adding a player whose game had ended. Re-check recommendations
    while games are live, and refresh game status (5-minute TTL), not once a
    session.
14. **Verify against the source with a script, not by eye.** The ground-truth
    scripts (Sleeper API → `gt.json`, then a compare) checked hundreds of
    values per pass: projections, byes, records, starters, PF, results.
15. **Coincidences happen; recompute before calling it either way.**
    Identical Stars on both sides was a real bug once (one side overwritten,
    DECISIONS #10). Later, 72.2 vs 72.2 and 90% vs 90% were genuine: different
    players, 72.21 vs 72.20, and both teams earning the same three Harmony
    bonuses. Rebuild the number from its parts before answering.

## Copy

16. **Explainers must match the code.** "Schedule Symmetry" and "+27
    resonance ceiling" were described in the UI but never computed; the Stars
    breakdown rows didn't add up. Read the formula in the code before writing
    or editing any explainer, and check that the rows sum to the score.
17. **Vocabulary drifts unless enforced.** "Wk Fav", "Stars this week",
    "SpiritScore" and "weekly favorability" all meant two numbers. The app uses
    exactly Stats, Spirit, Stars, Oracle. *(DECISIONS #31)*
18. **Keep deployment wording vendor-neutral** in code and docs.

## QA mechanics (these cost real time)

19. **Know which site you're testing.** The QA scripts default to the live
    site; set `BASE=http://localhost:8787/` for local builds. One "fix
    didn't work" scare was simply the live site.
20. **Automated browsers get blocked.** ESPN returns 403 to `HeadlessChrome`,
    which looked like a CORS failure. The QA context sends a normal user agent
    and `sec-ch-ua`. Real visitors were never affected.
21. **The build is stricter than `tsc`.** ESLint errors (e.g. an unescaped
    `'` in JSX) fail `npm run build` and leave no `out/`; check the exit
    code. Restart `wrangler dev` after each rebuild or it serves stale files.
22. **Stop background processes by task id.** `pkill -f "wrangler dev"` also
    killed the shell running it.
23. **The build rewrites `next-env.d.ts`.** Restore it (`git checkout --
    next-env.d.ts`); never commit it.
24. **Confirm the deploy in the browser.** CI bundle hashes differ from local
    ones, and grepping minified bundles gave a false "updated". Load the live
    site and check for the new behavior.

## Before you say "done"

- `npx tsc --noEmit`, `npm test` (check tier counts), `npm run build` (exit 0).
- Browser check on the local build as **two users**, desktop and 390 px, no
  page errors.
- Values compared against Sleeper (and ESPN for game details) by script.
- `changes/`: a log entry, a `DECISIONS.md` row for any product decision,
  `ARCHITECTURE.md` if the current state changed, and a line here if you
  learned something the hard way.
- Push to `main` and the session branch, then confirm on the live site.
