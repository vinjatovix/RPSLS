# Spec: Spec #18 - Decoupling CombatSystem and ScoreManager via EventBus

## Context
**Problem/Opportunity:**
`CombatSystem` directly calls `ScoreManager.recordKill()` when an entity is killed. This creates an unneeded tight coupling between the physics/combat engine and the meta-game scoring system. It also violates the architectural mandate in `GEMINI.md` that dictates using the `EventBus` for communication between the simulation core and peripheral systems.

**Impact:**
- Tests for `CombatSystem` are fragile and require mocking or dealing with `ScoreManager`'s internal structure.
- Hard to unit-test `ScoreManager` in isolation.
- Violates SRP and project conventions.

## Objectives
- [x] Remove `ScoreManager` dependency from `CombatSystem`.
- [x] Refactor `CombatSystem` to emit the `"kill"` event via `EventBus` upon a successful kill.
- [x] Refactor `ScoreManager` to subscribe to the `"kill"` event instead of exposing `recordKill` for direct invocation.
- [x] Prevent `ScoreManager` from re-emitting `"kill"`, as `CombatSystem` will now be the source of truth for this event.
- [x] Create a dedicated unit test suite for `ScoreManager`.
- [x] Refactor `CombatSystem` unit tests to verify event emission instead of `ScoreManager` state.

## Architecture & Design

### Affected Modules
- `src/entities/CombatSystem.js`
- `src/scoring/ScoreManager.js`
- `test/unit/combat-system.test.mjs`
- `test/unit/score-manager.test.mjs` (New)
- `test/doubles/FakeGame.mjs`
- `test/testing/matchupSim.js`

### Structural Changes
1. **`CombatSystem`**:
   - Remove `scoreManager` from the constructor and class state.
   - When `enemy.life <= 0`, emit `"kill"` to `this.entity.game.eventBus` with payload `{ killerTeam: this.entity.team, victimTeam: enemy.team }`.
2. **`ScoreManager`**:
   - Subscribe to `"kill"` in its constructor and call `recordKill(killerTeam, victimTeam)` internally.
   - Remove the `this.eventBus?.emit("kill", ...)` line from `recordKill()` to avoid infinite loops or duplicate event dispatching. It will only emit `"score:update"`.

### Interface/API Contract
- `EventBus.emit('kill', { killerTeam, victimTeam })`

### Data Flow
1. **Kill Condition Met**: `CombatSystem.kill()` reduces enemy life to 0.
2. **Emission**: `CombatSystem` emits `"kill"` via the global `EventBus`.
3. **Handling**: `ScoreManager` receives the `"kill"` event, updates internal scores, and emits `"score:update"`.

## Verification Plan (Definition of Done)
### Automated Tests
- [x] Refactor `test/unit/combat-system.test.mjs` to assert that `EventBus.emit('kill', ...)` was called.
- [x] Create `test/unit/score-manager.test.mjs` to fully test `ScoreManager` initialization, score keeping, ratio calculations, MVP logic, ranking, and reset functionality.
- [x] Ensure `FakeGame` and other testing doubles no longer inject a mock `scoreManager` where it's no longer needed (like into `CombatSystem` via `EntityManager` or similar paths).

### Manual Verification
- [x] Run `npm test` and `npm run balance`.
- [x] Verify that UI scoreboards update correctly during a match.

## Risks & Mitigations
- **Risk:** Existing tests mocking `scoreManager` might fail if not fully updated.
- **Mitigation:** Carefully trace where `ScoreManager` is mocked in the `test/` directory and update the dependency graph.
