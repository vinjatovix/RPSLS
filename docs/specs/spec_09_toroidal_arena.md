# Spec: Spec #9 - Toroidal Arena Mode

## Context
**Problem/Opportunity:**
Currently, all game modes (Liga, Infinito, Level) operate within a bounded arena where entities are "clamped" to the edges or die when they exit. This creates predictable "dead zones" and limits strategic movement. A **Toroidal Arena** (wrap-around) mode would allow entities to exit one side and reappear on the opposite side, significantly increasing tactical depth, movement fluidity, and eliminating edge-based out-of-bounds deaths.

**Impact:**
High. This change affects fundamental physics and geometry logic: movement, collision detection, targeting, and AI escape strategies.

## Objectives
- [ ] Implement wrap-around (toroidal) logic for entity movement.
- [ ] Implement toroidal-aware collision detection (detecting collisions across boundaries).
- [ ] Update targeting and combat systems to use the "shortest path" distance/angle in toroidal space.
- [ ] Update `EscapeSolver` to find escape points considering wrap-around paths.
- [ $\text{Toggle}$ ] Add a configuration option to enable/disable Toroidal mode via `GameSettings`.

## Architecture & Design

### Affected Modules
- `src/options/GameSettings.js`: To add the `isToroidal` mechanic flag.
- `src/entities/MovementController.js`: To replace/augment `limitPosition` with wrap-around logic when `isToroidal` is true.
- `src/canvas/geometry/CollisionDetector.js`: To implement periodic boundary condition checks.
- `src/canvas/geometry/EscapeSolver.js`: To update `clearanceToBoundary` and `pickEscapePoint` for toroidal geometry.
- `src/entities/TargetingSystem.js` & `src/entities/CombatSystem.js`: To use toroidal distance/angle calculations.
- `src/canvas/CanvasAdapter.js`: To provide utility methods for toroidal wrapping and distances.

### Structural Changes
- **`GameSettings`**: New property `mechanics.isToroidal: boolean`.
- **`MovementController`**: The `move()` method will branch: if `isToroidal`, use modulo-based wrapping; otherwise, use existing clamping.
- **`CollisionDetector`**: Collision checks will now consider the distance in a periodic space (checking "ghost" neighbors or using a distance function that respects wrap-around).
- **`EscapeSolver`**: The `clearanceToBoundary` will no longer return distance to a hard edge but the minimum distance to a wrapped edge.

### Interface/API Contract
- `CanvasAdapter.wrapPosition(entity)`: New method to handle the modulo math for wrapping coordinates.
- `CanvasAdapter.getToroidalDistance(p1, p2, arena)`: New utility for calculating the shortest distance between two points in a toroidal space.
- `CanvasAdapter.getTorentiallyWrappedAngle(angle, arena)`: Utility for adjusting angles for wrap-around.

### Data Flow
1. **Update Loop**: `MovementController` updates position $\rightarrow$ applies wrap-around if `isToroidal`.
2. **Collision Phase**: `CollisionDetector` iterates through entities $\rightarrow$ detects overlaps using toroidal-aware distance.
3. **Combat Phase**: `CombatSystem` calculates hits $\rightarrow$ uses `getToroidalDistance` to determine if a projectile/attack reaches the target.
4. **Rendering**: `EnemyRenderer` renders entities (no change needed as positions are already wrapped).

## Verification Plan (Definition of Done)

### Automated Tests
- [ ] Unit test: `MovementController` wraps position correctly (e.g., $x > width \rightarrow x \approx 0$).
- [ ] Unit test: `CollisionDetector` detects collision between an entity at $x=0$ and $x=width-1$.
- [ ] Unit test: `EscapeSolver` finds a target point that is across the boundary.
- [ ] Regression check: Ensure standard modes (Liga, Infinito, Level) still use clamping and `outDies` logic correctly.

### Manual Verification
- [ ] Verify that players and enemies visibly wrap around all four edges of the arena.
- [ ] Confirm projectiles/attacks can hit enemies through the wrap-around boundary.
- [ ] Ensure no performance regressions during high-density matches.

## Risks & Mitigations
- **Risk:** Significant performance hit due to increased complexity in collision/targeting (checking multiple boundary paths).
  - **Mitigation:** Use a spatial partitioning system (if present) or limit "ghost" checks to entities within a certain proximity to edges.
- **Risk:** Broken AI/Escape logic (AI might try to run "into" a wall that no longer exists).
  - **Mitigation:** Ensure `EscapeSolver` is fully updated to treat the arena as a continuous loop.
- **Risk:** Spatial Partitioning Coordinate Desynchronization during Dynamic Resizing.
  - **Mitigation:** If a spatial grid is used and Toroidal Mode is active, any dynamic resizing of the game arena (such as the canvas expansions handled by `MatchManager`) must also update the `SpatialGrid` dimensions (`width` and `height`) using a `resize(width, height)` interface. This prevents coordinate-wrapping mathematical desynchronization.
- **Risk:** Redundant arithmetic calculation overhead in critical query path.
  - **Mitigation:** Cache cell bounds and grid structure properties (like `cols` and `rows`) inside the `SpatialGrid` instance upon creation or resize, rather than recomputing them with `Math.ceil` on every single toroidal query.
