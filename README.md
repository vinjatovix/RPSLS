# 🪨 📄 ✂️ 🦎 🖖 Idle RPS: A Simulation-Driven Engineering Project

[Play the game](https://vinjatovix.github.io/RPSLS/)

**Idle RPS** is more than just an idle game of Rock, Paper, Scissors, Lizard, Spock. It is a high-fidelity, deterministic simulation engine designed to explore the complex dynamics of a 5-way evolutionary battle system. 

While the surface presents a simple, satisfying idle game, the core of the project is an **automated balance-verification ecosystem** that uses statistical hypothesis testing to ensure species parity.

---

## 🧪 The Science of Balance: $\chi^2$ Verification

The most distinguishing feature of this project is its commitment to mathematical fairness. In a pure RPSLS system, every race should ideally have a 20% win rate. To prevent "power creep" or "stat regression" when tweaking mechanics, the project employs a **Balance Guard**.

### The $\chi^2$ Goodness-of-Fit Test
The test suite (`test/balance-guard.test.mjs`) runs multiple headless, seeded campaigns. It calculates the **Chi-square ($\chi^2$) statistic** across the observed win distribution:

$$\chi^2 = \sum \frac{(O_i - E_i)^2}{E_i}$$

Where:
- $O_i$ is the observed number of wins for race $i$.
- $E_i$ is the expected number of wins (20% of total matches).

If the calculated $\chi^2$ exceeds the critical value (e.g., $9.488$ for $df=4, \alpha=0.05$), the build **fails**. This ensures that any change to `gameConfig.js` that introduces statistically significant bias is caught immediately during CI.

---

## 🛠 Automated Research & Diagnostics

The project includes a sophisticated suite of CLI tools for "tuning" the game's ecosystem without ever opening a browser.

| Command | Purpose | Methodology |
| :--- | :--- | :--- |
| `npm run balance` | **League Simulation** | Runs 10 headless leagues to report win-rates per team. |
| `npm run sweep` | **Sensitivity Analysis** | Performs a $\pm 15\%$ perturbation sweep on all stats to identify fragile balances. |
| `npm run focus` | **Targeted Debugging** | A focused sweep of specific stats to observe localized impact. |
| `npm run matchup` | **Combat Micro-mechanics** | Simulates 1v1 encounters to measure Catch-rate and Time-to-Kill (TTK). |
| `npm run check` | **Structural Integrity** | Syntax-check of all `.js` and `.mjs` files in the workspace. |
| `node test/check-combo.mjs <runs> <levels> '<json_patch_plural>'...` | **Interactive Tuning** | Evaluates specific JSON-formatted stat patches across multiple simulated runs to test "what-if" scenarios. |
| `node test/offscreen-check.mjs [matches]` | **Off-screen Death Analysis** | Simulates headless matches to measure and compare off-screen boundary deaths vs. direct combat damage deaths per team. |

---

## 🎮 Gameplay & Mechanics

The game operates on an evolutionary "predator-prey" loop. 

- **The Ecosystem:** 5 distinct races (`rocks`, `papers`, `scissors`, `lizards`, `spocks`), each with unique biomechanics (speed, rotation acceleration, health, and damage).
- **Progression:** An upgrade system that allows players to invest credits into permanent stat boosts (Health, Damage, Speed, etc.) and "meta" upgrades (Power-up luck, Simulation compression).
- **Dynamic Environment:** A continuous stream of `POWERUP_TYPES` (Heal, Speed, Armor, etc.) and `TRAP` power-ups (Slow, Confusion, Freeze) that create unpredictable combat encounters.
- **Anti-Stall & Timeless Logic:** The engine dynamically transitions to a "timeless" mode when 4+ teams are alive, suspending the timer. To prevent endless deadlocks/orbits, a **30-second anti-stall countdown** automatically kicks in if no kills occur, forcing a temporary countdown of 10 seconds to keep the simulation flowing.
- **Diagnostics & Debug Overlay:** Pressing the `D` key at runtime toggles an advanced engineering debug HUD. This overlay visualizes the active `SpatialGrid` boundary boxes, renders real-time entity occupancy counts inside each cell, draws the targeting query range circle, and renders cyan vector-lines connecting entities to their candidate targets, showcasing the spatial partitioning engine in real-time.

---

## 🏗 Engineering Architecture

The project is built as a **headless-capable, pure ESM engine**. It requires no transpilation and runs directly in modern browsers and Node.js environments.

- **Engine Core (`src/index.js`):** The pure simulation engine class (`Game`). Contains zero browser-specific code or DOM references, enabling flawless headless execution.
- **Browser Bootstrap (`src/main.js`):** The browser-only entry point. Responsible for instantiating physical browser-bound adapters (`CanvasAdapter`, `LocalStorageAdapter`, `InputHandler`) and binding decoupled DOM panels to the game instance's event bus.
- **Deterministic Simulation:** Employs a mathematically exact, 32-bit bitwise-coerced PRNG (`mulberry32`) guaranteeing cross-platform reproducible simulation paths over millions of iterations without Float64 precision drift. Cosmetics/visuals (such as particles) are stochastically isolated from the core physics simulation.
- **Phase-Separated Execution Pipeline:** Structured updates into distinct, strictly synchronized temporal phases (AI/Targeting $\to$ Movement $\to$ Spatial Grid Sync $\to$ Collision Resolution) to eliminate temporal frame-aliasing and ensure spatial consistency.
- **Headless Capability:** The entire game logic is decoupled from the DOM, allowing the `src/testing/` harness to run high-speed simulations in a terminal.
- **Event-Driven UI Decoupling:** Employs a centralized `EventBus` to emit and subscribe to key state changes, fully decoupling core game mechanics from the DOM layout and UI components (like `ScorePanel`, `InfoPanel`, and `MetaPanel`).
- **Data Immutability & Dependency Injection:** Core configurations (`gameConfig.js`) are deeply frozen by default across all environments (browser and Node.js) to prevent runtime side-effects. The simulation engine avoids global configuration mutations by supporting **Dependency Injection (DI)**, accepting config overrides via the `Game` constructor. This guarantees isolated and race-condition-free execution during parallel automated testing and calibration runs.
- **Spatial Partitioning (Optimization):** Utilizes a dynamic 2D Spatial Hash Grid with 32-bit packed integer key-hashing (avoiding string allocations), true zero-allocation array pooling, and entity query-result recycling. This reduces collision and targeting mathematical complexity from $O(N^2)$ to $O(N)$ with near-zero Garbage Collection overhead, ensuring a stable 60 FPS.

### Tech Stack
- **Runtime:** Node.js $\ge$ 22 (using native `node:test`)
- **Bundler:** `esbuild` (for production-ready, minified ESM)
- **Deployment:** GitHub Actions $\to$ GitHub Pages

## 🗺 Design Specifications & Roadmap

To maintain exceptional engineering standards, all major features, performance optimizations, and structural refactorings are designed through structured specifications before implementation. You can find them under `docs/specs/`:

*(See `TASKS.md` for the complete backlog)

---

## 🚀 Getting Started

### Local Development
```bash
npm install
npm run preview   # Serve the app at http://localhost:8080
npm test          # Run the full test suite (including Balance Guard)
npm run coverage  # Generate experimental coverage reports
```

### Publishing
The project is automatically deployed via GitHub Actions. Any push to `main` that passes the **Balance Guard** and syntax checks will trigger a new build and publish to GitHub Pages.
