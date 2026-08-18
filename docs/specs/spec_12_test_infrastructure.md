# SPEC: Spec #12 - Test Infrastructure & Strategy Improvements

## Context
**Problem/Opportunity:**
Our current testing suite lacks a clear structural boundary. `GameScenario.mjs` wraps the entire `Game` instance, which means most "unit" tests are actually running the entire game engine under the hood. This couples unit tests to the global object, hiding structural dependencies. Furthermore, there are no real Test Data Builders or Object Mothers to cleanly construct entities with deterministic states, and true Integration tests—where specific subsystems are wired together and verified in isolation from the full application—are absent. The existing Spec #12 was obsolete, focusing only on increasing coverage rather than establishing a sustainable testing architecture.

**Impact:**
Without isolated unit tests, failures can cascade across the suite. Building specific game states for testing is verbose and error-prone. The lack of architectural enforcement makes it easy to introduce circular dependencies or break module boundaries without noticing until runtime.

## Objectives
- [ ] Define the **Test Pyramid** for the project (Unit, Integration, Headless E2E).
- [ ] Implement **Test Data Builders** and **Object Mothers** for entities.
- [ ] Introduce a strategy for **Test Doubles** (e.g., `FakeEventBus`) to decouple unit tests from the real application bus.
- [ ] Standardize **Parametrized Tests** for math and collision logic.
- [ ] Add an **Architecture Test** using `skott` to strictly prevent circular dependencies.

## Architecture & Design

### 1. Test Pyramid & Boundaries

*   **Unit Tests (`*.unit.test.mjs` / `*.test.mjs`):** Must verify a single class or pure function in isolation. 
    *   *Rule:* **Never** instantiate `new Game()` in a unit test.
    *   *Dependencies:* Pass configuration explicitly via constructor/method arguments. Inject `FakeEventBus` if event communication is needed.
*   **Integration Tests (`*.int.test.mjs`):** Verify the interaction between 2-3 specific subsystems (e.g., `EntityManager` + `MatchManager` + `ScoreManager`).
    *   *Rule:* Instantiate the specific managers and wire them with a real or captured `EventBus`. `Game` can be used *only* if the test intends to verify the global wiring itself.
*   **E2E / Simulation (`headless-campaign.mjs`):** Verifies the game holistically over thousands of frames to guarantee deterministic outputs and statistical balance (Balance Guard).

### 2. Builders and Mothers

We will introduce the Builder pattern to create entities flexibly and the Object Mother pattern to provide semantically clear presets.

**`test/builders/EnemyBuilder.mjs`**
A fluent interface for constructing `Enemy` instances without side effects.
```javascript
export class EnemyBuilder {
    constructor() {
        this.team = 'rocks';
        this.x = 0;
        this.y = 0;
        this.health = 100;
        // ... defaults
    }
    withTeam(team) { this.team = team; return this; }
    withHealth(hp) { this.health = hp; return this; }
    build() { return new Enemy({ team: this.team, x: this.x, y: this.y, /* ... */ }); }
}
```

**`test/mothers/EnemyMother.mjs`**
Static factory methods using the builder for common test scenarios.
```javascript
export const EnemyMother = {
    rockWithLowHealth() { return new EnemyBuilder().withTeam('rocks').withHealth(1).build(); },
    paperAtCenter() { return new EnemyBuilder().withTeam('paper').withPosition(500, 500).build(); }
}
```

### 3. Test Doubles (FakeEventBus)

To test modules that depend on the `EventBus` without firing real system-wide events, we will implement a `FakeEventBus`.

**`test/doubles/FakeEventBus.mjs`**
```javascript
export class FakeEventBus {
    constructor() { this.events = []; }
    emit(event, payload) { this.events.push({ event, payload }); }
    subscribe() { return () => {}; }
    getEmitted(eventName) { return this.events.filter(e => e.event === eventName); }
}
```

### 4. Architecture Enforcement

We will use our existing `skott` dependency programmatically in a dedicated test.

**`test/architecture.test.mjs`**
A test that runs `skott` over `src/index.js` and asserts that the `circularDependencies` array is strictly empty.

## Verification Plan (Definition of Done)

### Automated Tests
- [ ] Create `test/builders/EnemyBuilder.mjs` and `test/mothers/EnemyMother.mjs`.
- [ ] Create `test/doubles/FakeEventBus.mjs`.
- [ ] Create `test/architecture.test.mjs` using `skott` to assert zero circular dependencies.
- [ ] Refactor at least one core test file (e.g., `entity-manager.test.mjs`) to use the new Builders and `FakeEventBus` instead of `new Game()` / `GameScenario`.

### Manual Verification
- [ ] Run `npm run check:circular` to ensure the core is currently clean.
- [ ] Run `npm test` and verify that the refactored tests pass with native node execution.

## Risks & Mitigations
- **Risk:** Refactoring existing tests might temporarily lower coverage or break.
- **Mitigation:** Refactor incrementally. Introduce the Builders alongside `GameScenario` first, migrate `entity-manager.test.mjs` as a proof of concept, and then deprecate `GameScenario` in future refactors.
