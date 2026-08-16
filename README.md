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

---

## 🎮 Gameplay & Mechanics

The game operates on an evolutionary "predator-prey" loop. 

- **The Ecosystem:** 5 distinct races (`rocks`, `papers`, `scissors`, `lizards`, `spocks`), each with unique biomechanics (speed, rotation acceleration, health, and damage).
- **Progression:** An upgrade system that allows players to invest credits into permanent stat boosts (Health, Damage, Speed, etc.) and "meta" upgrades (Power-up luck, Simulation compression).
- **Dynamic Environment:** A continuous stream of `POWERUP_TYPES` (Heal, Speed, Armor, etc.) and `TRAP` power-ups (Slow, Confusion, Freeze) that create unpredictable combat encounters.
- **Anti-Stall & Timeless Logic:** The engine dynamically transitions to a "timeless" mode when 4+ teams are alive, suspending the timer. To prevent endless deadlocks/orbits, a **30-second anti-stall countdown** automatically kicks in if no kills occur, forcing a temporary countdown of 10 seconds to keep the simulation flowing.

---

## 🏗 Engineering Architecture

The project is built as a **headless-capable, pure ESM engine**. It requires no transpilation and runs directly in modern browsers and Node.js environments.

- **Engine Core (`src/index.js`):** The main loop and game bootstrap.
- **Deterministic Simulation:** Uses seeded PRNG (`mulberry3    32`) to ensure that any simulation or test is 100% reproducible.
- **Headless Capability:** The entire game logic is decoupled from the DOM, allowing the `src/testing/` harness to run high-speed simulations in a terminal.
- **Event-Driven UI Decoupling:** Employs a centralized `EventBus` to emit and subscribe to key state changes, fully decoupling core game mechanics from the DOM layout and UI components (like `ScorePanel`, `InfoPanel`, and `MetaPanel`).
- **Data Immutability:** Core configurations (`gameConfig.js`) are deeply frozen to prevent runtime side-effects.

### Tech Stack
- **Runtime:** Node.js $\ge$ 22 (using native `node:test`)
- **Bundler:** `esbuild` (for production-ready, minified ESM)
- **Deployment:** GitHub Actions $\to$ GitHub Pages

---

## 🗺 Design Specifications & Roadmap

To maintain exceptional engineering standards, all major features, performance optimizations, and structural refactorings are designed through structured specifications before implementation. You can find them under `docs/specs/`:

- **Spec #1:** Event-Driven UI Decoupling (Implemented)
- **Spec #2:** Spatial Partitioning for $O(N^2)$ Collision Mitigation (Planned)
- **Spec #3:** Particle Object Pooling to reduce GC pressure (Planned)
- **Spec #12:** Unit Test Infrastructure & Coverage Expansion (In Progress)
- **Spec #13:** Canvas Rendering Optimization: Caching & Batching (Planned)

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
