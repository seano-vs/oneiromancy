# 2026-10-10: Private copy, build fixes, and cloud deployment

> **Status (2026-10-11):** historical log. The deployment described here is current. The test baseline is not: tiers 1–4 now run and all 457 tests pass, because the "loader bug" was the test files' static imports running before the loader registration. See [`2026-10-11-validation-pass.md`](2026-10-11-validation-pass.md).

This log covers the work that turned this repository from an empty private repo
into a private copy of [google/oneiromancy](https://github.com/google/oneiromancy)
that builds from a clean install and deploys to a static-assets cloud host through
its CI build pipeline.

| Commit | Summary |
| --- | --- |
| `d446f7a`, `b7b9c82` | Upstream history (google/oneiromancy `main`), unchanged |
| `89580fa` | Fix malformed scoped-package `resolved` URLs in `package-lock.json` |
| `1c43c64` | Fix lint and type errors that break `next build` |
| `ebcfcb6` | Deploy the static export to a cloud host via CI builds |

## Goals

1. Keep a **private** copy of google/oneiromancy. GitHub can't make a private
   fork of a public repo, so this is a copy with upstream's history, not a fork.
   google/oneiromancy is read-only upstream and must never be pushed to.
2. Make `npm ci` succeed from a clean cache, which is what the cloud CI builder
   does.
3. Make `npm run build` (`next build` plus a static export to `out/`) pass.
4. Deploy `out/` to a static-assets cloud host through CI builds, without
   breaking the existing Docker and App Engine deployment paths.
5. Leave behavior and test results otherwise unchanged.

## Environment used for verification

- Node 22.22.0, npm 10.9.4. The CI build image defaults to Node 24; the
  build is expected to work on both, but only Node 22 was tested here.
- Every build check started from `npm ci --cache "$(mktemp -d)"`, so no cached
  tarball could hide a broken lockfile.
- fonts.googleapis.com was reachable, so `next/font` downloaded the real fonts.
  No `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` mock was needed or committed.
- wrangler 4.149.0, fetched with `npx`.

---

## Step 1: History

**What was done**

- Added `upstream` → `https://github.com/google/oneiromancy.git` and fetched.
- `origin/main` was already at upstream's `b7b9c82` (the 2 upstream commits),
  so there was no auto-generated initial commit to replace and no force-push
  was needed. Local `main` was reset to `upstream/main` and set to track
  `origin/main`.

**Decision: disable pushing to upstream.** The upstream remote's push URL was
set to `DISABLED` (`git remote set-url --push upstream DISABLED`), so an
accidental `git push upstream` fails locally instead of reaching Google's
repository. This setting is local to each clone, so set it again in any new
clone.

---

## Step 2: Lockfile (`89580fa`)

**Problem.** All 52 scoped packages in `package-lock.json` had `resolved` URLs
with the scope repeated in the tarball filename:

```
https://registry.npmjs.org/@scope/name/-/@scope/name-x.y.z.tgz   (404)
https://registry.npmjs.org/@scope/name/-/name-x.y.z.tgz          (correct)
```

Installs that use a warm npm cache can hide this, but a clean install, like
the host's, fails with 404s.

**Fix.**

```sh
sed -E -i 's#(registry\.npmjs\.org/(@[^/]+)/([^/"]+)/-/)\2/\3-#\1\3-#' package-lock.json
```

**Decision: rewrite only the URLs.** The lockfile was not regenerated with
`npm install`, which would also have moved dependency versions. The sed changes
only the malformed path segment, so the dependency tree stays exactly as
upstream pinned it, and `integrity` hashes stay valid because they hash the
tarball, not the URL.

**Verification.**

- `grep -c '/-/@' package-lock.json` → `0`.
- The diff is 52 insertions and 52 deletions, all on `"resolved"` lines.
- `npm ci --cache "$(mktemp -d)"` succeeds.

---

## Step 3: Build fixes (`1c43c64`)

Before this commit, `next build` stopped on one ESLint error, and after that,
`tsc` reported 11 type errors. Each fix below is the smallest change that
addresses the root cause.

### 3a. Rules-of-hooks violation in `PlayerDetailModal`

**Problem.** `components/modals/PlayerDetailModal.tsx` wrapped
`useOneiromancy()` in `try/catch` so the modal could render outside a
provider. ESLint's `react-hooks/rules-of-hooks` treats that as a conditional
hook call and fails the build.

**Fix.** Added `useOptionalOneiromancy()` to `context/OneiromancyContext.tsx`.
It returns `useContext(OneiromancyContext)`, which is `null` outside a
provider. The modal now calls it unconditionally.

**Why.** This keeps the modal's original intent (render with or without a
provider) and follows the hook rules. The modal's `ctx` also stops being
`any` and is now `OneiromancyContextValue | null`, so its uses are type-checked.

### 3b. Test ambient types leaking into the app

**Problem.** `tests/helpers/ambient.d.ts` declares a global `JSX` namespace.
Because `tsconfig.json` included `**/*.ts`, that declaration replaced React's
JSX types across the whole app. That caused the `Parameter 'e' implicitly has
an 'any' type` errors in `PlayerDetailModal`, `CosmicBoard` and
`SettingsDrawer`.

**Fix.** Added `"tests"` to `"exclude"` in `tsconfig.json`.

**Why.** The tests run through their own runner (`tests/e2e_runner.mjs`) and
don't depend on the app's `tsc` pass, so excluding them is the narrowest fix
and needs no changes to app components.

### 3c. Missing `DEFAULT_LIVE_SETTINGS` import (runtime bug)

**Problem.** The sync-failure handler in `OneiromancyContext.tsx` spreads
`DEFAULT_LIVE_SETTINGS`, which is exported from `core/lib/sleeper.ts` but was
never imported. Besides the type error, a failed live Sleeper sync would throw
a `ReferenceError` instead of falling back.

**Fix.** Imported it from `@/lib/sleeper`.

### 3d. Live-sync team reconciliation (runtime bug)

**Problem.** In live-sync team reconciliation, when a team had no resolved
picks, `pList` fell back to `t.players`, which are Sleeper player **ID
strings**, not `CosmicPlayer` objects:

- `p.spirit_score` and `p.draft_score` were `undefined` on strings, so the
  averages silently used the 78.0 and 76.0 defaults.
- `calculateHarmony(pList)` treats its argument as roster slots, so it
  returned a flat 50 for every team.

**Fix.**

- Resolve `t.players` against `recomputedBoard` the same way the picks just
  above are resolved (`String(cb.id) === String(id)`), keeping only players
  that are found.
- Score harmony with `computeRosterHarmony(pList)` from `@/lib/scoring`, which
  takes an array of players.

**Why.** This reuses the existing resolution pattern and scoring helper. If
none of a team's IDs resolve, `pList` is empty and the code falls back to the
team's stored `avg_spirit_score`, `avg_draft_score` and `harmony_score`, as it
already did for teams with no players.

**Behavior change:** competitor teams with no resolved picks now get real
spirit, draft and harmony scores from their rostered players instead of
constants.

### 3e. `weekly_matchup: null` vs. optional type

**Problem.** `DraftState.weekly_matchup` is declared optional
(`weekly_matchup?: WeeklyMatchup`), not nullable, but the sync-failure handler
assigned `null`.

**Fix.** Use `undefined` in the `reconciledMatchup` fallback and in the
`weekly_matchup` field of the not-yet-live branch.

**Why.** It matches the declared type. Every consumer reads the field with
optional chaining, so `undefined` and `null` behave the same at runtime.

### 3f. `MatchupsScreen` non-null assertion

**Problem.** `components/screens/MatchupsScreen.tsx` (around line 149) passed
`context.draftState!.competitor_teams` (`CompetitorTeam[] | undefined`) to
`deriveWeeklyMatchup`, which requires an array.

**Fix.** Added a non-null assertion: `competitor_teams!`.

**Why.** The surrounding `hasLiveTeams` check (`Array.isArray(...) &&
length > 0`) already guarantees the array exists. TypeScript can't carry that
narrowing through the optional chain, so the assertion only states what is
already checked.

### 3g. Generated files

- Added `*.tsbuildinfo` to `.gitignore` (`incremental: true` writes one).
- **Decision: do not commit `next-env.d.ts`.** `next build` regenerates it
  without upstream's license header. The upstream version was restored after
  every build and left untouched.

### Verification

- `npx tsc --noEmit`: clean.
- `npm run build`: passes. The only output left is the 4
  `react-hooks/exhaustive-deps` warnings that were already there
  (`CelestialLeaderboardGraph`, `MatchupsScreen`, and two in
  `PlayerMarketplace`). They were not touched.
- `npm test`: same as the baseline (see "Tests" below).

---

## Step 4: Cloud deployment (`ebcfcb6`)

### Approach

The app is a pure static export (`output: 'export'` in `next.config.mjs`), so
the deployment is **assets only**: no server script, no bindings. The host serves
`out/` directly from its asset storage.

### `wrangler.jsonc`

```jsonc
{
  "name": "oneiromancy",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./out",
    "not_found_handling": "single-page-application"
  }
}
```

- `name` must match the project's name in the hosting dashboard. The CI build uses it to pick the project to deploy.
- `not_found_handling: "single-page-application"` serves `index.html` for
  unmatched routes, the same fallback as the last handler in `app.yaml` and as
  `server.js`.
- **Decision: no `$schema` field.** The usual
  `node_modules/wrangler/config-schema.json` reference would point to a file
  that doesn't exist, because wrangler isn't installed locally (see below).

### `public/_headers`

```
/*
  X-Content-Type-Options: nosniff
```

`server.js` sets `X-Content-Type-Options: nosniff` on every response. Next
copies `public/` into `out/`, and the host reads `out/_headers` to apply the
same header. The host does not serve `_headers` as an asset (verified below).
Other hosts (Docker via `server.js`, App Engine) ignore the file.

### Wrangler is not a `package.json` dependency

**Decision.** Wrangler was deliberately **not** added to `devDependencies`.

**Why.** Wrangler depends on `workerd`, whose binary needs glibc 2.35, and its
postinstall step runs that binary. The `Dockerfile` builds on
`node:22-alpine` (musl), so adding wrangler would break `npm ci` in the Docker
build. `npx wrangler deploy`, which is the CI's default deploy command,
fetches wrangler on demand instead.

**Trade-off.** The wrangler version isn't pinned by the lockfile. The CI build uses whatever wrangler `npx` resolves at deploy time.

### Other changes

- `.gitignore`: added `.wrangler/` (local state from `wrangler dev`).
- `README.md`: added a cloud deployment option under Production Deployment
  Options, with the CI settings, manual deploy commands, and a note on why
  wrangler isn't a dependency.

### Verification

From a clean `npm ci` and `npm run build`:

- **`npx wrangler deploy --dry-run`** read the assets from
  `/home/user/oneiromancy/out` and reported "Read 45 files". `out/` holds 34
  files and 11 directories (45 entries in all), so the count appears to
  include directories. No bindings.
- **`npx wrangler dev`** on `127.0.0.1:8787`:

  | Request | Status | Content-Type | nosniff | Body |
  | --- | --- | --- | --- | --- |
  | `/` | 200 | `text/html` | yes | `out/index.html` |
  | `/board` | 200 | `text/html` | yes | `index.html` (SPA fallback) |
  | `/board/` | 200 | `text/html` | yes | `index.html` (SPA fallback) |
  | `/_next/static/chunks/main-*.js` | 200 | `text/javascript` | yes | chunk |
  | `/_next/static/css/*.css` | 200 | `text/css` | yes | stylesheet |
  | `/robots.txt` | 200 | `text/plain` | yes | robots.txt |
  | `/_headers` | 200 | `text/html` | yes | `index.html`; the rules file isn't exposed |

---

## Step 5: Push and CI builds settings

`main` was pushed to `origin` (`seano-vs/oneiromancy`). The same commit was
also pushed to the session's working branch, `ccr-7b1d5021-87x6ml`. Nothing was
pushed to `upstream`.

CI builds settings (the host's "import a repository" flow →
`seano-vs/oneiromancy`):

| Setting | Value |
| --- | --- |
| Project name | `oneiromancy` (must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (default) |
| Root directory | `/` (default) |

No environment variables or bindings are needed.

---

## Tests

`npm test` gave the same results before and after every step:

- 140 leaf tests pass (tiers 0 and 5–9).
- Tiers 1–4 fail to load with `ERR_MODULE_NOT_FOUND`
  (`Cannot find module '.../core/types/oneiromancy' imported from
  .../core/lib/scoring.ts`). This is a bug in the test loader's
  path-alias resolution that already existed upstream. As requested, the
  loader was **not** fixed.
- The runner prints `OVERALL STATUS: FAILURE` because of those 4 tiers and its
  `>=256` leaf-test requirement. Both were true before these changes.

## Deliberately out of scope

- The test loader's `ERR_MODULE_NOT_FOUND` bug (left for a separate request).
- The 4 existing `react-hooks/exhaustive-deps` warnings.
- Stale `caniuse-lite` / Browserslist warning during the build.
- Upstream's dependabot branches (fetched with the upstream remote, not
  copied to origin).
- No `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` font mock was committed. the host's
  builders have network access.

## Keeping up with upstream

```sh
git fetch upstream
git merge upstream/main   # resolve conflicts, then push to origin
```

Upstream changes to `package-lock.json` may bring back the malformed URLs.
Re-run the step 2 sed and check `grep -c '/-/@' package-lock.json` after any
merge that touches the lockfile.
