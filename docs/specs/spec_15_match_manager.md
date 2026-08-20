# Spec: Spec #15 - MatchManager Extraction

## Context
**Problem/Opportunity:**
`Game.js` currently controls the game's high-level match flow, timers, state changes, victory evaluations, stalling timers, and timeless mode calculations. Combining core setup (infrastructure) with round progression and state evaluation violates SRP.

**Impact:**
- Game states are coupled directly into the main render/update loop.
- Difficult to write targeted unit tests for match rules, stall countdowns, and draw scenarios without instantiating the full rendering context and engine canvas.

## Objectives
- [ ] Extract match rules, time calculations, win condition evaluation, and high-level progression into a new `MatchManager` class.
- [ ] Decouple victory logic from the main update execution loop.
- [ ] Move match statistics, timer variables (`timeLeft`, `gameTime`, `lastTickSecond`, `timeSinceLastAction`), and state transitions into `MatchManager`.

## Architecture & Design

### Affected Modules
- `src/index.js` (Delegates match progression and rules to `MatchManager`)
- `src/entities/MatchManager.js` (New class)

### Structural Changes
A new class `MatchManager` will be created to manage round/match state.
It will assume ownership of:
- Timer states (`timeLeft`, `gameTime`, `lastTickSecond`, `timeSinceLastAction`)
- Progress/Match count (`match`, `enemyGroupCount`)
- Pause status (`paused`)
- Timeless mechanics detection

`Game` will create `MatchManager` during bootstrap:
```js
this.matchManager = new MatchManager({
  game: this,
  eventBus: this.eventBus,
  options: this.options,
  scoreManager: this.scoreManager,
  progressManager: this.progressManager
});
```

### Interface/API Contract
```js
class MatchManager {
  constructor({ game, eventBus, options, scoreManager, progressManager }) {}

  // Set up a new match, reset timers, emit start events
  startMatch() {}

  // Progress to the next match or trigger league end
  nextMatch() {}

  // Update timers, evaluate stall thresholds, verify victory/loss/draw conditions
  update(deltaTime, activeEnemies) {}

  // Return whether the game is paused
  isPaused() {}

  // Set pause state
  setPaused(paused) {}
}
```

### Data Flow
1. **Bootstrap:** `Game` creates `MatchManager` and initiates the first round.
2. **Update Loop:** In each tick, `Game` asks `MatchManager` to update timers and check rules, passing the current list of active enemies.
3. **Condition Met:** If `MatchManager` detects only one team left or time limit reached, it registers wins/draws with `ScoreManager` and triggers `nextMatch()`.
4. **Transition:** If league ends, `MatchManager` calls `Game.onLeagueEnd`.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Unit tests for `MatchManager` verifying countdown ticks, timeless transitions, and correct winner identification on timeout or sole survivor.
- [ ] Integration test demonstrating automatic level/match incrementing when enemies are wiped out.
- [ ] Ensure all existing tests in `npm test` continue to pass.

### Manual Verification
- [ ] Verify match countdown clock decreases correctly, and stalling triggers rapid countdown.
- [ ] Verify win and loss events are recorded correctly on the scoreboard.
- [ ] Verify league transitions behave exactly as they did before the refactoring.

## Risks & Mitigations
- **Risk:** Timing synchronicity issues or drift between drawing steps and MatchManager evaluations.
- **Mitigation:** Rely strictly on the `deltaTime` injected from the high-resolution game clock during update phases.
