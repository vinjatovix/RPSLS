# 📑 FINAL SPEC: Spec #1 - Event-Driven UI

## 📝 Context
**Problem:** 
`src/index.js` (`Game` class) has a direct and strong dependency on UI components (`ScorePanel`, `MetaPanel`, `DebugDrawer`, etc.). The `Game.draw()` method currently acts as a "pusher" of data, which creates excessive coupling and makes the system difficult to test and scale.

**Impact:** 
High coupling, high risk of memory leaks (if UI is not cleaned up), and difficulty in testing game logic in isolation.

## 🎯 Objectives
- [ ] **Decouple** `Game.js` from the UI components.
- [ ] **Implement** an event-driven data flow using the existing `EventBus`.
- [ ] **Reduce** the complexity and responsibility of `Game.draw()`.
- [ ] **Ensure** memory safety by centralizing subscriptions in the `Game` lifecycle.

## 🏗️ Architecture & Design

### 🛠️ Implementation Strategy
- **Emission (Autonomous):** Managers (`ScoreManager`, `ProgressManager`, etc.) will be responsible for emitting their own events to the `EventBus` whenever a significant state change occurs (e.g., `ScoreManager` emits `score:update` when a player wins).
- **Subscription (Centralized):** `Game.js` will act as the orchestrator. During its initialization/bootstrap, it will explicitly subscribe the UI components to the necessary events. This ensures that when `Game.destroy()` is called, all listeners are properly cleaned up, preventing "zombie" listeners.

### 📡 Event Contract (The "API")
The following events will be used. All payloads must be plain objects.

| Event Name | Source | Payload Structure | Frequency |
| :--- | :--- | :--- | :--- |
| `score:update` | `ScoreManager` | `{ winners, match, timeLeft, lastWin }` | Low (on match end/update) |
| `game:match-start` | `Game` | `{ matchNumber, mode }` | Low (per match) |
| `game:match-end` | `Game` | `{ winners, ranking, playerTeam, modeKey }` | Low (per league end) |
| `progress:update`| `ProgressManager`| `{ credits, powerupLuck, etc. }` | Low (on upgrade/collect) |
| `powerup:spawned`| `Game` | `{ powerupType }` | Low (on spawn) |

### 👥 Affected Modules
- `src/index.js` (Orchestrator/Subscriber)
- `src/scoring/ScoreManager.js` (Emitter)
- `src/meta/ProgressManager.js` (Emitter)
- `src/ui/ScorePanel.js` (Subscriber)
- `src/ui/MetaPanel.js` (Subscriber)
- `src/ui/DebugDrawer.js` (Subscriber)

## 🧪 Verification Plan (Definition of Done)

### 🤖 Automated Tests
- [ ] **Integration Test:** Verify that `EventBus.emit('score:update', ...)` correctly triggers a state update in `Score             Panel` (using `dom-stub.js`).
- [ ] **Regression Test:** Run `npm test` to ensure the balance guard and existing logic remains intact.

### 🕹️ Manual Verification
- [ ] **Visual Check:** Confirm that all UI elements (scores, timers, credits) continue to update correctly in the browser.
- [ ] **Lifecycle Check:** Verify that UI updates are still visible after a match restart or a team change.
