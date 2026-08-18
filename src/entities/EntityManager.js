import { GAME_CONFIG } from "../config/gameConfig.js";
import { EnemyFactory } from "./EnemyFactory.js";
import { PowerUp } from "./PowerUp.js";
import { ParticleSystem } from "../particles/ParticleSystem.js";
import { CollisionDetector } from "../canvas/geometry/CollisionDetector.js";

export class EntityManager {
  constructor({ game, eventBus, progressManager }) {
    this.game = game;
    this.eventBus = eventBus;
    this.progressManager = progressManager;

    this.enemies = [];
    this.powerups = [];
    this.particles = new ParticleSystem({ game: this.game });
    this.powerupTimer = GAME_CONFIG.meta.powerupSpawnIntervalMs / this.progressManager.getPowerupLuck();
  }

  // Spawn initial match enemies and reset powerups/particles
  spawnMatch(enemyGroupCount) {
    this.enemies = EnemyFactory.spawnMatch(
      this.game,
      this.progressManager.selectedTeam,
      this.progressManager,
      enemyGroupCount
    );
    this.powerups = [];
    this.particles.particles = [];
  }

  // Update all active entities, handle collisions, spawn powerups, prune dead
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
    this.#updatePowerups(deltaTime);
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, this.enemies);
    }
    this.particles.update(deltaTime);
  }

  #updatePowerups(deltaTime) {
    this.powerupTimer -= deltaTime;
    if (
      this.powerupTimer <= 0 &&
      this.powerups.length < GAME_CONFIG.meta.powerupMaxConcurrent + this.progressManager.getPowerupLimitBonus()
    ) {
      this.powerups.push(new PowerUp({ game: this.game }));
      this.powerupTimer = GAME_CONFIG.meta.powerupSpawnIntervalMs / this.progressManager.getPowerupLuck();
    }

    for (const powerup of this.powerups) {
      powerup.update(deltaTime);
      if (powerup.dead) continue;
      for (const enemy of this.enemies) {
        if (!enemy.dead && CollisionDetector.checkOverlap(powerup, enemy)) {
          powerup.applyTo(enemy);
          break;
        }
      }
    }
    this.powerups = this.powerups.filter(powerup => !powerup.dead);
  }

  // Draw all active entities (enemies, powerups, particles)
  draw() {
    this.particles.draw();
    for (const powerup of this.powerups) {
      powerup.draw();
    }
    for (const enemy of this.enemies) {
      enemy.draw();
    }
  }

  // Add a newly captured enemy to the collection
  addCapturedEnemy(enemy) {
    this.enemies.push(enemy);
  }
  
  // Return list of all active enemies
  getEnemies() {
    return this.enemies;
  }

  setEnemies(val) {
    this.enemies = val;
  }
  
  // Return list of all active powerups
  getPowerups() {
    return this.powerups;
  }

  setPowerups(val) {
    this.powerups = val;
  }
}
