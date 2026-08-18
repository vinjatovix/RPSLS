# FINAL SPEC: Spec #13 - Canvas Rendering Optimization: Cache & Particle Batching

## Context
**Problem/Opportunity:**
1. **Font Rasterization Overhead:** `EnemyRenderer.drawEmoji()` currently renders emojis using `this.context.fillText(...)` in every frame. In HTML5 Canvas, drawing text forces the rendering engine to vectorially rasterize fonts dynamically, which consumes substantial CPU/GPU time.
2. **Context Save/Restore Thrashing:** Every individual `Particle.draw()` call invokes `ctx.save()`, `ctx.translate()`, `ctx.fillStyle = ...`, `ctx.beginPath()`, `ctx.arc()`, `ctx.fill()`, and `ctx.restore()`. When there are hundreds of active particles (e.g., blood splatters or power-up bursts), this creates a massive CPU bottleneck because state modifications (especially `save` and `restore`) are highly expensive operations.

**Impact:**
Frame-rate degradation and micro-stuttering during high-intensity combats when particle count exceeds 200, particularly on mobile browsers and lower-end hardware.

## Objectives
- [ ] Implement an **Offscreen Canvas Caching** mechanism to pre-rasterize emoji sprites once at startup.
- [ ] Refactor `EnemyRenderer.drawEmoji()` to draw cached canvas images instead of calling `fillText()` dynamically.
- [ ] Optimize the particle rendering pipeline by eliminating individual `ctx.save()` / `ctx.restore()` calls, wrapping the batch in a single context wrapper instead.
- [ ] Group (batch) particle drawing operations to drastically reduce GPU state changes.

## Architecture & Design

### Affected Modules
- `src/index.js` (Initializes and manages the cache lifecycle)
- `src/entities/EnemyRenderer.js` (Consumes pre-rendered emoji canvas sheets)
- `src/particles/ParticleSystem.js` (Wraps the particle render pass)
- `src/particles/Particle.js` (Removes redundant context nesting)

### Structural Changes

#### 1. Emoji Image Cache (`EmojiCache`)
We will introduce a lightweight static cache structure (or a manager class) that pre-allocates an offscreen Canvas element for each active team emoji.
Instead of drawing the emoji as a vector font dynamically, we render it once into a $32 \times 32$ pixels offscreen canvas buffer, and then blit it onto the main screen using `ctx.drawImage()`.

#### 2. Particle Batch Rendering Loop
We will remove `ctx.save()` and `ctx.restore()` from `Particle.draw()`.
Instead, `ParticleSystem.draw()` will open a single context block:
1. Call `ctx.save()` once.
2. Iterate through all particles, setting only the relevant `globalAlpha` and `fillStyle` changes, and calling `ctx.drawImage` or absolute coordinate drawing.
3. Call `ctx.restore()` once at the end of the entire loop.

### Interface/API Contract

```js
// Cache utility to rasterize emojis
export class EmojiCache {
  static cache = {};

  static init(racesConfig) {
    for (const [key, config] of Object.entries(racesConfig)) {
      const offscreen = document.createElement("canvas");
      offscreen.width = 32;
      offscreen.height = 32;
      
      const ctx = offscreen.getContext("2d");
      ctx.font = "20px Arial";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(config.emoji, 16, 16);
      
      this.cache[config.emoji] = offscreen;
    }
  }

  static get(emoji) {
    return this.cache[emoji] || null;
  }
}
```

### Data Flow

#### Emoji Caching
1. **Game Bootstrap:** During game load (`DOMContentLoaded` in `src/index.js`), `EmojiCache.init(RACE_STATS)` is called.
2. **Rendering Phase:** When drawing an entity, `EnemyRenderer.drawEmoji()` retrieves the pre-rendered canvas via `EmojiCache.get(this.entity.emoji)`.
3. **GPU Blit:** If present, `ctx.drawImage(cachedCanvas, -16, -16)` executes. If missing, it falls back gracefully to `ctx.fillText`.

#### Particle Batching
1. **Draw Phase:** `Game.draw()` invokes `this.particles.draw()`.
2. **Batching block:**
   ```js
   draw() {
     this.context.save();
     for (const particle of this.particles) {
       particle.draw(); // Draws absolutely on canvas, no inner save/restore
     }
     this.context.restore();
   }
   ```

## Verification Plan (Definition of Done)

### Automated Tests
- [ ] Unit test in `test/emoji-cache.test.mjs` verifying that `EmojiCache.init()` populates canvases correctly.
- [ ] Integration test ensuring that `EnemyRenderer` successfully queries the emoji cache.
- [ ] Verify that all existing unit and balance tests still pass (`npm test`).

### Manual Verification
- [ ] Open the browser, check that all team emojis and character faces display with correct sizes, positions, and rotation angles.
- [ ] Simulate a match with 250+ particles and observe the rendering profile in Chrome DevTools; verify that `save` / `restore` calls drop to near-zero per-frame levels.

## Risks & Mitigations
- **Risk:** High-DPI (Retina) screens might see blurred emojis if $32 \times 32$ pixels is too small.
- **Mitigation:** Scale the cache dimensions dynamically by multiplying by `window.devicePixelRatio` (e.g., $64 \times 64$ for a ratio of 2), ensuring pixel-perfect sharpness.
