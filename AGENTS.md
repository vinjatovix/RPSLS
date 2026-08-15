# AGENTS.md

High-signal instruction file for OpenCode sessions working in this repository.

---

## Project

Idle game of Rock, Paper, Scissors, Lizard, Spock. 5 teams with stats, upgrades, powerups, game modes. Browser-only, no server. Deployed to GitHub Pages via `dist/`.

---

## Environment

- **Node.js >= 22** required (uses native `node:test`).
- **Pure ES modules**, no transpilation: `src/` runs directly.
- `package.json` has `"type": "module"` – every `.js` and `.mjs` is ESM.

---

## Commands

### Core workflow

```bash
npm install
npm test          # test suite (node:test), includes balance guard
npm run check     # syntax-check all .js/.mjs in src/, scripts/, test/
npm run build     # bundles dist/ with esbuild (minified, ESM)
npm run preview   # serves the build at http://localhost:8080
```

### Balance tooling

```bash
npm run balance   # 10 headless leagues, win-rate per team (threshold ±5pp)
npm run coverage  # test suite with experimental coverage
npm run sweep     # sensitivity sweep ±15% of each stat
npm run focus     # focused sweep of specific stats
npm run matchup   # 1v1 matchup simulation (catch-rate, TTK)
```

### Additional diagnostics (NOT part of `npm test`)

```bash
node test/edge-repro.mjs       # reproduces outDies on fleeing prey
node test/offscreen-check.mjs  # off-screen deaths vs damage deaths
node test/check-combo.mjs      # sweep of upgrade combos
node test/matchup-tune.mjs     # calibration of rotationAcceleration
```

---


## Architecture

- `src/index.js` – game bootstrap, main loop, player team (`Game` class).
- `src/config/gameConfig.js` – `RACE_STATS`, `GAME_MODES`, `GAME_CONFIG`, `POWERUP_TYPES`, `UPGRADES` (frozen in browser).
- `src/entities/` – `Enemy`, `races.js`, powerups.
- `src/meta/` – `GameModes`, `ProgressManager`.
- `src/scoring/` – `ScoreManager`.
- `src/canvas/` – `CanvasAdapter`, escape geometry (`EscapeSolver`).
- `src/testing/` – `balanceRunner`, `matchupSim` (headless harness).

`index.html` loads `src/index.js` as a module. Build rewrites this to `./index.js` in `dist/`.

---

## Balance

**Win-rate per team** is the balance metric. Game is pure RPS (each race has 2 prey, 2 predators). Stats only affect TTK and survivability. Goal: all 5 races stay within **±5pp** in simulated league.

`npm test` includes a **balance guard** (`test/balance-guard.test.mjs`):
- Runs 6 seeded headless campaigns of 50 levels with deterministic PRNG.
- Applies chi-square goodness-of-fit test (df=4, critical=9.488, alpha=0.05).
- Fails if observed win distribution deviates from perfect balance (20% each).
- **Deterministic**: same seed → same result (0% flaky).

**When changing stats, game modes, or core mechanics**: run `npm run balance` to verify ±5pp threshold. The balance guard in `npm test` catches regressions but is noise-tolerant (±7pp).

---

## Testing quirks

- `test/*.test.mjs` is the suite run by `npm test`.
- Diagnostics in `test/` that are NOT `*.test.mjs` are standalone scripts (see [Additional diagnostics](#additional-diagnostics-not-part-of-npm-test)).
- `test/dom-stub.js` is imported by headless tests to fake browser globals (`document`, `localStorage`, `requestAnimationFrame`).
- Balance tests use seeded PRNG (`mulberry32` in `balanceRunner.js`) for determinism.

---

## Syntax check

`npm run check` (via `scripts/check.mjs`):
- Collects all `.js` and `.mjs` in `src/`, `scripts/`, `test/` (excludes `dist/`, `node_modules/`, `balance-sim.html`).
- Runs `node --check <file>` for each.
- Exits 1 if any file has syntax errors.

Use this before committing.

---

## Config immutability

`src/config/gameConfig.js` exports frozen objects (`Object.freeze`).

`test/config-freeze.test.mjs` verifies immutability. **Do not attempt to mutate config at runtime** – it will fail in tests.

---

## Preview server

`npm run preview` (via `scripts/serve.mjs`) serves `dist/` at `http://localhost:8080` after `npm run build`.

For local dev without bundling, open `index.html` directly (ESM works in modern browsers).
