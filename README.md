# Idle RPS

Idle game of Rock, Paper, Scissors, Lizard, Spock with 5 teams with their own stats, upgrades, powerups and game modes. Runs in the browser without a server.

## Local development

Requires Node.js >= 22 (uses native `node:test`). No transpilation: `src/` runs directly with ES modules.

```bash
npm install
npm run preview   # serves the app at http://localhost:8080
npm test          # test suite (node:test)
npm run coverage  # suite with coverage report
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm test` | Runs the `test/*.test.mjs` suite with `node:test` |
| `npm run coverage` | Suite with experimental coverage |
| `npm run check` | Syntax-check of all files in `src/`, `scripts/` and `test/` |
| `npm run balance` | Simulates 10 headless leagues and reports the win-rate per team (threshold ±5pp) |
| `npm run sweep` | Sensitivity sweep ±15% of each stat against the current balance |
| `npm run focus` | Focused sweep of specific stats |
| `npm run matchup` | Simulates the 1v1 matchups (catch-rate and TTK) |
| `npm run build` | Bundles `dist/` with esbuild (minified, ESM) for GitHub Pages |
| `npm run preview` | Serves the build at http://localhost:8080 |

Additional CLI diagnostics live in `test/` and are not part of `npm test`:

```bash
node test/edge-repro.mjs       # reproduces outDies on fleeing prey
node test/offscreen-check.mjs  # measures off-screen deaths vs damage deaths
node test/check-combo.mjs      # sweep of upgrade combos
node test/matchup-tune.mjs     # calibration of rotationAcceleration
```

## Architecture

- `src/index.js` — game bootstrap, main loop, player team.
- `src/config/gameConfig.js` — `RACE_STATS`, `GAME_MODES`, `GAME_CONFIG`, `POWERUP_TYPES`, `UPGRADES` (frozen in the browser).
- `src/entities/` — enemies (`Enemy`, `races.js`), powerups.
- `src/meta/` — `GameModes`, `ProgressManager`.
- `src/scoring/` — `ScoreManager`.
- `src/canvas/` — `CanvasAdapter`, escape geometry (`EscapeSolver`).
- `src/testing/` — `balanceRunner`, `matchupSim` (headless harness).

## Balance

The win-rate per team is the balance metric: the game is pure RPS (each race has 2 prey and 2 predators), so the stats only change the TTK and survivability. The goal is for all 5 races to stay within ±5pp in a simulated league.

`npm test` also includes a **balance guard** (`test/balance-guard.test.mjs`): 2 headless campaigns of 50 levels, failing if any race deviates more than ±7pp (noise-tolerant, but catches stat regressions).

## Publishing to GitHub Pages

The repo publishes the contents of `dist/` through the `deploy.yml` workflow:

1. Push the repo to GitHub and enable **Settings → Pages → Source: GitHub Actions**.
2. Each push to `main` that passes the tests builds and publishes.

The game only uses relative paths, so it works the same under a subdirectory or root domain.
