import { CollisionDetector } from "../canvas/index.js";
import { ParticleSystem } from "../particles/index.js";
import { EnemyFactory } from "./EnemyFactory.js";
import { PowerUp } from "./PowerUp.js";

export class EntityManager {
  constructor({ game, eventBus, progressManager }) {
    this.game = game;
    this.eventBus = eventBus;
    this.progressManager = progressManager;

    this.enemies = [];
    this.powerups = [];
    this.particles = new ParticleSystem({ game: this.game });
    this.powerupTimer = this.game.config.meta.powerupSpawnIntervalMs / this.progressManager.getPowerupLuck();
  }

  spawnMatch(enemyGroupCount) {
    this.enemies = EnemyFactory.spawnMatch(
      this.game,
      this.progressManager.selectedTeam,
      this.progressManager,
      enemyGroupCount
    );
    this.powerups = [];
    this.particles.clear();
    this.#syncSpatialGrid();
  }

  update(deltaTime) {
    this.game.matchManager.update(deltaTime, this.enemies);

    const dead = this.enemies.filter(enemy => enemy.dead);
    for (const killed of dead) {
      if (this.game.options.mechanics.capture) {
        const captured = EnemyFactory.captureEnemy(killed, this.game, this.progressManager);
        if (captured) {
          this.addCapturedEnemy(captured);
        }
      }
      this.particles.collision(killed.x, killed.y);
    }
    this.enemies = this.enemies.filter(enemy => !enemy.dead);

    this.#syncSpatialGrid();

    this.#updatePowerups(deltaTime);
    this.#executeAIPhase(deltaTime);
    this.#executeMovementPhase(deltaTime);

    this.#syncSpatialGrid();

    this.#executeCollisionPhase();

    this.particles.update(deltaTime);
  }

  #updatePowerups(deltaTime) {
    this.powerupTimer -= deltaTime;
    if (
      this.powerupTimer <= 0 &&
      this.powerups.length < this.game.config.meta.powerupMaxConcurrent + this.progressManager.getPowerupLimitBonus()
    ) {
      this.powerups.push(new PowerUp({ game: this.game }));
      this.powerupTimer = this.game.config.meta.powerupSpawnIntervalMs / this.progressManager.getPowerupLuck();
    }

    for (const powerup of this.powerups) {
      powerup.update(deltaTime);
      if (powerup.dead) continue;

      let candidates;
      const useGrid = this.game.spatialGrid && this.enemies.length > 0;
      if (useGrid) {
        candidates = this.game.spatialGrid.query(
          powerup.x + powerup.width / 2,
          powerup.y + powerup.height / 2,
          Math.max(powerup.width, powerup.height) * 1.5
        );
      } else {
        candidates = this.enemies;
      }

      for (const enemy of candidates) {
        if (!enemy.dead && CollisionDetector.checkOverlap(powerup, enemy)) {
          powerup.applyTo(enemy);
          break;
        }
      }
    }
    this.powerups = this.powerups.filter(powerup => !powerup.dead);
  }

  draw() {
    this.particles.draw();
    for (const powerup of this.powerups) {
      powerup.draw();
    }
    for (const enemy of this.enemies) {
      enemy.draw();
    }
  }

  addCapturedEnemy(enemy) {
    this.enemies.push(enemy);
  }
  
  getEnemies() {
    return this.enemies;
  }

  setEnemies(val) {
    this.enemies = val;
  }
  
  getPowerups() {
    return this.powerups;
  }

  setPowerups(val) {
    this.powerups = val;
  }

  #syncSpatialGrid() {
    this.game.spatialGrid.clear();
    this.game.activeTeams.clear();

    for (const enemy of this.enemies) {
      this.game.spatialGrid.insert(enemy);
      this.game.activeTeams.add(enemy.team);
    }
  }

  #executeAIPhase(deltaTime) {
    for (const enemy of this.enemies) {
      enemy.preUpdate(deltaTime, this.enemies);
    }
  }

  #executeMovementPhase(deltaTime) {
    for (const enemy of this.enemies) {
      enemy.move(deltaTime);
    }
  }

  #executeCollisionPhase() {
    for (const enemy of this.enemies) {
      enemy.postUpdate(this.enemies);
    }
  }
}
