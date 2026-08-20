# FINAL SPEC: Spec #3 - Particle Object Pooling

## Context
**Problem/Opportunity:**
Combat generates large quantities of temporary particles (`BloodParticles.js`, `PowerUpEffects.js`). Currently, the game instantiates new objects on impact and deletes them from memory once dead. This creates heavy churn on the JavaScript memory heap and frequent Garbage Collection (GC) pauses.

**Impact:**
Micro-stuttering during intense battles with high particle density, breaking visual fluidness.

## Objectives
- [ ] Implement a reusable `ParticlePool` class.
- [ ] Modify `ParticleSystem.js` to lease particles from the pool instead of raw instantiation.
- [ ] Recycle dead particles by returning them to the pool for later reuse.

## Architecture & Design

### Affected Modules
- `src/particles/ParticleSystem.js`
- `src/particles/ParticlePool.js` (New)
- `src/particles/Particle.js` (Add reset/init contract)

### Structural Changes
- `ParticlePool` maintains pre-allocated arrays of deactivated `Particle` instances.
- `Particle` must support a clean `init(...)` or `reset(...)` method to reset its lifetime, position, velocity, and color.

### Interface/API Contract
```js
class ParticlePool {
  constructor(size) {}
  
  // Obtain an inactive particle, initializing its state
  acquire(type, x, y, options) {}
  
  // Release a dead particle back into the active pool
  release(particle) {}
}
```

### Data Flow
1. **Emitters (Combat/Power-ups):** Request particles from `ParticleSystem`.
2. **ParticleSystem:** Asks `ParticlePool` for a particle.
3. **If pool has inactive particles:** One is re-initialized and activated.
4. **If pool is exhausted:** Recycle oldest active particle or gracefully discard the request.
5. **On death:** Particles are marked inactive and returned to the pool, rather than being garbage-collected.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Unit test checking pool allocation, release, and size boundaries.
- [ ] Integration test verifying no new memory allocations occur after pool saturation.

### Manual Verification
- [ ] Record a 10-second memory profile in Chrome DevTools during heavy combat; confirm a flat "sawtooth" memory curve with near-zero GC spikes.

## Risks & Mitigations
- **Risk:** Particles retaining state from previous lifecycles (visual glitches).
- **Mitigation:** Enforce rigid, comprehensive state-reset routines in the `init()` method.
