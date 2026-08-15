/**
 * Enemy - Entidad base de las razas
 * Extraída del index.js original
 * Lee sus estadísticas de RACE_STATS (config) en vez de hardcodearlas
 * Aplica modifiers (mejoras del jugador) y buffs (powerups)
 */

import { RACE_STATS, GAME_CONFIG } from "../config/gameConfig.js";
import { CollisionDetector } from "../canvas/geometry/CollisionDetector.js";

/**
 * Mapa estático: para cada equipo, qué equipos pueden dañarlo (predadores).
 * Derivado una vez de RACE_STATS.aim (caza asimétrica).
 */
const PREDATORS = {};
for (const team of Object.keys(RACE_STATS)) {
  PREDATORS[team] = Object.keys(RACE_STATS).filter(predator =>
    RACE_STATS[predator].aim.includes(team)
  );
}

export class Enemy {
  constructor({ game, x = null, y = null, angle = null, modifiers = null }, team = "rocks") {
    this.team = team;
    const stats = RACE_STATS[team];
    const scale = game.canvasManager.getScale();
    const mods = modifiers || { hp: 1, damage: 1, speed: 1, accel: 1, turn: 1 };
    const m = stats.movement;

    this.emoji = stats.emoji;
    this.color = stats.color;
    this.aim = [...stats.aim];

    this.game = game;
    this.ctx = this.game.canvasManager.getCtx();
    const spawn = this.game.canvasManager.getRandomSpawnPoint();
    this.x = x || spawn.x;
    this.y = y || spawn.y;

    this.speed = (m.baseSpeed + Math.random() * m.speedVariance) * mods.speed * scale;
    this.maxSpeed = m.maxSpeed * mods.speed * (scale * 1.5);
    this.minSpeed = m.minSpeed;
    this.acceleration = m.acceleration * mods.accel * scale * 2;
    this.deceleration = m.deceleration * mods.accel * scale;
    this.rotationSpeed = m.rotationSpeed * mods.turn * (1 + scale);
    this.rotationAcceleration = m.rotationAcceleration * mods.turn * (1 + scale);
    this.angle = angle || Math.random() * 2 * Math.PI;

    this.width = 20;
    this.height = 20;
    this.vx = 0;
    this.vy = 0;
    this.angularVelocity = 0;
    this.aimX = null;
    this.aimY = null;
    this.closest = null;
    this.killedBy = null;
    this.dead = false;
    this.offScreen = false;
    this.fleeing = false;

    this.maxLife = Math.round(stats.health.max * mods.hp);
    this.life = this.maxLife;
    this.baseDamage = stats.damage.amount;
    this.damageMultiplier = mods.damage;

    this.buffs = {};
  }

  /**
   * Aplicar un buff/debuff temporal (usando gameTime del juego)
   */
  applyBuff(type, duration, amount) {
    this.buffs[type] = { until: this.game.gameTime + duration, amount };
  }

  /**
   * Comprobar si un buff sigue activo (y limpiarlo si expiró)
   */
  isBuffActive(type) {
    const buff = this.buffs[type];
    if (!buff) return false;
    if (this.game.gameTime > buff.until) {
      delete this.buffs[type];
      return false;
    }
    return true;
  }

  getSpeedMultiplier() {
    let mult = 1;
    if (this.isBuffActive("speed")) mult *= this.buffs.speed.amount;
    if (this.isBuffActive("slow")) mult *= this.buffs.slow.amount;
    if (this.isBuffActive("freeze")) mult *= this.buffs.freeze.amount;
    return mult;
  }

  getAccelMultiplier() {
    return this.isBuffActive("haste") ? this.buffs.haste.amount : 1;
  }

  getTurnMultiplier() {
    return this.isBuffActive("turn") ? this.buffs.turn.amount : 1;
  }

  getDamage() {
    let damage = this.baseDamage * this.damageMultiplier;
    if (this.isBuffActive("damage")) damage *= this.buffs.damage.amount;
    return damage;
  }

  getIncomingDamageMultiplier() {
    return this.isBuffActive("armor") ? this.buffs.armor.amount : 1;
  }

  #kill(enemy) {
    if (this.aim.includes(enemy.team)) {
      const damage = this.getDamage() * enemy.getIncomingDamageMultiplier();
      enemy.life -= damage;
      if (this.isBuffActive("vampire") && damage > 0) {
        this.life = Math.min(this.maxLife, this.life + damage * this.buffs.vampire.amount);
      }
      if (enemy.life <= 0) {
        enemy.dead = true;
        enemy.killedBy = this.team;
        this.game.scoreManager.recordKill(this.team, enemy.team);
      }
    }
  }

  #checkCollision(allEnemies) {
    for (const enemy of allEnemies) {
      if (enemy !== this && CollisionDetector.checkOverlap(this, enemy)) {
        this.#kill(enemy);
      }
    }
  }

  #checkPosition() {
    const canvasSize = this.game.canvasManager.getSize();
    this.offScreen = !CollisionDetector.isVisible(this.x, this.y, this.width, this.height, canvasSize);
    if (this.offScreen && this.game.options.mechanics.outDies) {
      this.dead = true;
    }
  }

  #limitPosition() {
    const clamped = this.game.canvasManager.clampPosition(this);
    this.x = clamped.x;
    this.y = clamped.y;
  }

  #limitSpeed() {
    const speedMult = this.getSpeedMultiplier();
    if (this.speed > this.maxSpeed * speedMult) {
      this.speed = this.maxSpeed * speedMult;
    }
    if (this.speed < this.minSpeed * speedMult) {
      this.speed = this.minSpeed * speedMult;
    }
  }

  #calculateAngleDiff() {
    const angleDiff = this.angle - Math.atan2(this.aimY - this.y, this.aimX - this.x);
    if (angleDiff > Math.PI) {
      return angleDiff - 2 * Math.PI;
    }
    if (angleDiff < -Math.PI) {
      return angleDiff + 2 * Math.PI;
    }
    return angleDiff;
  }

  #calculateRotationSpeed(angleDiff) {
    const turnMult = this.getTurnMultiplier();
    const maxAngular = this.rotationSpeed * turnMult;
    const accel = this.rotationAcceleration * turnMult;
    this.angularVelocity += (angleDiff < 0 ? 1 : -1) * accel;
    if (this.angularVelocity > maxAngular) {
      this.angularVelocity = maxAngular;
    }
    if (this.angularVelocity < -maxAngular) {
      this.angularVelocity = -maxAngular;
    }
    this.angle += this.angularVelocity;
  }

  #calculateSpeed(angleDiff) {
    const speedMult = this.getSpeedMultiplier();
    const accelMult = this.getAccelMultiplier();
    if (Math.abs(angleDiff) < Math.PI / 12) {
      this.speed += this.acceleration * speedMult * accelMult;
    }
    if (Math.abs(angleDiff) > Math.PI / 8) {
      this.speed -= this.deceleration * speedMult * accelMult;
    }

    this.#limitSpeed();
  }

  #goCenter() {
    const { x, y } = this.game.canvasManager.getCenter();
    this.aimX = x;
    this.aimY = y;
  }

  #flee(allEnemies) {
    const radius = GAME_CONFIG.mechanics.ai.dangerRadius;
    let threat = null;
    for (const enemy of allEnemies) {
      if (enemy.dead || !PREDATORS[this.team].includes(enemy.team)) continue;
      const dx = this.x - enemy.x;
      const dy = this.y - enemy.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius && (!threat || d2 < threat.d2)) {
        threat = { x: dx, y: dy, d2 };
      }
    }
    if (!threat) return false;
    const dist = Math.sqrt(threat.d2) || 1;
    const ux = threat.x / dist;
    const uy = threat.y / dist;
    const { width, height } = this.game.canvasManager.getSize();
    const margin = 30;
    let tx = this.x + ux * radius;
    let ty = this.y + uy * radius;
    if (tx < margin) tx = margin + (margin - tx);
    else if (tx > width - margin) tx = width - margin - (tx - (width - margin));
    if (ty < margin) ty = margin + (margin - ty);
    else if (ty > height - margin) ty = height - margin - (ty - (height - margin));
    this.aimX = tx;
    this.aimY = ty;
    return true;
  }

  #setTarget(allEnemies) {
    if (this.isBuffActive("confusion")) {
      this.closest = null;
      this.fleeing = false;
      this.aimX = Math.random() * this.game.canvasManager.getWidth();
      this.aimY = Math.random() * this.game.canvasManager.getHeight();
      return;
    }
    this.closest = null;
    for (const enemy of allEnemies) {
      if (this.aim.includes(enemy.team) && !enemy.dead) {
        if (this.closest) {
          if (
            Math.sqrt(Math.pow(this.x - enemy.x, 2) + Math.pow(this.y - enemy.y, 2)) <
            Math.sqrt(Math.pow(this.x - this.closest.x, 2) + Math.pow(this.y - this.closest.y, 2))
          ) {
            this.closest = enemy;
          }
        } else {
          this.closest = enemy;
        }
      }
    }
    if (this.closest) {
      this.aimX = this.closest.x;
      this.aimY = this.closest.y;
      this.fleeing = false;
    } else {
      this.fleeing = this.#flee(allEnemies);
      if (!this.fleeing) this.#goCenter();
    }
  }

  move(deltaTime) {
    const d = deltaTime / 30;
    const angleDiff = this.#calculateAngleDiff();
    this.#calculateRotationSpeed(angleDiff);
    this.#calculateSpeed(angleDiff);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.x += this.vx * d;
    this.y += this.vy * d;

    if (this.game.options.mechanics.limitCanvas) {
      this.#limitPosition();
    }
  }

  update(deltaTime, allEnemies) {
    if (this.isBuffActive("regen")) {
      this.life = Math.min(this.maxLife, this.life + this.buffs.regen.amount * (deltaTime / 1000));
    }
    this.#checkPosition();
    this.#setTarget(allEnemies);
    this.move(deltaTime);
    this.#checkCollision(allEnemies);
  }

  #drawRectangle() {
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  #drawLineToAim() {
    if (
      this.aimX === this.game.canvasManager.getWidth() / 2 &&
      this.aimY === this.game.canvasManager.getHeight() / 2
    )
      return;
    this.ctx.strokeStyle = this.color;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.lineTo(this.aimX + this.width / 2, this.aimY + this.height / 2);
    this.ctx.stroke();
  }

  #drawHealthBar() {
    this.ctx.save();
    this.ctx.fillStyle = "red";
    this.ctx.fillRect(this.x, this.y - 10, this.width, 5);
    this.ctx.fillStyle = "green";
    this.ctx.fillRect(this.x, this.y - 10, (this.width * this.life) / this.maxLife, 5);
    this.ctx.restore();
  }

  draw() {
    this.#drawHealthBar();
    this.game.options.effects.collider && this.#drawRectangle();
    this.game.options.effects.debug && this.#drawLineToAim();
    this.ctx.font = "20px Arial";
    this.drawEmoji();
  }

  drawEmoji() {
    this.ctx.save();
    this.ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.rotate(this.angle + Math.PI / 2);
    this.ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.ctx.fillText(this.emoji, this.x - 2.5, this.y + 16);
    this.ctx.restore();
  }
}
