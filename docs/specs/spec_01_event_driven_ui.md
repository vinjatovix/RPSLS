# FINAL SPEC: Spec #1 - Event-Driven UI

## Context
**Problem:** 
`src/index.js` (`Game` class) has a direct and strong dependency on UI components (`ScorePanel`, `MetaPanel`, `DebugDrawer`, etc.). The `Game.draw()` method currently acts as a "pusher" of data, which creates excessive coupling and makes the system difficult to test and scale.

**Impact:** 
High coupling, high risk of memory leaks (if UI is not cleaned up), and difficulty in testing game logic in isolation.

## Objectives
- **Decouple** `Game.js` from the UI components.
- **Implement** an event-driven data flow using the existing `EventBus`.
- **Reduce** the complexity and responsibility of `Game.draw()`.
- **Ensure** memory safety by centralizing subscriptions in the `Game` lifecycle.

## Architecture & Design

### Implementation Strategy
- **Emission (Autonomous):** Managers (`ScoreManager`, `ProgressManager`, etc.) emit their own events to the `EventBus` whenever a significant state change occurs.
- **Subscription (Self-Managed):** Each UI component subscribes to its own events in its constructor and exposes a `destroy()` method for cleanup. `Game.js` is the lifecycle owner: it instantiates components and calls their `destroy()` methods when the game ends. This keeps components self-contained and following SRP.

### Event Contract (The "API")
All payloads must be plain objects. `score:update` is intentionally payload-free: consumers call `ScoreManager.getRanking()` on receive, avoiding heavy event payloads.

| Event Name | Source | Payload Structure | Frequency |
| :--- | :--- | :--- | :--- |
| `score:update` | `ScoreManager` | _(none)_ | High (on kill/win) |
| `game:match-start` | `Game` | `{ matchNumber, mode, leagueLength, timeLeft, timeless }` | Low (per match) |
| `game:match-end` | `Game` | `{ match, winners, modeKey, leagueLength }` | Low (per league end) |
| `progress:update`| `ProgressManager`| `{ credits }` | Low (on upgrade/collect/reset) |
| `game:mechanics-change` | `Game` | `{ timeless }` | Low (on timeless toggle) |
| `tick` | `Game` | `{ timeLeft }` | Low (once per second, non-timeless) |

### Affected Modules
- `src/index.js` (Lifecycle owner)
- `src/scoring/ScoreManager.js` (Emitter)
- `src/meta/ProgressManager.js` (Emitter)
- `src/ui/ScorePanel.js` (Subscriber, self-managed)
- `src/ui/InfoPanel.js` (Subscriber, self-managed)
- `src/ui/MetaPanel.js` (Subscriber, self-managed)
- `src/ui/DebugDrawer.js` (Subscriber, self-managed)

### Component Lifecycle Pattern
Each UI component follows the same contract:

```js
class SomePanel {
  constructor({ eventBus }) {
    this._handlers = {
      "some:event": (e) => this.#handle(e),
    };
    for (const [event, handler] of Object.entries(this._handlers)) {
      eventBus.subscribe(event, handler);
    }
  }

  destroy() {
    for (const [event, handler] of Object.entries(this._handlers)) {
      eventBus.unsubscribe(event, handler);
    }
  }
}
```

`Game.destroy()` must call `destroy()` on every UI component to prevent zombie listeners.

## Verification Plan (Definition of Done)

### Automated Tests
- **Integration Test:** Verify that `EventBus.emit('score:update')` correctly triggers a state update in `ScorePanel` (using `dom-stub.js`).
- **Regression Test:** Run `npm test` to ensure the balance guard and existing logic remains intact.

### Manual Verification
- **Visual Check:** Confirm that all UI elements (scores, timers, credits) continue to update correctly in the browser.
- **Lifecycle Check:** Verify that UI updates are still visible after a match restart or a team change.
