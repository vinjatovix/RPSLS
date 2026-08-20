# FINAL SPEC: Spec #6 - LocalStorage Progress and Game State Persistence

## Context
**Problem/Opportunity:**
Upgrades and credits bought in the shop are managed entirely in-memory (`ProgressManager.js`). Reloading the browser wipes player progress, nullifying the progression system's value. An adapter `LocalStorageAdapter.js` exists but is disconnected from the flow. 
Additionally, active game/league progress (current match, level, team standings, scores) was also entirely transient across all modes. This meant a browser refresh wiped an active 50-match league, a high level (e.g. Level 100 in level selection), or an advanced match in infinite mode, forcing players to restart at Match 1.

**Impact:**
- Zero progression retention across sessions; players cannot keep upgrades.
- Frustrating loss of game state on accidental browser refresh or session termination.

## Objectives
- [x] Connect `ProgressManager.js` to `LocalStorageAdapter.js` for meta-progression (credits, upgrades, team selection).
- [ ] Connect the `Game` and `MatchManager` lifecycle to save and resume active game progress across all modes (current match/level and scoreboard).
- [ ] Implement deterministic seeding per match to completely eliminate save-scumming exploits on reload.
- [ ] Implement a client-side anti-tampering integrity protection layer (XOR obfuscation and FNV-1a signature validation) to secure stored data from DevTools editing.
- [ ] Implement an offline Manual Save Export & Import system to allow players to download backups (`idle-rps-save.dat`) and restore progress.

## Architecture & Design

### Affected Modules
- `src/meta/ProgressManager.js` (Meta progress: upgrades, credits, chosen team)
- `src/entities/MatchManager.js` (Match transition and deterministic seeding)
- `src/index.js` (Game bootstrap injection, game state saving/loading)
- `src/storage/LocalStorageAdapter.js` (Storage interface)

### Structural Changes
- `ProgressManager` accepts `storageAdapter` in its constructor and triggers `loadProgress()` on init.
- `Game` manages `saveGameState()`, `loadGameState()`, and `clearGameState()` on the active game progress across all modes.
- `MatchManager` triggers `saveGameState()` at the end of each match (within `nextMatch()`) and enforces deterministic seeding using `leagueSeed + matchNumber` inside `startMatch()`.
- `Game.start()` checks if the loaded match number is greater than 0; if so, it directly starts the match via `startMatch()` rather than incrementing via `nextMatch()`, guaranteeing exact resume points.
- `LocalStorageAdapter` implements a cryptographic signature (FNV-1a hash + secret salt) and XOR-based rotating cipher to obfuscate stored strings, rendering LocalStorage completely tamper-proof. It also provides the offline Save Export and Import logic.

### Interface/API Contract

#### ProgressManager (Meta-Progression)
```js
class ProgressManager {
  constructor({ eventBus, raceStats, upgrades, storageAdapter }) {}
  
  // Decoupled from mid-match saves: only mutates in-memory credits/upgrades during gameplay.
  // Save is triggered strictly at coarse milestones (end of match, team choose, progress reset).
  saveProgress() {}
  
  // Load progress from storage, apply schema validation, fallback on corruption
  loadProgress() {}
}
```

#### Game (Game State Persistence)
```js
class Game {
  // Save match, standings, league seed, length, and modeKey to key "active-game-state"
  saveGameState() {}
  
  // Load saved game state with strict schema validation; fallback gracefully on corruption
  loadGameState() {}
  
  // Clear saved game state
  clearGameState() {}
}
```

#### LocalStorageAdapter (Storage & Anti-Tamper)
```js
class LocalStorageAdapter {
  constructor(key) {}

  // Encrypts (XOR) and signs (FNV-1a hash + salt) payload before saving to localStorage
  save(data, key) {}

  // Loads, decrypts, and verifies signature of payload. Returns null if corrupted/tampered.
  load(key) {}

  // Removes a key from storage
  clear(key) {}

  // Bundles both game state and progress keys, encrypts/signs them, and triggers .dat file download
  exportSave() {}

  // Reads a .dat file, decrypts/verifies signature, and restores keys to localStorage on success
  importSave(fileContent) {}
}
```

### Data Flow

#### 1. Bootstrap / Page Reload
```
  [Browser Reload]
         │
         ▼
    [Game Init] ──► Loads "game-progress" (upgrades/credits) via ProgressManager
         │
         ▼
    [Game Init] ──► Checks if team === null && startLevel === 0 (indicating reload)
         │
         ├─► [Yes] ──► Loads "active-game-state" (match, standings, leagueSeed, modeKey, etc.)
         │             └─► Sets Game.start() -> calls MatchManager.startMatch() directly (Match M)
         │
         └─► [No] ──► Clears old "active-game-state" (Fresh game or menu selection)
                       └─► Sets Game.start() -> calls MatchManager.nextMatch() (Starts Match 1 or chosen level)
```

#### 2. Mutations & Transitions
- **Credits / Upgrades Mutation:** Handled strictly in-memory during active matches.
- **Match Transition (End of Match M):** `MatchManager.nextMatch()` increments match to $M+1$, then triggers simultaneous saving of both states: `Game.saveGameState()` (match progress) and `ProgressManager.saveProgress()` (accumulated credits and upgrades).
- **Manual Menu Actions:** Buying upgrades, choosing a team, or resetting progress in the menu (when no match is active) triggers an immediate `saveProgress()` to preserve user configurations.
- **League End / New Game:** Triggers `Game.clearGameState()` to reset match progress, but keeps meta upgrades.

### Anti-Save-Scumming (Deterministic Seeding)
To prevent players from refreshing the browser to restart a match they are losing:
- A base `leagueSeed` is generated once per game run (or restored on reload).
- At the start of every match $M$, `MatchManager.startMatch()` seeds the mulberry32 PRNG with `leagueSeed + M`.
- Because the simulation path is 100% deterministic, restarting Match $M$ by reloading the page will recreate the exact same starting coordinates, angles, and combat resolution.

## Verification Plan (Definition of Done)

### Automated Tests
- [x] `test/unit/progress-validation.test.mjs`: Tests saving, loading, type safety, schema corruption handling, and fallback behavior for meta-progression.
- [x] `test/unit/game-modes.test.mjs`: Tests game state saving, page reload simulation, scoreboard recovery, and idempotent match resume checks across modes.
- [ ] `test/unit/local-storage-adapter.test.mjs`: Tests that data is stored obfuscated and signed, and modifying any single character in the saved LocalStorage string causes decryption/signature validation to fail and safely return `null`.
- [ ] `test/unit/export-import.test.mjs` (or integrated tests): Tests that exporting save state bundles both keys into a signed, obfuscated `.dat` file, and importing a tampered file is rejected while importing a valid file correctly restores the game state.

### Manual Verification
- [x] Purchase an upgrade, refresh the page, and verify the upgrade tier and credits remain saved.
- [x] Start a league of 50, advance to Match 3, refresh, and verify that the simulation resumes exactly at Match 3 (not Match 4) and that running the match always yields the exact same deterministic outcomes.
- [x] Start a Level Selection game at Level 100, refresh, and verify it resumes at Level 100.
- [x] Finish a league/game, and verify that starting a new game resets the match counter and clears the active-game storage key.
- [ ] Open DevTools, try to modify the obfuscated string in LocalStorage, refresh, and verify that the game resets to defaults without crashing (tamper protection).
- [ ] From the Pause Menu, export the save file. Clear LocalStorage, reload, click Import Save, select the downloaded `.dat` file, and verify the entire session is seamlessly restored.

## Risks & Mitigations
- **Risk:** Cheating via easy local storage edits, or syntax crashes if storage is corrupted.
- **Mitigation:** Wrap load logic in try-catch blocks with full schema and type validation fallbacks. Obfuscate and sign the payloads using a XOR cipher and FNV-1a signature to immediately reject any tampered values.
- **Risk:** Save-scumming by refreshing mid-match.
- **Mitigation:** Deterministic seeding (`leagueSeed + M`) makes simulation outcomes non-exploitable upon reloading.
- **Risk:** Mid-match upgrade desynchronization exploits (e.g. buying upgrades mid-match and reloading to replay with the new upgrade active from the beginning of that same match).
- **Mitigation:** Persist meta-progression (`game-progress`) and match states (`active-game-state`) strictly at the same time: at the end of each match. Reloading mid-match reverts both states back to the start of that match.
