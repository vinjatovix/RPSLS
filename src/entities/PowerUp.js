/**
 * PowerUp - Item de efecto aleatorio que spawnea en el mapa
 * Se recoge por colisión con cualquier entidad
 * Positivo o trampa según POWERUP_TYPES
 */

import { POWERUP_TYPES } from "../config/gameConfig.js";

export class PowerUp {
  constructor({ game }) {
    this.game = game;
    this.ctx = this.game.canvasManager.getCtx();
    this.type = this.#pickType();
    const config = POWERUP_TYPES[this.type];
    const spawn = this.game.canvasManager.getRandomSpawnPoint();

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
    this.vx = (Math.random() * 2 - 1) * 1.1;
    this.vy = (Math.random() * 2 - 1) * 1.1;
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

  /**
   * Deriva lentamente rebotando en los bordes del canvas.
   */
  update(deltaTime) {
    if (this.isExpired()) {
      this.dead = true;
      return;
    }
    const d = deltaTime / 30;
    const { width, height } = this.game.canvasManager.getSize();
    this.x += this.vx * d;
    this.y += this.vy * d;

    const margin = 22;
    if (this.x < margin) {
      this.x = margin;
      this.vx = Math.abs(this.vx);
    } else if (this.x > width - this.width - margin) {
      this.x = width - this.width - margin;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y < margin) {
      this.y = margin;
      this.vy = Math.abs(this.vy);
    } else if (this.y > height - this.height - margin) {
      this.y = height - this.height - margin;
      this.vy = -Math.abs(this.vy);
    }
  }

  /**
   * Aplicar efecto a todo el equipo de la entidad que lo recoge
   * (incluidas las trampas). El efecto de tiempo es global al match.
   */
  applyTo(enemy) {
    this.applyToTeam(enemy.team);
  }

  /**
   * Aplicar efecto a un equipo por nombre (usado también desde el puntero).
   */
  applyToTeam(team) {
    this.#applyEffectToTeam(team);
    this.#consume();
  }

  /**
   * Aplicar el efecto a todos los equipos excepto el indicado.
   */
  applyToOthers(team) {
    const others = new Set(
      this.game.enemies.filter(e => !e.dead && e.team !== team).map(e => e.team)
    );
    for (const other of others) {
      this.#applyEffectToTeam(other);
    }
    this.#consume();
  }

  /**
   * Efecto de un click del jugador: los positivos van a su equipo,
   * los negativos (trampas) van a todos los demás equipos.
   */
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

    if (this.type === "time") {
      game.timeLeft += config.amount;
      return;
    }

    const targets = game.enemies.filter(e => !e.dead && e.team === team);
    for (const target of targets) {
      switch (this.type) {
        case "heal":
          target.life = Math.min(target.maxLife, target.life + config.amount);
          break;
        case "zap":
          target.life -= config.amount;
          if (target.life <= 0) {
            target.dead = true;
            target.killedBy = null;
          }
          break;
        default:
          target.applyBuff(this.type, config.duration, config.amount);
      }
    }
  }

  #consume() {
    this.dead = true;
    this.game.particles.powerUpBurst(this.x + this.width / 2, this.y + this.height / 2, this.color);
  }

  draw() {
    this.pulse += 0.1;
    const scale = 1 + Math.sin(this.pulse) * 0.12;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    this.ctx.save();
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.width / 2 * scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.scale(scale, scale);
    this.ctx.font = "16px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(this.emoji, 0, 1);
    this.ctx.restore();
  }
}
