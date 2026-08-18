# FINAL SPEC: Spec #4 - Canvas Rendering Optimization

## Context
**Problem/Opportunity:**
`EnemyRenderer.js` alters canvas global styles (such as `ctx.font`, `ctx.fillStyle`, and expensive transformation operations like `save()`, `restore()`, `translate()`, `rotate()`) per individual entity draw call. In Canvas 2D, setting `ctx.font` is highly expensive as the engine recalculates font metrics.

**Impact:**
Unnecessary CPU and GPU rendering pipeline overhead per frame.

## Objectives
- [ ] Reduce the number of global canvas state changes per frame.
- [ ] Group (batch) drawing operations by font size/style.
- [ ] Eliminate redundant `ctx.save()` / `ctx.restore()` calls where simple inverse transforms can be applied.

## Architecture & Design

### Affected Modules
- `src/entities/EnemyRenderer.js`
- `src/particles/FloatingText.js`

### Structural Changes
- Sort or group render calls. Instead of each enemy drawing itself in a single pass, we batch text and emoji rendering.
- State checks: Verify if `ctx.font` or `ctx.fillStyle` already matches the desired value before setting them.

### Interface/API Contract
```js
class EnemyRenderer {
  // Static state tracking of current canvas font/color to avoid redundant writes
  static currentFont = null;
  static currentStyle = null;
}
```

### Data Flow
1. **Render phase:** Game loop calls `EnemyRenderer.batchDraw(enemies, ctx)`.
2. **Grouping:** Draw operations are grouped by text/style configuration.
3. **State Guard:** Font values are checked. If `ctx.font === currentFont`, setting is skipped.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Performance benchmark comparing batched draw against unbatched draw under high entity counts.

### Manual Verification
- [ ] Verify that entity sprites, sizes, text, and directions remain visually correct.

## Risks & Mitigations
- **Risk:** Batching breaks render layering (Z-index or drawing order).
- **Mitigation:** Ensure batching occurs within acceptable depth boundaries (e.g., draw all shadow/base circles, then draw all emojis, then draw all floating health bars).
