# FINAL SPEC: Spec #6 - LocalStorage Progress Persistence

## Context
**Problem/Opportunity:**
Upgrades and credits bought in the shop are managed entirely in-memory (`ProgressManager.js`). Reloading the browser wipes player progress, nullifying the progression system's value. An adapter `LocalStorageAdapter.js` exists but is disconnected from the flow.

**Impact:**
Zero progression retention across sessions; players cannot keep upgrades.

## Objectives
- [ ] Connect `ProgressManager.js` to `LocalStorageAdapter.js`.
- [ ] Auto-save progress whenever credits are gained, lost, or upgrades are purchased.
- [ ] Load and apply saved state safely on game startup, gracefully handling corrupted data.

## Architecture & Design

### Affected Modules
- `src/meta/ProgressManager.js`
- `src/storage/LocalStorageAdapter.js`
- `src/index.js` (Bootstrap injection)

### Structural Changes
- `ProgressManager` accepts a storage adapter in its constructor.
- Add load/save triggers into mutation methods.

### Interface/API Contract
```js
class ProgressManager {
  constructor({ eventBus, storageAdapter }) {}
  
  // Save current upgrades and credits to storage
  saveProgress() {}
  
  // Load progress from storage or fallback to defaults
  loadProgress() {}
}
```

### Data Flow
1. **Initialize:** `Game` creates `LocalStorageAdapter` and injects it into `ProgressManager`.
2. **Bootstrap:** `ProgressManager` calls `loadProgress()`.
3. **Mutations:** Player gains credits or buys upgrade -> `ProgressManager` updates memory and triggers `saveProgress()`.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Unit test checking loading from empty storage, corrupted JSON, and correct save states.

### Manual Verification
- [ ] Purchase an upgrade, refresh the page, and verify the upgrade tier and credits remain saved.

## Risks & Mitigations
- **Risk:** Cheating via easy local storage edits, or syntax crashes if storage is corrupted.
- **Mitigation:** Wrap load logic in try-catch blocks with full schema validation fallback.
