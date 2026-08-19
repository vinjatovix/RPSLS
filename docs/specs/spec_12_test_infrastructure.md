# SPEC: Spec #12 - Test Infrastructure & Strategy Improvements

## Context
**Problem/Opportunity:**
Our current testing suite lacks a clear structural boundary. `GameScenario.mjs` wraps the entire `Game` instance, which means most "unit" tests are actually running the entire game engine under the hood. This couples unit tests to the global object, hiding structural dependencies. Furthermore, there are no real Test Data Builders or Object Mothers to cleanly construct entities with deterministic states, and true Integration tests—where specific subsystems are wired together and verified in isolation from the full application—are absent. The existing Spec #12 was obsolete, focusing only on increasing coverage rather than establishing a sustainable testing architecture.

**Impact:**
Without isolated unit tests, failures can cascade across the suite. Building specific game states for testing is verbose and error-prone. The lack of architectural enforcement makes it easy to introduce circular dependencies or break module boundaries without noticing until runtime.

## Objectives
- [x] Define the **Test Pyramid** for the project (Unit, Integration, Headless E2E).
- [x] Implement **Test Data Builders** and **Object Mothers** for entities.
- [x] Introduce a strategy for **Test Doubles** (e.g., `FakeEventBus`, `FakeGame`) to decouple unit tests from the real application bus.
- [x] Standardize **Parametrized Tests** for math and collision logic.

---

## Architecture & Design

### 1. Test Pyramid & Boundaries

*   **Unit Tests (`test/unit/*.test.mjs`):** Located in the `test/unit/` directory. Must verify a single class, method, or pure function in absolute isolation. 
    *   *Rule:* **Never** instantiate `new Game()` in a unit test.
    *   *Dependencies:* Pass configuration explicitly via constructor/method arguments. Inject `FakeEventBus` if event communication is needed, and utilize creational patterns (Builders/Mothers).
*   **Integration Tests (`test/integration/*.test.mjs`):** Located in the `test/integration/` directory. Verify the interaction and event orchestration between multiple subsystems (e.g., `MetaPanel` + `ProgressManager` + `EventBus`).
    *   *Rule:* Instantiate specific managers and wire them with a real or faked `EventBus`. Mock DOM elements using minimal stubs or JSDOM wrappers.
*   **E2E / Simulation (`test/balance-guard.test.mjs` / `headless-campaign.mjs`):** Located at the root of the test suite. Verifies the game holistically over thousands of frames to guarantee deterministic outputs and statistical balance (Balance Guard).

### 2. Builders and Mothers

We will introduce the Builder pattern to create entities flexibly and the Object Mother pattern to provide semantically clear presets.

**`test/builders/EnemyBuilder.mjs`**
A fluent interface for constructing `Enemy` instances without side effects.
```javascript
export class EnemyBuilder {
    constructor() {
        this.team = 'rocks';
        this.x = 100;
        this.y = 100;
        this.angle = 0;
        this.modifiers = null;
    }
    withGame(game) { this.game = game; return this; }
    withTeam(team) { this.team = team; return this; }
    withPosition(x, y) { this.x = x; this.y = y; return this; }
    build() { /* ... */ }
}
```

---

### 3. Test Doubles (FakeEventBus & FakeGame)

To maintain absolute behavioral parity and prevent code duplication between production and test systems, we enforce two strict design sub-rules:

#### 3.1. Liskov Substitution Principle & EventBus Inheritance
To test modules that depend on the `EventBus` without firing real system-wide events, we will implement a `FakeEventBus`. 
*   **Anti-pattern:** Manually duplicating callback storage map logic inside the fake object. This causes high maintenance and breaks compatibility if the real bus changes.
*   **Constraint:** `FakeEventBus` **must inherit directly** from `EventBus` (`extends EventBus`). It only overrides the `emit` method to append telemetry data to `this.emitted = []` and calls `super.emit()`.

```javascript
// test/doubles/FakeEventBus.mjs
import { EventBus } from "../../src/core/EventBus.js";

export class FakeEventBus extends EventBus {
  constructor() {
    super();
    this.emitted = [];
  }
  emit(eventName, data = null) {
    this.emitted.push({ eventName, data });
    super.emit(eventName, data);
  }
  getEmitted(eventName) {
    return this.emitted.filter(e => e.eventName === eventName);
  }
}
```

#### 3.2. Decoupling Pointer Logic & Math Click Collisions
To prevent behavior drift between production and dobles of test click interaction, **no coordinate translation or circular overlap collision calculations shall be duplicated inside `FakeGame`**.
1.  **Coordinate Transformation:** `CanvasAdapter` will expose `clientToCanvasCoordinates(clientX, clientY)` to translate raw client coordinates to local canvas coordinates. `FakeGame` will mock this adapter method to bypass DOM rect calculation.
2.  **Circular Overlap:** `CollisionDetector` will expose a static utility `isPointInsideCircle(px, py, cx, cy, radius)` to encapsulate the mathematical distance calculations. Both `src/index.js` and `FakeGame` will call this central function instead of replicating raw math.

---

### 4. Integration State Alignment (REAL EntityManager Updates)

Tests that simulate progression over multiple steps (e.g. `test/training-stats.test.mjs`) must use the real update lifecycle managed by the `EntityManager`.
*   **Constraint:** Bypassing `EntityManager.update` by manually looping over entities with `enemy.update()` in tests is prohibited for compound state verification.
*   **Reasoning:** Only the `EntityManager` orchestrates physical collisions, dead filters, racial captures, toroidal bounds, and scoring. Tests must invoke `entityManager.update(deltaTime)` to ensure accurate system integration coverage.

---

## Verification Plan (Definition of Done)

### Automated Tests
- [x] Create `test/builders/EnemyBuilder.mjs` and `test/builders/PowerUpBuilder.mjs`.
- [x] Create `test/doubles/FakeEventBus.mjs` (inheriting from `EventBus`) and `test/doubles/FakeGame.mjs` (using decoupled adapter coordinate mapping).
- [x] Refactor the unit test suite to use the new Builders and Test Doubles instead of `new Game()` / `GameScenario`.
- [x] Ensure `CollisionDetector.isPointInsideCircle` and `CanvasAdapter.clientToCanvasCoordinates` are used in both production and mock click loops to avoid duplicated math.
- [x] Create `test/unit/random.test.mjs` to mathematically assert deterministic PRNG sequences, seeds restoration, and independent cosmetic stream isolation.
- [x] Create `test/unit/local-storage-adapter.test.mjs` to assert key persistence, deletion, and robust error-handling/incognito fallout recovery (QuotaExceeded/Security exceptions).
- [x] Create `test/unit/clock.test.mjs` to verify delta times computation, FPS calculations, and frame jumps mitigation (via tab-sleep `reset()`).
- [x] Create `test/unit/stress-memory.test.mjs` to verify high entity density performance (500+ entities under $O(N)$ Spatial Partitioning), collections garbage-collection pruning, and EventBus zombie-listener leakage checks.

### Manual Verification
- [x] Run `npm run check:circular` to ensure the core is currently clean.
- [x] Run `npm test` and verify that the refactored tests pass with native node execution.

---

## Risks & Mitigations
*   **Risk:** Behavior Drift in Test Doubles.
    *   *Mitigation:* Enforce strict class inheritance (like `FakeEventBus` extending `EventBus`) and abstract mathematical formulas to central utilities (like `CollisionDetector` and `CanvasAdapter`) instead of copying raw logic.
*   **Risk:** PRNG Singleton stream interleaving under asynchronous simulations.
    *   *Mitigation:* Keep campaign simulations (`runCampaign`) strictly sequential, and avoid parallel runner structures like `Promise.all` that share the global `Random` singleton.
