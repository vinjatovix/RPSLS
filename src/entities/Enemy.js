import { RACE_STATS } from "../config/gameConfig.js";
import { CollisionDetector } from "../canvas/index.js";
import { BuffManager } from "./BuffManager.js";
import { MovementController } from "./MovementController.js";
import { TargetingSystem } from "./TargetingSystem.js";
import { CombatSystem } from "./CombatSystem.js";
import { EnemyRenderer } from "./EnemyRenderer.js";

export class Enemy {
  constructor({ game, x = null, y = null, angle = null, modifiers = null }, team = "rocks") {
    this.team = team;
    const stats = RACE_STATS[team];
    const {
      health = 1,
      damage = 1,
      regeneration = 0,
      armor = 0,
      vampire = 0
    } = modifiers || {};

    this.emoji = stats.emoji;
    this.color = stats.color;
    this.aim = [...stats.aim];
    this.rotationOffset = stats.rotationOffset || 0;

    this.game = game;
    this.context = this.game.canvasAdapter.getContext();
    const spawn = this.game.canvasAdapter.getRandomSpawnPoint();
    this.x = x || spawn.x;
    this.y = y || spawn.y;
    this.angle = angle || Math.random() * 2 * Math.PI;

    this.width = 20;
    this.height = 20;
    this.aimX = null;
    this.aimY = null;
    this.closest = null;
    this.killedBy = null;
    this.dead = false;
    this.offScreen = false;
    this.fleeing = false;

    this.maxLife = Math.round(stats.health.max * health);
    this.life = this.maxLife;
    this.regeneration = regeneration;
    this.modifiers = modifiers;

    this.buffManager = new BuffManager(() => this.game.matchManager.gameTime);
    this.movementController = new MovementController({
      entity: this,
      stats,
      buffManager: this.buffManager,
      canvasAdapter: this.game.canvasAdapter,
      options: this.game.options
    });
    this.targetingSystem = new TargetingSystem(this, this.game.canvasAdapter, this.buffManager);
    this.combatSystem = new CombatSystem({
      entity: this,
      baseDamage: stats.damage.amount,
      damageMultiplier: damage,
      armor,
      vampire,
      buffManager: this.buffManager,
      scoreManager: this.game.scoreManager
    });
    this.renderer = new EnemyRenderer(this, this.context, this.game.canvasAdapter, this.game.options);
  }

  applyBuff(type, duration, amount) {
    this.buffManager.applyBuff(type, duration, amount);
  }

  isBuffActive(type) {
    return this.buffManager.isBuffActive(type);
  }

  getIncomingDamageMultiplier() {
    return this.combatSystem.getIncomingDamageMultiplier();
  }

  getDamage() {
    return this.combatSystem.getDamage();
  }

  getSpeedMultiplier() {
    return this.buffManager.getSpeedMultiplier();
  }

  getAccelMultiplier() {
    return this.buffManager.getMultiplier("haste");
  }

  getTurnMultiplier() {
    return this.buffManager.getMultiplier("turn");
  }

  get speed() {
    return this.movementController?.speed;
  }

  get acceleration() {
    return this.movementController?.acceleration;
  }

  get deceleration() {
    return this.movementController?.deceleration;
  }

  get baseDamage() {
    return this.combatSystem?.baseDamage;
  }

  get damageMultiplier() {
    return this.combatSystem?.damageMultiplier;
  }

  checkPosition() {
    const canvasSize = this.game.canvasAdapter.getSize();
    this.offScreen = !CollisionDetector.isVisible(this.x, this.y, this.width, this.height, canvasSize);
    if (this.offScreen && this.game.options.mechanics.outDies) {
      this.dead = true;
    }
  }

  move(deltaTime) {
    this.movementController.move(deltaTime);
  }

  update(deltaTime, allEnemies) {
    const regenerationBuff = this.buffManager.getMultiplier("regeneration");
    const regeneration = regenerationBuff !== null ? regenerationBuff : this.regeneration;
    if (regeneration > 0) {
      this.life = Math.min(this.maxLife, this.life + regeneration * (deltaTime / 1000));
    }
    this.checkPosition();
    this.targetingSystem.setTarget(allEnemies);
    this.move(deltaTime);
    this.combatSystem.checkCollision(allEnemies);
  }

  draw() {
    this.renderer.draw();
  }

  drawEmoji() {
    this.renderer.drawEmoji();
  }
}
