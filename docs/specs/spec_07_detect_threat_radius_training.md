# Spec: Spec #7 - Threat Detection Radius Training

## 📝 Context
**Problem/Opportunity:**
Static `dangerRadius` limits strategic depth and class specialization.

**Impact:**
Restricted gameplay progression and low replayability.

## 🎯 Objectives
- [ ] Implement a training mechanic to increase `dangerRadius`.
- [ ] Update `TargetingSystem` to use dynamic entity-based radius.
- [ ] Maintain `AGENTS.md` balance constraints.

## 🏗️ Architecture & Design

### Affected Modules
- `src/config/gameConfig.js`
- `src/entities/TargetingSystem.js`
- `swsrc/entities/BuffManager.js`
- `src/entities/PowerUp.js`

### Structural Changes
- **`TargetingSystem.js`**: Refactor `#findClosestThreat` to use `this.entity.threatRadius`.
- **`Entity`**: Add `threatRadius` property, initialized from `GAME_CONFIG`.
- **`BuffManager`**: Handle radius expansion via buffs or persistent attributes.

### Interface/API Contract
- `Entity.updateThreatRadius(delta)`: Increment radius value.
- `EventBus.emit('threat_radius_increased', { entity, newRadius })`

### Data Flow
1. PowerUp/Mechanic updates `Entity.threatRadius` via `BuffManager`.
2. `TargetingSystem.flee()` reads the updated value during execution.

## 🧪 Verification Plan (Definition of Done)
### 🤖 Automated Tests
- [ ] Unit test: `TargetingSystem` detects enemies at expanded radius.
- [ ] Unit test: `BuffManager` handles radius increments correctly.
- [ ] Regression check in `npm test`.

### 🕹️ Manual Verification
- [ ] Verify entities flee earlier when radius is increased.
- [ ] Ensure no impact on existing movement/combat logic.

## ⚠️ Risks & Mitigations
- **Risk:** Performance drop due to larger detection area.
- **Mitigation:** Use squared distance comparisons (`distSq < radiusSq`).
- **Risk:** Breaking game balance.
- **Mitigation:** Validate win-rates with `npm run balance`.
