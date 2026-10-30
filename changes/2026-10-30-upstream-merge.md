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
