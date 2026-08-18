# FINAL SPEC: Spec #2 - Spatial Partitioning for O(N²) Mitigation (UPDATED)

## Context
**Problem/Opportunity:**
Targeting (`TargetingSystem.js`) and collision detection (`CombatSystem.js` / `CollisionDetector.js`) run flat, nested loops over all active enemies. For $N$ active entities, this results in $O(N^2)$ calculations on *every* physics sub-step, creating a severe CPU bottleneck when the screen is crowded.

**Impact:**
Extreme frame-rate drop (lag spikes) during late-game stages when entity count exceeds 150. Heavy mobile battery drain and thermal throttling.

## Objectives
- [x] Implement a 2D Spatial Hash Grid (`SpatialGrid`).
- [x] Rebuild/update the grid dynamically on every physics update step, preventing state-sync bugs and stale data.
- [x] Refactor targeting and collision queries to retrieve only nearby candidate entities, dropping computational complexity to average $O(N)$ or $O(1)$ for near-field queries.

## Architecture & Design

### Affected Modules
- `src/canvas/geometry/SpatialGrid.js` (Update)
- `src/entities/TargetingSystem.js` (Querying, Incremental Search)
- `src/entities/CombatSystem.js` (Querying)
- `src/entities/EntityManager.js` (Lifecycle, Synchronization)
- `src/index.js` (Lifecycle & Grid updates)

### Structural Changes
- Introduce `SpatialGrid` as a global or game-owned system.
- `SpatialGrid` divides the viewport into a configurable grid of cells. Each cell holds a list of entity references currently residing within its boundaries.

### Interface/API Contract
```js
class SpatialGrid {
  constructor(cellWidth, cellHeight, options = {}) {}
  
  // Clear all grid cells and pool arrays to prevent garbage collection
  clear() {}
  
  // Insert an entity based on its coordinates (must handle toroidal wrapping if enabled)
  insert(entity) {}
  
  // Retrieve all entities in cells intersecting the given bounding circle
  query(x, y, radius, outCandidates) {}
}
```

### Data Flow & Synchronization Lifecycle
1. **Frame Start / Post-Filter:** At the beginning of `EntityManager.update()`, immediately after filtering out dead enemies, clear and rebuild `SpatialGrid`. This ensures that PowerUp queries and AI targeting do not query stale/dead entities.
2. **AI Phase:** `TargetingSystem` queries `SpatialGrid` for threats and preys.
3. **Movement Phase:** Enemies move and update coordinates.
4. **Post-Movement Sync:** Rebuild `SpatialGrid` with updated coordinates.
5. **Collision Phase:** `CombatSystem` queries `SpatialGrid` for nearby candidate entities for collisions.

### Performance & Memory Mandates (Non-Negotiable)
1. **No Hot-Path Allocations (Anti-GC Thrashing):** Do not instantiate `Set` or other dynamic helper objects inside query loops (including `queryToroidal`). Deduplicate cells or clamp search coordinates mathematically.
2. **Expanding/Incremental Search for Targeting:** `TargetingSystem.#findClosestPrey` must not run $O(N)$ scans over all entities. Instead, perform an incremental/expanding grid search:
   - Query a small starting radius (e.g., $1.5 \times \text{cellWidth}$ or $150$px).
   - If match found, return the closest.
   - If not found, double/increase the search radius and query again, up to a sensible maximum (e.g., map size / diagonal) before falling back to full scans.
   - **Safety Guard against Infinite Loops:** The doubling logic must guarantee that `radius` strictly increases in every iteration. If `grid.cellWidth` is `0` or less, the loop must not run, or a minimum starting radius of `1px` must be enforced to prevent an infinite CPU hang.
   - **No Redundant Fallback Scans:** If the search radius has reached or exceeded the map diagonal (`maxDiag`), a full map search has already been performed. If this query returns no candidate, it is mathematically certain that no prey exists. The developer MUST NOT execute a fallback $O(N)$ full-array scan in this case, as it causes massive performance degradation precisely when no preys are alive.
3. **Toroidal Coordinate Wrapping during Insertion:** If `isToroidal` is enabled, any insertion into the spatial grid must wrap coordinates to the grid bounds `[0, width)` and `[0, height)` first. This guarantees that wrapped queries correctly locate entities even if their positions are temporarily out of bounds.
4. **Shared Query Results Buffer:** To eliminate the overhead of allocating and holding onto individual `queryResults = []` arrays across 200+ instances of `TargetingSystem` and `CombatSystem`, the `SpatialGrid` or `Game` should expose a shared, pre-allocated internal query buffer that is cleared and reused. Since the game engine is single-threaded and strictly sequential, queries are processed entirely before the next one starts, making a single shared query results buffer completely safe and memory-efficient.
5. **Robust Active Teams Tracking:** To optimize targeting queries, the game must maintain a set of active teams (`activeTeams`). This set must be synchronized directly during the spatial grid rebuilds (`#syncSpatialGrid()`) in `EntityManager.js`, rather than relying on event-based subscriptions (like "kill" or "game:match-start"). Rebuilding `activeTeams` inside `#syncSpatialGrid()` ensures it is 100% accurate (handling off-screen deaths and captured/transformed entities) and runs in $O(N)$ only during the grid sync, entirely avoiding redundant full-array scans on every single kill event.

## Verification Plan (Definition of Done)
### Automated Tests
- [x] Unit tests for `SpatialGrid` insertion and querying accuracy.
- [x] Incremental/expanding query unit tests in `TargetingSystem`.
- [x] Benchmarking test verifying that queries with 200 entities run under 1ms.

### Manual Verification
- [x] Run game with 200 entities and observe stable 60 FPS in Chrome DevTools with zero GC stutter or lag spikes.
