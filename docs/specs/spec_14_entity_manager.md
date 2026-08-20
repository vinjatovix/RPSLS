# Spec: Spec #14 - EntityManager Extraction

## Context
**Problem/Opportunity:**
`Game.js` currently manages the lifecycle, collision checks, updating, filtering, and drawing of active `Enemy`, `PowerUp`, and `ParticleSystem` instances directly. This makes `Game.js` a "God Class" that violates the Single Responsibility Principle (SRP) and complicates the testing of physics and entity lifecycles in isolation.

**Impact:**
- Hard to unit-test entity interaction and physics logic.
- `Game.js` remains bloated, exceeding 350 lines, and mixing environment orchestration with entity-level management.

## Objectives
- [ ] Extract all entity-related state (`enemies`, `powerups`, `particles`) from `Game.js` into a new `EntityManager` class.
- [ ] Centralize entity updating, drawing, cleanups, and collision detection within `EntityManager`.
- [ ] Simplify `Game.js` to only hold a reference to `EntityManager` and trigger its core lifecycle methods.

## Architecture & Design

### Affected Modules
- `src/index.js` (Refactored to delegate to `EntityManager`)
- `src/entities/EntityManager.js` (New class)
- `src/particles/ParticleSystem.js` (Adjusted reference to use `EntityManager` or keep `Game` as a facade)

### Structural Changes
A new class `EntityManager` will be introduced. It will assume ownership of:
- `this.enemies` array
- `this.powerups` array
- `this.particles` (`ParticleSystem` instance)
- Powerup spawn timer logic (`this.powerupTimer`)

`Game` will instantiate `EntityManager` during startup:
```js
this.entityManager = new EntityManager({
  game: this,
  eventBus: this.eventBus,
  progressManager: this.progressManager
});
```

### Interface/API Contract
```js
class EntityManager {
  constructor({ game, eventBus, progressManager }) {}

  // Spawn initial match enemies and reset powerups/particles
  spawnMatch(enemyGroupCount) {}

  // Update all active entities, handle colisions, spawn powerups, prune dead
  update(deltaTime) {}

  // Draw all active entities (enemies, powerups, particles)
  draw() {}

  // Add a newly captured enemy to the collection
  addCapturedEnemy(enemy) {}
  
  // Return list of all active enemies
  getEnemies() {}
  
  // Return list of all active powerups
  getPowerups() {}
}
```

### Data Flow
1. **Initialize:** `Game` creates `EntityManager`.
2. **Match Start:** `Game` triggers `entityManager.spawnMatch(enemyGroupCount)`.
3. **Loop Step:** `Game.run()` calls `entityManager.update(deltaTime)` and `entityManager.draw()`.
4. **Collision/Behavior:** `EntityManager` updates each `Enemy`, checking for collisions against powerups and executing movement logic.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Unit tests for `EntityManager` checking correct initial spawns, updating loop, and item cleanup (pruning dead).
- [ ] Integration test ensuring game loop correctly updates entities through `EntityManager`.
- [ ] Run `npm test` to ensure existing simulation and balance tests are not broken.

### Manual Verification
- [ ] Verify that enemies, powerups, and particles spawn, move, collide, and render correctly in the browser.
- [ ] Verify that player controls (clicking on powerups) and collision-based powerup activation still function seamlessly.

## Risks & Mitigations
- **Risk:** Tight circular dependency between `Game`, `EntityManager`, and entities.
- **Mitigation:** Pass a minimized context or facade instead of the full `Game` class where possible, keeping references clean.
