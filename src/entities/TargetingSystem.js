import { pickEscapePoint } from "../canvas/index.js";
import { Random } from "../core/index.js";

export class TargetingSystem {
  constructor(entity, canvasAdapter, buffManager) {
    this.entity = entity;
    this.canvasAdapter = canvasAdapter;
    this.buffManager = buffManager;

    if (!this.entity.game || !this.entity.game.predators) {
      throw new TypeError("game.predators is required");
    }
    this.predators = this.entity.game.predators[this.entity.team];
    if (!this.predators) {
      throw new TypeError(`predators map is missing for team ${this.entity.team}`);
    }
  }

  #distanceSquared(a, b) {
    const ax = a.x + (a.width || 0) / 2;
    const ay = a.y + (a.height || 0) / 2;
    const bx = b.x + (b.width || 0) / 2;
    const by = b.y + (b.height || 0) / 2;
    const dx = ax - bx;
    const dy = ay - by;

    return dx * dx + dy * dy;
  }

  #findNearest(allEnemies, predicate, radius = null) {
    let nearest = null;
    let minDistSq = Infinity;

    let candidates = allEnemies;
    const grid = this.entity.game?.spatialGrid;
    if (grid && radius !== null) {
      const cx = this.entity.x + (this.entity.width || 0) / 2;
      const cy = this.entity.y + (this.entity.height || 0) / 2;
      candidates = grid.query(cx, cy, radius);
    }

    for (const enemy of candidates) {
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
    const activeTeams = this.entity.game?.activeTeams;
    if (activeTeams) {
      let hasAnyPrey = false;
      for (const aimTeam of this.entity.aim) {
        if (activeTeams.has(aimTeam)) {
          hasAnyPrey = true;
          break;
        }
      }
      if (!hasAnyPrey) {
        return null;
      }
    }

    const isPrey = enemy => this.entity.aim.includes(enemy.team);
    const grid = this.entity.game?.spatialGrid;

    if (grid) {
      if (grid.cellWidth <= 0) return null;

      const width = this.canvasAdapter?.getWidth() || grid.width || 800;
      const height = this.canvasAdapter?.getHeight() || grid.height || 600;
      const maxDiag = Math.hypot(width, height);
      let radius = grid.cellWidth * 1.5;

      while (radius < maxDiag) {
        const result = this.#findNearest(allEnemies, isPrey, radius);
        if (result) {
          return result.enemy;
        }
        radius *= 2;
      }

      const result = this.#findNearest(allEnemies, isPrey, maxDiag);

      return result?.enemy ?? null;
    }

    const result = this.#findNearest(allEnemies, isPrey, null);

    return result?.enemy ?? null;
  }

  #findClosestThreat(allEnemies) {
    const { dangerRadius } = this.entity.game.config.mechanics.ai;
    const dangerRadiusSq = dangerRadius * dangerRadius;
    const result = this.#findNearest(
      allEnemies,
      enemy => this.predators.includes(enemy.team),
      dangerRadius
    );
    if (!result || result.distSq >= dangerRadiusSq) return null;

    return {
      x: result.enemy.x + (result.enemy.width || 0) / 2,
      y: result.enemy.y + (result.enemy.height || 0) / 2
    };
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

    const { dangerRadius, escape } = this.entity.game.config.mechanics.ai;
    const cx = this.entity.x + (this.entity.width || 0) / 2;
    const cy = this.entity.y + (this.entity.height || 0) / 2;
    const aim = pickEscapePoint(
      { x: cx, y: cy },
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
        Random.next() * this.canvasAdapter.getWidth(),
        Random.next() * this.canvasAdapter.getHeight()
      );

      return;
    }

    const prey = this.#findClosestPrey(allEnemies);
    if (prey) {
      this.entity.closest = prey;
      this.entity.fleeing = false;
      const preyCx = prey.x + (prey.width || 0) / 2;
      const preyCy = prey.y + (prey.height || 0) / 2;
      this.#aimAt(preyCx, preyCy);
      
      return;
    }

    this.entity.closest = null;
    this.entity.fleeing = this.flee(allEnemies);
    if (!this.entity.fleeing) this.goCenter();
  }
}
