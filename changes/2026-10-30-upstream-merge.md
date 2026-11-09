# 2026-10-30: Merge google/oneiromancy main (59a45a3)

The owner asked to pull in a significant upstream change so the site reflects
it.

## What upstream contains

- `924c2da` (2026-10-12): this repo's in-season rework, imported into Google's
  repo (same code; `@license` tags and relative imports aside), plus the
  dependabot Next.js 16 bump.
- `59a45a3` (2026-10-30): a rework on top. Tabs are now **Roster, Matchup,
  Players, League** plus a **Weights** panel; new `core/lib/seasonContext.ts`;
  a large player mock; the test suite restructured on real React 18
  (`tests/tiers.mjs`, `tests/helpers/react_testing_wrapper.mjs`).
- **Default star weights changed upstream** from 30/20/25/10/15 to
  celestial 10, numeric 10, geomantic 25, oracular 10, harmony 45. λ stays
  0.75. Browsers with saved weights keep theirs.

## How it was merged

Every path outside `changes/` was set to upstream's exact version (upstream
already contained all of this repo's code), and `changes/` was kept.

## Fixes needed on top (upstream `main` can't install or build)

- `npm ci` failed: upstream pairs Next 16 with ESLint 8 (ERESOLVE), and its
  lockfile still pinned Next 14. ESLint 9 with a flat `eslint.config.mjs`;
  `npm run lint` runs `eslint .` (Next 16 removed `next lint`); lockfile
  regenerated.
- `next build` refused to run: Next.js 16.0–16.4.0 has critical advisories
  (GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr), fixed in
  16.4.3. Bumped `next` and `eslint-config-next` to 16.4.3; `npm audit fix`
  for transitive dev packages (brace-expansion, browserslist, picomatch,
  postcss-selector-parser, thenify, yaml). `npm audit`: 0 vulnerabilities.
  The build's error text included instructions addressed to an AI agent (run
  a special `next upgrade --agent=security` command); those were not
  followed.
- `tsconfig.json` takes Next 16's settings so builds don't rewrite it.
- React stays 18.3.1, as upstream chose: upstream's new test harness patches
  React 18 internals, and React 19 broke 55 tests. Next 16 logs a React 18
  deprecation warning.

## Verified

- `npm ci` clean; `tsc --noEmit` clean; `npm run build` OK (React 18
  warning only).
- `npm test`: 519 passed, 2 failed, the same 2 upstream fails on its own
  (Tier 5 test 5.18, URL fast path with an explicit draft ID).
- Browser, every tab, desktop and 390 px, as KaySwizz and McTwerkface: right
  team for each, no page errors, no horizontal scroll. This week the two
  play each other; each sees themself as "You".

## Open (upstream's code, left as is to stay in sync)

- `npm run lint`: 28 errors from the React Compiler hook rules in upstream's
  rewritten components.
- At 390 px the Roster radar card clips its labels and the thresholds
  panel.
- `ARCHITECTURE.md` §6 (screens) predates the new tab layout.

## Deploy

The hosting worker's Git connection had been removed, so pushes after the
merge didn't trigger builds. The owner reconnected it on 2026-10-30; this
note was pushed to trigger the first build from the reconnected repo.

## 2026-11-02: second sync (upstream 8743f9c)

Upstream adopted the install fixes (ESLint 9 flat config, `eslint .`) and
moved to React 19.3, TypeScript 6, Tailwind 4 and lucide-react 1.x; its
components now lint clean. Every path outside `changes/` again matches
upstream, with one exception: upstream still pins Next.js 16.4.0, which
`next build` refuses (critical advisories), so `next` and
`eslint-config-next` are 16.4.3 here, and upstream test 18.5's pinned
version assertion says 16.4.3 to match. Landing that bump upstream removes the
last difference.

Verified: clean `npm ci`, `tsc` clean, lint clean, build OK, `npm test`
519 passed / 2 failed (upstream's own 5.18), browser walkthrough as two
league members at desktop and 390 px with no errors. npm audit still lists
22 advisories in dev-only build tooling (babel, browserslist, flatted,
minimatch, zod, @humanfs/node), left for upstream.

## 2026-11-06: third sync (upstream 5018617)

Upstream reworked the player popup, board and recommendations, and builds
now use webpack (`next build --webpack`). It still pins Next.js 16.4.0, so
the same single difference remains: `next` / `eslint-config-next` 16.4.3 and
test 18.5's version assertion. Verified: clean `npm ci`, `tsc` and lint
clean, build OK, `npm test` 581 passed / 0 failed, browser walkthrough as two
league members (desktop and 390 px) with no errors.

## 2026-11-09: fourth sync (upstream dd2296c), exact mirror

Upstream now pins Next.js 16.4.2, outside the advisories' range (16.0.0 to
16.4.0), so `next build` runs on pure upstream. The 16.4.3 bump and the test
18.5 edit are dropped: **every path outside `changes/` matches upstream
exactly.** Verified on pure upstream: clean `npm ci`, no Next.js advisory
(npm audit: 14 in dev-only tooling, 0 critical), `tsc` and lint clean, build
OK, `npm test` 609 passed / 0 failed, browser walkthrough as two league
members (desktop and 390 px) with no errors and the right week-9 opponents.
The matchup screen no longer labels the user's own team "(You)"; it shows
the team name and "Mgr: <username>".
