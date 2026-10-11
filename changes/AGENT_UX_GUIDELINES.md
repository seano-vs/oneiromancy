# Agent guidelines: building Oneiromancy without the old traps

Read this before changing anything user-facing in this repo. It distills two
audits of the live app (`2026-10-10-live-site-audit.md` and
`2026-10-10-ux-review.html`). Each rule exists because the app once broke it.

## The mission (from the owner; this overrides everything else here)

> "This apps job is to tell me an overall players advantage based on the
> scoring metrics WE set. Stop defaulting to what you think is best and stick
> to my mission."
>
> "When I go to the league page, it defaults to standings. I CAN ALREADY SEE
> THIS INFORMATION ON THE SLEEPER APP. THIS PROVIDES ME LESS VALUE THEN JUST
> GOING TO THE APP ITSELF."
>
> "The chaos gauge or whatever it's called isn't there for aesthetics."

What that means in practice:

- **The value is the owner's scoring model, not Sleeper's data.** The model
  is the Oracle: Stats and Stars blended by the chaos λ, with Stars shaped
  by the owner's star weights (the chaos dial). Every player and every team
  is judged by it.
- **The chaos dial is a control, not decoration.** λ and the star weights
  must change what the app ranks and recommends, and they must persist
  across syncs and reloads. If moving them changes nothing on a screen, that
  screen is broken. (This happened: the weights were saved but never
  applied, and a reload reset them. Test it in a browser every time.)
- **Never default a view to something Sleeper already shows** (standings,
  records, points for, raw projections, the schedule). Sleeper data may
  appear as small, secondary context next to the Oracle rating, never as
  the headline, the default tab, or the sort order.
- **The defaults are the owner's, not yours.** The default λ is **0.75**
  (owner's call; upstream shipped 0.35). The default star weights are
  Celestial 0.30, Numeric 0.20, Geomantic 0.25, Oracular 0.10, Harmony 0.15
  ("carefully determined"). Never change either without being asked. Read
  them from `DEFAULT_CHAOS_LAMBDA` and `DEFAULT_ORACLE_WEIGHTS` in
  `core/lib/scoring.ts`; never hard-code a λ.
- **Don't substitute your own product judgment for the mission.** When a
  design choice is unclear, choose the option that puts the owner's metrics
  first. "Users expect standings" or "projections are what people know" are
  not reasons; ask instead of guessing.

## The product in one sentence

Oneiromancy rates every player and team by the owner's own scoring model
(the Oracle) so a Sleeper manager can **acquire and position players** by
it. In season, every screen must serve one of the manager's four weekly
calls, each answered in Oracle terms:

1. **Who do I start?** (positioning: lineup by Oracle)
2. **Who do I add or drop?** (acquiring: waivers by Oracle gain)
3. **Who do I trade with?** (acquiring: trades by mutual Oracle gain)
4. **Where do I stand?** (every team's lineup rated by Oracle, not the
   Sleeper standings)

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
   Loading the mock never fills in, saves or syncs a username (no persona
   such as "OneiroVanguard" in the input or in storage). While the mock is
   showing, nothing that implies a connection may appear: no "Found N
   leagues", no profile, no league picked in the selector, and no
   auto-update switch turned on. Without a real account, the way out is
   "Connect your Sleeper account", not "Back to live league".

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
    **Never present a player's value as projections alone.** This is a
    celestial app first: wherever a player is valued, compared, ranked or
    traded (trades, waivers, league rosters, lineup checks), show Stars and
    Oracle alongside Stats, and rank or compare by Oracle, never by
    projected points. Gains are stated in Oracle points ("+12.4 Oracle"),
    with points and Stars as supporting detail. Projected points standing
    alone as "value" is a bug. Team scoreboards (projected and live game
    scores) are results, not player value, and may show points, but pair
    them with the team's Stars when there's room.
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
- [ ] Each new recommendation answers one of the four weekly calls and names
      a concrete move (players, slot, reason) without acting on Sleeper.
- [ ] Every player value shown carries Stars and Oracle, and every ranking
      or "would start" comparison uses Oracle, not projected points.
- [ ] No screen or tab defaults to information the Sleeper app already shows.
- [ ] Moving λ and a star weight in the Oracle panel visibly changes the
      ratings and order on every screen you touched (checked in a browser).
- [ ] A `changes/` entry records what changed, why, and how it was verified.
