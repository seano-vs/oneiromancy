# Agent guidelines: building Oneiromancy without the old traps

Read this before changing anything user-facing in this repo. It distills two
audits of the live app (`2026-10-10-live-site-audit.md` and
`2026-10-10-ux-review.html`). Each rule exists because the app once broke it.

## The product in one sentence

Oneiromancy helps a Sleeper fantasy football manager **acquire and position
players** using celestial standings. In season, every screen must serve one of
the manager's four weekly calls:

1. **Who do I start?** (positioning: lineup)
2. **Who do I add or drop?** (acquiring: waivers)
3. **Who do I trade with?** (acquiring: trades)
4. **Where do I stand?** (context: standings, matchups, byes)

If a feature doesn't help answer one of these, it doesn't ship, or it goes
behind a disclosure.

## 1. Data honesty

1. **Never fabricate real-world data.** Bye weeks, opponents, scores, dates,
   records, rosters, injuries and projections come from Sleeper
   (`/v1/...` and `/schedule/nfl/regular/<season>`). The app once derived bye
   weeks from a hash of the player ID, generated the schedule with a
   round-robin, and hard-coded 2025 dates. If real data is unavailable, show
   "—" or hide the element. Don't invent a plausible value.
2. **Celestial values may be synthetic; they may not be constant.** Elements,
   signs and tarot are the product's invention, which is fine. A sentence that
   reads the same for every team or player ("Jupiter Trine Mars (+14.2)",
   "High volume red-zone target share") is filler. Derive it from that
   entity's traits, or remove it.
3. **Mock mode is never mistaken for live.** Placeholder personas and league
   IDs must not reach Sleeper, and the UI must not say LIVE before an account
   is configured.
4. **Verify against the source.** After changing any data path, open the app
   with a real account and compare what's rendered with Sleeper's API with a
   script, not by eye.

## 2. Every screen ends in a decision

5. **Lead with the answer.** The first thing on a screen is what the manager
   should do, ranked by urgency. Explanations, legends and methodology go
   behind an info control or into the Oracle panel.
6. **Stars must reach the lineup.** A celestial score that never changes a
   start, add, drop or trade is decoration. When stats and stars disagree, say
   so in one sentence and let the λ dial break the tie.
7. **The app is read-only, by design.** It advises; it never acts on Sleeper.
   No buttons or links that set lineups, claim waivers or propose trades, and
   no "do it in Sleeper" calls to action. Every recommendation is still a
   concrete move: name both players, the slot, and the reason, so the manager
   can make the change themselves.
8. **Recommendations respect the league.** Lineup slots (FLEX, SUPER_FLEX),
   positional depth (superflex teams need QBs), byes, and injuries all apply.
   Never suggest dropping a player only because their team is on bye this
   week, and never suggest dropping a starter.
9. **Switch modes with the season.** Draft-only features (Path of Ascension,
   draft slots, DraftScore naming, "Round N target") hide once the draft is
   complete.

## 3. Few numbers, one meaning each

10. **Three numbers per player, everywhere:** **Stats** (this week's
    projection in league scoring), **Stars** (this week's favorability,
    0–100), and **Oracle** (their blend by λ; this drives every ranking).
    Everything else lives in the player drawer.
11. **One semantic color scale.** Green favored, amber neutral, red challenged,
    applied through one helper (`favorabilityTone` in `core/lib/oracle.ts`).
    A label must match the number it sits next to, which means classifying the
    rounded value that's displayed. The brand accent is never a status color.
12. **Legends match the UI exactly.** Every tier a component can render
    appears in its legend, with the same name, thresholds and color.
13. **Don't alarm about non-problems.** A first-place team never wears a red
    "At Risk" badge. Show celestial tiers on standings as quiet secondary
    information.

## 4. Copy

14. **Keep the voice, add the plain label.** Mystical names are the charm, so
    pair them with what the thing is: "Waivers · Alchemical Transmutations".
15. **Describe the user's task, never the implementation.** No subtitles like
    "High-density mobile data grid with instant search…".
16. **No unexplained abbreviations.** If "DS", "VOR" or "CHG" saves a few
    pixels on desktop, spell it out.
17. **Toggles say what they change.** "Suggest dropping players on an NFL
    roster", not "Allow signed players to swap for free agents".

## 5. Layout

18. **Say it once.** A recommendation appears once, with details on demand.
    One waiver suggestion is a ~140 px card, not a 900 px card that repeats
    the swap four times.
19. **Long lists paginate**, and tables keep a sticky header.
20. **One navigation.** Tabs on top for desktop, bottom bar on phones, never
    both. One sync indicator. IDs and mock mode live in Settings.
21. **Phone width is a requirement.** At 390 px the page must not scroll
    sideways, and names must not truncate while other space is spare.
    Measure `document.documentElement.scrollWidth`.
22. **Decoration never takes the first screen** of a working view.
23. **One vocabulary.** The factors behind Stars have the same names on every
    screen (Oracle panel, Matchups, player drawer).

## 6. Engineering hygiene that affects users

24. **Poll gently.** A completed draft polls at most once a minute. Cache
    large payloads (projections) and immutable ones (completed draft picks,
    finished weeks). Concurrent syncs share one request. Effects that schedule
    timers guard against running after cleanup.
25. **Labels match the math.** If a value is full-PPR, don't call it half-PPR.

## Definition of done for UI changes

- [ ] `npx tsc --noEmit` clean; `npm run build` passes; `npm test` no worse
      than baseline (see the latest `changes/` log).
- [ ] Opened in a real browser at **1440×900 and 390×844** with a real Sleeper
      account. Every changed control clicked; no console errors; no horizontal
      overflow.
- [ ] Rendered data compared with Sleeper's API by script where the change
      touches real-world data.
- [ ] Each new recommendation answers one of the four weekly calls and has an
      action.
- [ ] A `changes/` entry records what changed, why, and how it was verified.
