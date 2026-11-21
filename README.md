# Oneiromancy - Fantasy Football Ephemeris

This is not an officially supported Google product. This project is not eligible
for the
[Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security)
.

A mobile-first fantasy football application built with Next.js for weekly
lineups and league management, using Sleeper's public API and a 25-predictor
astrological and divinatory point-differential engine
(`core/lib/pointDiffEngine.ts`).

## Sleeper Point-Differential Prediction Engine

Oneiromancy evaluates players directly in fantasy points with zero 0-to-100
scores or percentage weights:

1. **Base**: The player's Sleeper baseline projected points for their next
   scheduled NFL game.
2. **Overall Modifier**: The combined historical point differential (`Actual -
   Projected` fantasy points) from position-specific models (`QB`, `RB` , `WR` ,
   `TE` , `K` , and `DEF` at Ridge penalty 75) fit across 36,163 NFL
   regular-season starter-games from 2018 to 2026. Separate position models keep
   kickers and tight ends from compressing wider quarterback (-5.10 to +5.91
   pts) and wide receiver (-4.17 to +4.50 pts) modifiers. By default, the app
   enables the 11 positive-edge predictors (+0.08 to +0.28 pts fifth-spread on
   unseen 2023-2026 games via `DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS` , spanning
   all 6 categories) and starts the 14 flat or negative holdout predictors
   turned off in the `Predictors` drawer.
3. **Projected (`Base + Modifier`)**: Net next-game projected points shown
   beside `Base` and `Modifier` across `Roster` , `Matchup` , `Players` ,
   `League` , `Waivers` , `Trades` , and `PlayerDetailModal` .

Lineup checks, weekly matchup totals, waiver suggestions, trade evaluations, and
league projections rank players and teams by `Base + Modifier` . Clicking any
player opens a breakdown showing multi-tradition **Elemental Balance** (Western
Zodiac, Major Arcana Tarot, Chinese BaZi *Wu Xing*, *Lo Shu Ba Gua*, and Mayan
*Tzolk'in* directions) for the player and their NFL unit, birth-chart and
game-day signatures, and how each enabled predictor contributes under that
position's historical model.

### Zero-Dataset Runtime Scoring and Signal Catalog (`core/lib/`)

- **`MODEL_PARAMETERS`, `POSITIONAL_RIDGE_MODELS` & `PREDICTOR_CATEGORIES`
  (`core/lib/pointDiffWeights.ts`)**: Self-contained serialized position models
  (`positionalModels` across `QB` , `RB` , `WR` , `TE` , `K` , and `DEF` at
  penalty 75, plus pooled reference models across all 25 predictors, the 12-rule
  training-screened subset, and 25 standalone `perSystemModels` ) paired with
  `USABLE_SIGNAL_CATALOG` (25 sign-consistent rules audited for within-player
  fixed effects and Benjamini-Hochberg false-discovery rates).
- **`predictPlayerGamePointDiff` & `createPredictiveSystem`
  (`core/lib/pointDiffEngine.ts`, presets in `core/lib/scoring.ts`)**:
  Zero-dependency runtime scoring supporting position-specific models,
  `useTrainScreened` , PPR (`DEFAULT_SLEEPER_PPR_SCORING`), Half-PPR
  (`SLEEPER_HALF_PPR_SCORING`), Standard (`SLEEPER_STD_SCORING`), and 6-pt Pass
  TD (`SLEEPER_6PT_PASS_TD_PPR_SCORING`) scoring presets.

### Six Predictor Categories and All 25 Predictors

1. **Sun Sign, Tarot & Birth Wheel** (`solar_zodiac_wheel`): default on:
   `egyptian_decans_modality` ; opt-in: `oracular_archetypes` ,
   `witchcraft_sabbats_esbats` , `runes_ogham` , `kabbalah_gematria`
2. **Moon Phases & Bright Stars** (`lunar_fixed_stars`): default on:
   `solar_lunar_transits` ; opt-in: `vedic_jyotish` , `arabic_lots_manazil` ,
   `fixed_stars_parans`
3. **Team & Matchup Elemental Chemistry** (`team_elemental_chemistry`): default
   on: `team_synergy` , `elemental_matchup`
4. **Planetary Cycles & Career Timing** (`planetary_orbits_timing`): default on:
   `planetary_synastry` , `hellenistic_planetary` , `annual_profections` ;
   opt-in: `secondary_progressions` , `contest_horary` ,
   `cosmobiology_midpoints`
5. **Numerology, Names & Lot Casting** (`numerology_name_lots`): default on:
   `numerology` ; opt-in: `greco_roman_onomancy` , `medieval_geomancy`
6. **Ancient & East Asian Day Calendars** (`sacred_day_calendars`): default on:
   `mayan_tzolkin` , `qimen_bagua` , `bazi_wuxing` ; opt-in: `biorhythms` ,
   `rokuyo_tenchusatsu`

### Empirical Study and Visual Charts

Methodology, confounding checks, cluster-robust inference (2,263 NFL games and
1,035 players), and walk-forward validation (2018-2022 training split to
2023-2026 holdout split across 15,547 unseen starter-games: +0.37 pts `Q5 - Q1`
and +0.43 pts `D10 - D1` across all 25 predictors at $t = +2.07$ , $p = 0.039$ ;
+0.54 pts `D10 - D1` at $t = +2.25$ , $p = 0.025$ for the 12-rule
training-screened subset) live in `docs/` :

- **[Sleeper Point-Differential Study
  (`docs/SLEEPER_POINT_DIFF_ANALYSIS.md`)](./docs/SLEEPER_POINT_DIFF_ANALYSIS.md)**
  - [25-System Out-of-Sample Forest Plot](./docs/charts/system_forest_plot.svg)
  - [Walk-Forward Calibration Curve](./docs/charts/oos_calibration_curve.svg)
  - [Elemental 4x4 Matchup Heatmap](./docs/charts/elemental_4x4_heatmap.svg)
  - [Positional Harmony Regimes](./docs/charts/synergy_positional_regimes.svg)
  - [Ancient & Divinatory Systems Breakdown](./docs/charts/ancient_mystical_systems.svg)

No external NFL or ESPN scoreboard APIs are needed. Projections and schedules
come from Sleeper's public API, paired with local astronomical and calendar
calculations.

## Quick Reference

| Command | Environment | Purpose | What it Does |
| :--- | :--- | :--- | :--- |
| `npm install` | Local / OSS | Setup dependencies | Installs packages into `node_modules/` (run once). |
| `npm run dev` | Local / OSS | Local development | Clears `.next/` cache and starts the local dev server at `http://localhost:3000`. |
| `npm run dev -- -H 0.0.0.0` | Remote Workstation | Remote development | Starts the dev server bound across network interfaces. |
| `npm run clean` | Local / OSS | Manual cache reset | Wipes `.next/`, `out/`, and temporary runtime caches. |
| `npm run build` | Local / OSS | Production build | Cleans cache and compiles a static export into `out/`. |
| `npm start` | Local / OSS | Static production server | Serves `out/` via zero-dependency `server.js` on port 8080. |
| `npm test` | All | Automated test suite | Runs all 627 automated unit, component, and E2E tests across 11 tiers. |
| `npm run verify` | All | Launch prober | Probes the local HTTP server to verify status 200 and page markup. |
| `npm run lint` | All | Code linting | Runs ESLint across TypeScript and React source files. |
| `npm run typecheck` | All | Type checking | Verifies TypeScript types without emitting build files. |

## Local Development Workflow

### 1. Prerequisites and Setup

Install **Node.js** (v18 or higher) and **npm**, then install dependencies:

```bash
npm install
```

### 2. Running the Development Server

Start the local application while editing code:

```bash
npm run dev
```

#### Cache Clearing on Startup

Next.js caches compiled pages in `.next/` , which can leave stale bundles after
switching branches. `npm run dev` clears `.next/` before starting (`rm -rf .next
&& next dev`) so each dev session compiles from current source files.

#### Accessing the Application

- **Local machine**: Open [http://localhost:3000](http://localhost:3000) .
- **Remote workstation**:
  - Bind the server across all interfaces:
    ```bash
    npm run dev -- -H 0.0.0.0
    ```
  - Or forward port 3000 over SSH from your laptop:
    ```bash
    ssh -L 3000:localhost:3000 <your-remote-hostname>
    ```
Then open [http://localhost:3000](http://localhost:3000) .

#### Stopping the Server

Press `Ctrl + C` in the terminal to stop the server.

## Production Build and Deployment Guide

Compile an optimized static export before deploying to Cloud Storage, Firebase
Hosting, Cloud Run, or a CDN.

### 1. Building for Production

Run the production build:

```bash
npm run build
```

This command:

1. Wipes prior build caches and outputs (`rm -rf .next out`).
2. Compiles and minifies React components and Tailwind CSS.
3. Writes a standalone static bundle to `out/` (`output: 'export'` in
   `next.config.mjs` ).

### 2. Inspecting the Production Output

The static export in `out/` contains:

- `out/index.html` - Pre-rendered entry point.
- `out/_next/` - Minified JavaScript chunks and stylesheets.
- `out/404.html` - Fallback 404 page.

Because `out/` is a static export, production hosting does not need a Node SSR
server. Any static web server, CDN, or `node server.js` can serve it directly.

### 3. Testing the Production Build Locally

Preview the exported `out/` directory before deploying:

```bash
# Option A: Included zero-dependency static server (port 8080)
npm start

# Option B: Python built-in web server (port 3000)
python3 -m http.server 3000 -d out

# Option C: Node serve utility (port 3000)
npx serve out -p 3000
```

Open [http://localhost:8080](http://localhost:8080) (or port 3000) to verify.

### 4. Production Deployment Options

#### Static Hosting (Cloud Storage / Firebase / CDN)

Upload `out/` to any static host:

- **Google Cloud Storage**: Upload `out/*` and enable Website Configuration with
  Cloud CDN.
- **Firebase Hosting**: Run `firebase deploy --only hosting` with `public`
  pointed at `out` .
- **GitHub Pages / Netlify / Vercel**: Set the publish directory to `out` .

#### Containerized Deployment (Cloud Run / Docker)

A multi-stage `Dockerfile` is included in the repository root:

```bash
# Build Docker container
docker build -t oneiromancy .

# Run container locally on port 8080
docker run -p 8080:8080 oneiromancy
```

The image uses `node:22-alpine` , runs as non-root user `UID 1001` , and deploys
directly to Google Cloud Run.

#### Edge Static Hosting with CI Deploys

`wrangler.jsonc` configures static edge hosting for `out/` :

- **Static assets only**: `out/` is the asset directory with no server runtime
  code.
- **SPA fallback**: Unmatched routes serve `index.html` (matching `app.yaml` and
  `server.js` ).
- **Security headers**: `public/_headers` sets `X-Content-Type-Options: nosniff`
  on responses.

Recommended CI settings:

| Setting | Value |
| :--- | :--- |
| Production branch | `main` (deploy on push) |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | 22 LTS (matches `Dockerfile`) |
| Environment variables / secrets | None required; browser calls Sleeper's public API directly |

Keep the deploy CLI out of `package.json` because its native binary expects
glibc and breaks `npm ci` inside the Alpine `Dockerfile` ; fetch it at deploy
time via `npx` .

## Testing and Quality Verification

Run the automated test suite, type-checker, and linter from the project root:

```bash
# Run all 627 automated unit, component, and E2E tests across 11 tiers
npm test

# Run HTTP launch and HTML structure check
npm run verify

# Run TypeScript type-checker
npm run typecheck

# Run ESLint
npm run lint
```

## Official Sleeper API Reference

- **Documentation**: [https://docs.sleeper.com/](https://docs.sleeper.com/)
- **Base URL**: `https://api.sleeper.app/v1`

### Rate Limiting

Sleeper's API is an unauthenticated read-only JSON service. Sleeper recommends
staying below 1,000 requests per minute per IP address.

The client in `core/lib/sleeper.ts` implements:

- Sliding-window tracking with a 300 requests/minute ceiling during multi-season
  league discovery and background polling.
- A 60-second backoff cooldown triggered when Sleeper returns HTTP 429.
- Immediate cooldown reset when a user triggers a manual sync in settings.

### Implemented Endpoints

- **User Lookup**: `GET /v1/user/<username>` or `GET /v1/user/<user_id>`
  ([docs](https://docs.sleeper.com/#user))
- **User Leagues**: `GET /v1/user/<user_id>/leagues/<sport>/<season>`
  ([docs](https://docs.sleeper.com/#leagues))
- **League Drafts**: `GET /v1/league/<league_id>/drafts`
  ([docs](https://docs.sleeper.com/#drafts))
- **Draft Details & Picks**: `GET /v1/draft/<draft_id>` &
  `GET /v1/draft/<draft_id>/picks` ([docs](https://docs.sleeper.com/#drafts))
- **League Users & Rosters**: `GET /v1/league/<league_id>/users` &
  `GET /v1/league/<league_id>/rosters`
  ([users](https://docs.sleeper.com/#users-in-a-league),
  [rosters](https://docs.sleeper.com/#rosters) )
- **Weekly League Matchups**: `GET /v1/league/<league_id>/matchups/<week>`
  ([docs](https://docs.sleeper.com/#getting-matchups-in-a-league))
- **NFL State & Weekly Projections**: `GET /v1/state/nfl` &
  `GET /v1/projections/nfl/<season>/<week>`
  ([docs](https://docs.sleeper.com/#get-nfl-state))
- **NFL Players Dictionary**: `GET /v1/players/nfl`
  ([docs](https://docs.sleeper.com/#players))

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for Contributor License Agreement (CLA)
details and pull request guidelines.

## License

Licensed under the [Apache License, Version 2.0](LICENSE) .
