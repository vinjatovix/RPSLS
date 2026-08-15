import { GAME_CONFIG, RACE_STATS } from "../config/gameConfig.js";
import { pickEscapePoint } from "../canvas/geometry/EscapeSolver.js";

const PREDATORS = {};
for (const team of Object.keys(RACE_STATS)) {
  PREDATORS[team] = Object.keys(RACE_STATS).filter(
    predator => RACE_STATS[predator].aim.includes(team)
  );
}

export class TargetingSystem {
  constructor(entity, canvasAdapter, buffManager) {
    this.entity = entity;
    this.canvasAdapter = canvasAdapter;
    this.buffManager = buffManager;
  }

  #distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return dx * dx + dy * dy;
  }

  #findNearest(allEnemies, predicate) {
    let nearest = null;
    let minDistSq = Infinity;
    for (const enemy of allEnemies) {
      if (enemy.dead || !predicate(enemy)) continue;
      const distSq = this.#distanceSquared(this.entity, enemy);
      if (distSq < minDistSq) {
        nearest = enemy;
        minDistSq = distSq;
      }
    }

    return nearest ? { enemy: nearest, distSq: minDistSq } : null;
  }

  #findClosestPrey(allEnemies) {
    const result = this.#findNearest(allEnemies, enemy => this.entity.aim.includes(enemy.team));

    return result?.enemy ?? null;
  }

  #findClosestThreat(allEnemies) {
    const { dangerRadius } = GAME_CONFIG.mechanics.ai;
    const dangerRadiusSq = dangerRadius * dangerRadius;
    const result = this.#findNearest(
      allEnemies,
      enemy => PREDATORS[this.entity.team].includes(enemy.team)
    );
    if (!result || result.distSq >= dangerRadiusSq) return null;

    return { x: result.enemy.x, y: result.enemy.y };
  }

  #aimAt(x, y) {
    this.entity.aimX = x;
    this.entity.aimY = y;
  }

  goCenter() {
    const { x, y } = this.canvasAdapter.getCenter();
    this.#aimAt(x, y);
  }

  flee(allEnemies) {
    const threat = this.#findClosestThreat(allEnemies);
    if (!threat) return false;

    const { dangerRadius, escape } = GAME_CONFIG.mechanics.ai;
    const aim = pickEscapePoint(
      { x: this.entity.x, y: this.entity.y },
      threat,
      this.canvasAdapter.getSize(),
      { ...escape, radius: dangerRadius }
    );
    this.#aimAt(aim.x, aim.y);

    return true;
  }

  setTarget(allEnemies) {
    if (this.buffManager.isConfused()) {
      this.entity.closest = null;
      this.entity.fleeing = false;
      this.#aimAt(
        Math.random() * this.canvasAdapter.getWidth(),
        Math.random() * this.canvasAdapter.getHeight()
      );

      return;
    }

    const prey = this.#findClosestPrey(allEnemies);
    if (prey) {
      this.entity.closest = prey;
      this.entity.fleeing = false;
      this.#aimAt(prey.x, prey.y);
      
      return;
    }

    this.entity.closest = null;
    this.entity.fleeing = this.flee(allEnemies);
    if (!this.entity.fleeing) this.goCenter();
  }
}
