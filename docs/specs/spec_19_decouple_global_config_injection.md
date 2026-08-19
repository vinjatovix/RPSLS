# Spec: Spec #19 - Decouple Global Config via Dependency Injection

## Context
**Problem/Opportunity:**
Currently, `RACE_STATS` and `GAME_CONFIG` in `src/config/gameConfig.js` are deeply frozen *only* at browser bootstrap (`src/index.js`), leaving them completely mutable under Node.js so that the balance runner (`balanceRunner.js`) and `check-combo.mjs` can patch/calibrate race statistics in-place. 

**Impact:**
- **Execution Environment Asymmetry:** A developer can write code that accidentally mutates nested configuration values during gameplay. This will pass Node.js test suites silently (since configs are mutable), but crash with a `TypeError` in the browser where configs are deeply frozen.
- **Test Interference:** Running multiple asynchronous test runs that mutate the shared config in-place is highly fragile.

## Objectives
- [ ] Enforce `deepFreeze` on all configuration modules by default in both browser and Node.js environments.
- [ ] Refactor `Game` to support **Dependency Injection (DI)** by accepting config overrides via the constructor.
- [ ] Refactor `balanceRunner.js` and `check-combo.mjs` to clone configuration objects, apply patches to the clone, and inject the cloned config into the `Game` instance, leaving global configs untouched and frozen.

## Architecture & Design

### Affected Modules
- `src/config/gameConfig.js` (Deep freeze at the module level instead of browser bootstrap)
- `src/index.js` (Freezing logic simplified; pass configs to constructor)
- `src/testing/balanceRunner.js` (Clone and inject configs)
- `test/check-combo.mjs` (Clone and inject configs)

### Structural Changes
1.  **Module-Level Freeze:** Change `src/config/gameConfig.js` to deeply freeze `RACE_STATS` and `GAME_CONFIG` immediately upon export.
2.  **Constructor Config Injection:**
    ```javascript
    // src/index.js
    class Game {
      constructor({ startLevel = 0, mode = "infinite-death", config = GAME_CONFIG, raceStats = RACE_STATS } = {}) {
        this.config = config;
        this.raceStats = raceStats;
        // All core modules (EntityManager, MatchManager) query this.config/this.raceStats from their parent game reference instead of importing them directly
      }
    }
    ```
3.  **Harness Calibration Refactor:**
    Instead of mutating global `RACE_STATS.rocks.damage.amount = 999`, the calibration harness will deep-clone the base configuration, apply the patches, and instantiate `Game` with the cloned configuration.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Verify `RACE_STATS` and `GAME_CONFIG` are frozen by default in Node.js (mutations should throw a `TypeError`).
- [ ] Unit test: `Game` successfully runs using custom injected configurations.
- [ ] Ensure all 160+ unit tests continue to pass.

### Manual Verification
- [ ] Run `npm run balance` and verify that statistical reports are calculated correctly under cloned/injected configs.

## Risks & Mitigations
- **Risk:** High memory/performance overhead from cloning configurations frequently.
- **Mitigation:** Configurations are small JSON objects. Cloning them once per campaign run (not per frame) has negligible overhead.
