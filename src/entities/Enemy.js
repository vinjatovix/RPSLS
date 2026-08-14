/**
 * Enemy - Entidad base de las razas
 * Extraída del index.js original
 * Lee sus estadísticas de RACE_STATS (config) en vez de hardcodearlas
 * Aplica modifiers (mejoras del jugador) y buffs (powerups)
 */

import { RACE_STATS } from "../config/gameConfig.js";
import { CollisionDetector } from "../canvas/geometry/CollisionDetector.js";

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
    this.aimX = null;
    this.aimY = null;
    this.closest = null;
    this.killedBy = null;
    this.dead = false;
    this.offScreen = false;

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
    return mult;
  }

  getTurnMultiplier() {
    return this.isBuffActive("turn") ? this.buffs.turn.amount : 1;
  }

  getDamage() {
    let damage = this.baseDamage * this.damageMultiplier;
    if (this.isBuffActive("damage")) damage += this.buffs.damage.amount;
    return damage;
  }

  getIncomingDamageMultiplier() {
    return this.isBuffActive("armor") ? this.buffs.armor.amount : 1;
  }

  #kill(enemy) {
    if (this.aim.includes(enemy.team)) {
      enemy.life -= this.getDamage() * enemy.getIncomingDamageMultiplier();
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
    this.angle = angleDiff < 0 ? this.angle + this.rotationSpeed * turnMult : this.angle - this.rotationSpeed * turnMult;
  }

  #calculateSpeed(angleDiff) {
    const speedMult = this.getSpeedMultiplier();
    if (Math.abs(angleDiff) < Math.PI / 12) {
      this.speed += this.acceleration * speedMult;
    }
    if (Math.abs(angleDiff) > Math.PI / 8) {
      this.speed -= this.deceleration * speedMult;
    }

    this.#limitSpeed();
  }

  #goCenter() {
    const { x, y } = this.game.canvasManager.getCenter();
    this.aimX = x;
    this.aimY = y;
  }

  #setTarget(allEnemies) {
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
    } else {
      this.#goCenter();
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

    this.game.options.mechanics.limitCanvas && this.#limitPosition();
  }

  update(deltaTime, allEnemies) {
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

  #drawDirectionArrow() {
    this.ctx.strokeStyle = this.color;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.lineTo(
      this.x + this.width / 2 + Math.cos(this.angle) * this.width,
      this.y + this.height / 2 + Math.sin(this.angle) * this.height
    );
    this.ctx.stroke();
  }

  #drawDirectionDot() {
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(
      this.x + this.width / 2 + Math.cos(this.angle) * this.width,
      this.y + this.height / 2 + Math.sin(this.angle) * this.height,
      5,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
  }

  #drawDirectionTriangle() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.moveTo(
      this.x + this.width / 2 + Math.cos(this.angle) * this.width,
      this.y + this.height / 2 + Math.sin(this.angle) * this.height
    );
    this.ctx.lineTo(
      this.x + this.width / 2 + Math.cos(this.angle + Math.PI / 4) * this.width,
      this.y + this.height / 2 + Math.sin(this.angle + Math.PI / 4) * this.height
    );
    this.ctx.lineTo(
      this.x + this.width / 2 + Math.cos(this.angle - Math.PI / 4) * this.width,
      this.y + this.height / 2 + Math.sin(this.angle - Math.PI / 4) * this.height
    );
    this.ctx.fill();
    this.ctx.restore();
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
    this.game.options.effects.arrow && this.#drawDirectionArrow();
    this.game.options.effects.dot && this.#drawDirectionDot();
    this.game.options.effects.triangle && this.#drawDirectionTriangle();
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
