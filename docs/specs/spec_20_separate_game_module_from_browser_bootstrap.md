# Spec: Spec #20 - Separate Game Module from Browser Bootstrap

## Context
**Problem/Opportunity:**
The file `src/index.js` currently serves a double purpose: it defines and exports the pure core game class (`Game`), but it also contains browser-specific side-effects on load, such as calling `document.addEventListener("DOMContentLoaded")` to bootstrap and run the game, and manipulating DOM elements directly on import.

**Impact:**
- **Side-Effects on Import:** Node.js test scripts and simulations that import `Game` from `src/index.js` trigger browser-specific code. If DOM variables (`window`, `document`) are not present, the import crashes.
- **Maintenance Cost:** To bypass this, the project has to load a complex, artificial global stub layer (`test/dom-stub.js`) to mimic the DOM on parse-time. This increases memory overhead and introduces artificial environments for pure logic tests.

## Objectives
- [x] Separate `src/index.js` into two modules: a pure core class exporter (`src/index.js`) and a dedicated browser entrypoint (`src/main.js`).
- [x] Ensure importing core classes (`Game`, managers) contains zero side-effects on import.
- [x] Eliminate the reliance on `test/dom-stub.js` for pure headless Node tests by using pure Dependency Injection.

## Architecture & Design

### Affected Modules
- `src/index.js` (Keep as a pure module exporter; strip DOM listener)
- `src/main.js` (New - Browser-only application container / bootstrap entrypoint)
- `src/testing/FakeAdapters.js` (New - Centralized, high-fidelity double for testing)
- `package.json` (Update build scripts to target `src/main.js`)
- `test/dom-stub.js` (Completely deleted)
- `test/integration/bootstrap.test.mjs` (New - Bootstrap integration test using isolated JSDOM)
- `test/unit/adapter-contracts.test.mjs` (New - Contract testing to ensure fakes never desalign)
- `test/unit/fake-adapters.test.mjs` (New - Thorough behavioral unit testing of fake adapters)

### Structural Changes
1.  **Pure `src/index.js`:**
    Exports the pure `Game` simulation class. No DOM manipulation, no browser listeners. Receives peripheral services (input, canvas, storage) through Constructor Dependency Injection under the `adapters` parameter.
    DOM panels (`ScorePanel`, `InfoPanel`, `MetaPanel`) are no longer instantiated inside `Game`. Instead, they subscribe to the game's `eventBus` from outside, ensuring perfect separation of concerns.

2.  **Separate `src/main.js`:**
    Instantiates real browser adapters (`CanvasAdapter`, `LocalStorageAdapter`, `InputHandler`) and passes them to the `Game` constructor. Instantiates the decoupled DOM panels and binds them to the `eventBus` of the game instance.

3.  **High-fidelity `FakeAdapters.js`:**
    Located in `src/testing/FakeAdapters.js`, this provides lightweight in-memory, fully compliant mocks of `CanvasAdapter` (supporting dynamic resize, canvas scale, margins, and arena containment), `LocalStorageAdapter` (saving/loading parsed JSON via Maps), and `InputHandler` (supporting keystates). This completely removes the need for global browser-environment polyfills.

4.  **Contract Testing:**
    The contract validation file `test/unit/adapter-contracts.test.mjs` performs reflexive prototype checks. If an adapter in production adds or modifies its public interface, the tests fail automatically unless `FakeAdapters.js` is updated, preventing drift.

5.  **Build Pipeline:**
    Update `scripts/build.mjs` (ESBuild script) to compile `src/main.js` as the entrypoint for the compiled web bundle, instead of `src/index.js`.

## Verification Plan (Definition of Done)
### Automated Tests
- [x] Verify that a Node.js script can import `Game` from `src/index.js` and instantiate it without loading `dom-stub.js` or throwing errors.
- [x] Ensure all 190+ unit and integration tests execute and pass natively (`npm test`).
- [x] Ensure the Contract Testing suite passes on every test execution, preventing future drift.
- [x] Ensure the Behavioral Unit Testing suite (`test/unit/fake-adapters.test.mjs`) passes, verifying the scaling, size calculations, and toggle notifications inside fake adapters.
- [x] Ensure the Bootstrap Integration Testing suite (`test/integration/bootstrap.test.mjs`) passes under isolated JSDOM environments, validating the binding of DOM panels to the game event bus and correct pause/resume event listener behaviors.

### Manual Verification
- [x] Build the game using `npm run build` and verify that the compiled web application loads, initializes, and plays correctly in Chrome, Firefox, and Safari.

## Risks & Mitigations
- **Risk:** Build process misconfigurations during bundle entrypoint relocation.
- **Mitigation:** Test build outputs locally and verify in `index.html` that the imported script source reflects the build destination.
