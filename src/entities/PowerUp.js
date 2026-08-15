import { POWERUP_TYPES, GAME_CONFIG } from "../config/gameConfig.js";
import { GLOBAL_EFFECT_HANDLERS, TARGET_EFFECT_HANDLERS } from "./powerupHandlers.js";

export class PowerUp {
  constructor({ game }) {
    this.game = game;
    this.context = this.game.canvasAdapter.getContext();
    this.type = this.#pickType();
    const config = POWERUP_TYPES[this.type];
    const spawn = this.game.canvasAdapter.getRandomSpawnPoint();

    this.x = spawn.x;
    this.y = spawn.y;
    this.width = 22;
    this.height = 22;
    this.emoji = config.emoji;
    this.color = config.color;
    this.lifetime = 10000;
    this.bornAt = this.game.gameTime;
    this.pulse = 0;
    this.dead = false;
    this.velocityX = (Math.random() * 2 - 1) * 1.1;
    this.velocityY = (Math.random() * 2 - 1) * 1.1;
  }

  #pickType() {
    const total = Object.values(POWERUP_TYPES).reduce((sum, type) => sum + type.weight, 0);
    let roll = Math.random() * total;
    for (const [key, config] of Object.entries(POWERUP_TYPES)) {
      roll -= config.weight;
      if (roll <= 0) return key;
    }

    return "heal";
  }

  isExpired() {
    return this.game.gameTime - this.bornAt > this.lifetime;
  }

  #updateAxis({ velocity, coordinate, dimensionName, dimension, frameFactor, margin }) {
    let updatedCoordinate = coordinate + velocity * frameFactor;
    let updatedVelocity = velocity;

    if (updatedCoordinate < margin) {
      updatedCoordinate = margin;
      updatedVelocity = Math.abs(velocity);
    } else if (updatedCoordinate > dimension - this[dimensionName] - margin) {
      updatedCoordinate = dimension - this[dimensionName] - margin;
      updatedVelocity = -Math.abs(velocity);
    }

    return { updatedCoordinate, updatedVelocity };
  }

  update(deltaTime) {
    if (this.isExpired()) {
      this.dead = true;
      return;
    }

    const frameFactor = deltaTime / 30;
    const { width, height } = this.game.canvasAdapter.getSize();
    const margin = GAME_CONFIG.mechanics.ai.escape.margin;

    const rx = this.#updateAxis({ velocity: this.velocityX, coordinate: this.x, dimensionName: 'width', dimension: width, frameFactor, margin });
    const ry = this.#updateAxis({ velocity: this.velocityY, coordinate: this.y, dimensionName: 'height', dimension: height, frameFactor, margin });

    this.x = rx.updatedCoordinate;
    this.y = ry.updatedCoordinate;
    this.velocityX = rx.updatedVelocity;
    this.velocityY = ry.updatedVelocity;
  }

  applyTo(enemy) {
    this.applyToTeam(enemy.team);
  }

  applyToTeam(team) {
    this.#applyEffectToTeam(team);
    this.#consume();
  }

  applyToOthers(team) {
    const others = new Set(
      this.game.enemies.filter(e => !e.dead && e.team !== team).map(e => e.team)
    );
    for (const other of others) {
      this.#applyEffectToTeam(other);
    }
    this.#consume();
  }

  applyForClick(team) {
    if (POWERUP_TYPES[this.type].trap) {
      this.applyToOthers(team);
    } else {
      this.applyToTeam(team);
    }
  }

  #applyEffectToTeam(team) {
    const config = POWERUP_TYPES[this.type];
    const game = this.game;

    const global = GLOBAL_EFFECT_HANDLERS[this.type];
    if (global) {
      global(this, team, config);
      return;
    }

    const targets = game.enemies.filter(e => !e.dead && e.team === team);
    const handler = TARGET_EFFECT_HANDLERS[this.type];
    const duration =
      team === game.progressManager.selectedTeam
        ? config.duration * game.progressManager.getPowerupDurationMultiplier()
        : config.duration;
    for (const target of targets) {
      if (handler) {
        handler(target, config);
      } else {
        target.applyBuff(this.type, duration, config.amount);
      }
    }
  }

  #consume() {
    this.dead = true;
    const config = POWERUP_TYPES[this.type];
    this.game.particles.powerUpBurst(this.x + this.width / 2, this.y + this.height / 2, config.color);
    this.game.particles.showFloatingText(
      this.x + this.width / 2,
      this.y + this.height / 2,
      config.label,
      config.color
    );
  }

  draw() {
    this.pulse += 0.1;
    const scale = 1 + Math.sin(this.pulse) * 0.12;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    this.context.save();
    this.context.globalAlpha = 0.25;
    this.context.fillStyle = this.color;
    this.context.beginPath();
    this.context.arc(centerX, centerY, this.width / 2 * scale, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();

    this.context.save();
    this.context.translate(centerX, centerY);
    this.context.scale(scale, scale);
    this.context.font = "16px Arial";
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.fillText(this.emoji, 0, 1);
    this.context.restore();
  }
}
