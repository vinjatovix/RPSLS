# Spec: Spec #20 - Separate Game Module from Browser Bootstrap

## Context
**Problem/Opportunity:**
The file `src/index.js` currently serves a double purpose: it defines and exports the pure core game class (`Game`), but it also contains browser-specific side-effects on load, such as calling `document.addEventListener("DOMContentLoaded")` to bootstrap and run the game, and manipulating DOM elements directly on import.

**Impact:**
- **Side-Effects on Import:** Node.js test scripts and simulations that import `Game` from `src/index.js` trigger browser-specific code. If DOM variables (`window`, `document`) are not present, the import crashes.
- **Maintenance Cost:** To bypass this, the project has to load a complex, artificial global stub layer (`test/dom-stub.js`) to mimic the DOM on parse-time. This increases memory overhead and introduces artificial environments for pure logic tests.

## Objectives
- [ ] Separate `src/index.js` into two modules: a pure core class exporter (`src/index.js`) and a dedicated browser entrypoint (`src/main.js`).
- [ ] Ensure importing core classes (`Game`, managers) contains zero side-effects on import.
- [ ] Eliminate or drastically reduce the reliance on `test/dom-stub.js` for pure headless Node tests.

## Architecture & Design

### Affected Modules
- `src/index.js` (Keep as a pure module exporter; strip DOM listener)
- `src/main.js` (New - Browser-only application container / bootstrap entrypoint)
- `package.json` (Update build scripts to target `src/main.js`)
- `test/dom-stub.js` (Can be safely removed or simplified)

### Structural Changes
1.  **Pure `src/index.js`:**
    ```javascript
    // src/index.js
    import { GAME_CONFIG, GAME_MODES, RACE_STATS, UPGRADES, POWERUP_TYPES, LEAGUE_LENGTHS } from "./config/gameConfig.js";
    // ... all imports ...
    export class Game {
      // ... core game logic ...
    }
    ```
2.  **Separate `src/main.js`:**
    ```javascript
    // src/main.js
    import { Game } from "./index.js";
    import { deepFreeze } from "./core/index.js";
    
    document.addEventListener("DOMContentLoaded", () => {
      // Instantiate panels, setup display adapters, and call start()
    });
    ```
3.  **Build Pipeline:**
    Update `scripts/build.mjs` (ESBuild script) to compile `src/main.js` as the entrypoint for the compiled web bundle, instead of `src/index.js`.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Verify that a Node.js script can import `Game` from `src/index.js` and instantiate it without loading `dom-stub.js` or throwing errors.
- [ ] Ensure all 160+ unit tests execute and pass.

### Manual Verification
- [ ] Build the game using `npm run build` and verify that the compiled web application loads, initializes, and plays correctly in Chrome, Firefox, and Safari.

## Risks & Mitigations
- **Risk:** Build process misconfigurations during bundle entrypoint relocation.
- **Mitigation:** Test build outputs locally and verify in `index.html` that the imported script source reflects the build destination.
