/**
 * Punto de entrada de la aplicación
 * Integra todos los módulos refactorizados
 * Mantiene la lógica original sin cambios de comportamiento
 */

import { GAME_CONFIG, RACE_STATS } from "./config/gameConfig.js";
import { Clock } from "./core/Clock.js";
import { EventBus } from "./core/EventBus.js";
import { CanvasManager } from "./canvas/CanvasManager.js";
import { CollisionDetector } from "./canvas/geometry/CollisionDetector.js";
import { InputHandler } from "./input/InputHandler.js";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter.js";
import { OptionsManager } from "./options/OptionsManager.js";
import { ScoreManager } from "./scoring/ScoreManager.js";

// ====================
// CLASES TEMPORALES
// ====================
// Estas clases siguen siendo del index.js original
// Se extraerán en pasos posteriores

class ScorePanel {
  constructor() {
    this.scoreListEl = document.getElementById("score-list");
    this.roundInfoEl = document.getElementById("round-info");
  }

  update(scoreManager, match, timeLeft, mechanics, lastWin) {
    const ranking = scoreManager.getRanking();
    this.scoreListEl.innerHTML = `
      <div class="score-head">
        <span>Team</span>
        <span>Wins</span>
        <span>Kills</span>
        <span>Deaths</span>
        <span>Ratio</span>
      </div>
      ${ranking
        .map(
          (team, i) => `
        <div class="score-item rank-${i}">
          <span>${team.emoji}</span>
          <span>${team.score}</span>
          <span>${team.kills}</span>
          <span>${team.deaths}</span>
          <span>${team.ratio}</span>
        </div>`
        )
        .join("")}`;

    this.roundInfoEl.innerHTML = `
      <p><strong>Match:</strong> ${match}</p>
      ${lastWin ? `<p><strong>Last:</strong> ${lastWin}</p>` : ""}
      ${
        !mechanics.timeless
          ? `<p class="timer-active"><strong>Time:</strong> ${Math.round(timeLeft / 1000)}s</p>`
          : ""
      }`;
  }
}

class DebugDrawer {
  constructor({ canvasManager, clock, options }) {
    this.canvasManager = canvasManager;
    this.clock = clock;
    this.options = options;
    this.ctx = this.canvasManager.getCtx();
    this.fontSize = this.canvasManager.getFontSize();
    this.position = this.canvasManager.getWidth() - 8 * this.fontSize;
  }

  #ctxSetup() {
    this.ctx.font = `${this.fontSize}px Arial`;
    this.ctx.fillStyle = "white";
  }

  draw() {
    this.fontSize = this.canvasManager.getFontSize();
    this.position = this.canvasManager.getWidth() - 8 * this.fontSize;
    if (!this.options.effects.debug) return;
    this.ctx.save();
    this.#ctxSetup();
    this.ctx.fillText(`${Math.round(this.clock.calculateFPS())} FPS`, this.position, this.fontSize);
    this.ctx.fillText(`${this.clock.deltaTime} ms`, this.position, 2 * this.fontSize);
    this.ctx.fillText(
      `${this.canvasManager.getWidth()}x${this.canvasManager.getHeight()}`,
      this.position,
      3 * this.fontSize
    );
    this.ctx.fillText(`Timeless: ${this.options.mechanics.timeless}`, this.position, 4 * this.fontSize);
    this.ctx.fillText(`Capture: ${this.options.mechanics.capture}`, this.position, 5 * this.fontSize);
    this.ctx.fillText(`LimitCanvas: ${this.options.mechanics.limitCanvas}`, this.position, 6 * this.fontSize);
    this.ctx.fillText(`OutDies: ${this.options.mechanics.outDies}`, this.position, 7 * this.fontSize);
    this.ctx.fillText(`Blood: ${this.options.effects.blood}`, this.position, 8 * this.fontSize);
    this.ctx.fillText(`Snuff: ${this.options.effects.snuff}`, this.position, 9 * this.fontSize);
    this.ctx.fillText(`Dot: ${this.options.effects.dot}`, this.position, 10 * this.fontSize);
    this.ctx.restore();
  }
}

class Enemy {
  constructor({ game, x = null, y = null, angle = null }) {
    this.emoji = "👾";
    this.game = game;
    this.ctx = this.game.canvasManager.getCtx();
    const spawn = this.game.canvasManager.getRandomSpawnPoint();
    this.x = x || spawn.x;
    this.y = y || spawn.y;
    this.speed = (Math.random() * 4 + 2) * this.game.canvasManager.getScale();
    this.maxSpeed = 15 * (this.game.canvasManager.getScale() * 1.5);
    this.minSpeed = 0.5;
    this.acceleration = 0.06 * this.game.canvasManager.getScale() * 2;
    this.deceleration = 0.06 * this.game.canvasManager.getScale();
    this.angle = angle || Math.random() * 2 * Math.PI;
    this.rotationSpeed = 0.0125 * (1 + this.game.canvasManager.getScale());
    this.rotationAcceleration = 0.0005 * (1 + this.game.canvasManager.getScale());
    this.width = 20;
    this.height = 20;
    this.vx = 0;
    this.vy = 0;
    this.aim = [Rock, Paper, Scissors, Lizard, Spock];
    this.aimX = null;
    this.aimY = null;
    this.closest = null;
    this.killedBy = null;
    this.team = "enemies";
    this.color = "black";
    this.dead = false;
    this.offScreen = false;
    this.life = 200;
    this.maxLife = 200;
    this.damage = 5;
  }

  #kill(enemy) {
    if (this.aim.includes(enemy.constructor)) {
      enemy.life -= this.damage;
      if (enemy.life <= 0) {
        enemy.dead = true;
        enemy.killedBy = this.constructor;
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
    if (this.speed > this.maxSpeed) {
      this.speed = this.maxSpeed;
    }
    if (this.speed < this.minSpeed) {
      this.speed = this.minSpeed;
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
    this.angle = angleDiff < 0 ? this.angle + this.rotationSpeed : this.angle - this.rotationSpeed;
  }

  #calculateSpeed(angleDiff) {
    if (Math.abs(angleDiff) < Math.PI / 12) {
      this.speed += this.acceleration;
    }
    if (Math.abs(angleDiff) > Math.PI / 8) {
      this.speed -= this.deceleration;
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
      if (this.aim.includes(enemy.constructor) && !enemy.dead) {
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

class Rock extends Enemy {
  constructor({ x, y, game }) {
    super({ x, y, game });
    this.emoji = "🪨";
    this.team = "rocks";
    this.aim = [Scissors, Lizard];
    this.color = "gray";
  }
}

class Paper extends Enemy {
  constructor({ x, y, game }) {
    super({ x, y, game });
    this.emoji = "📄";
    this.team = "papers";
    this.aim = [Rock, Spock];
    this.color = "purple";
  }
}

class Scissors extends Enemy {
  constructor({ x, y, game }) {
    super({ x, y, game });
    this.emoji = "✂️";
    this.team = "scissors";
    this.aim = [Paper, Lizard];
    this.color = "red";
  }

  drawEmoji() {
    this.ctx.save();
    this.ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.rotate(this.angle - Math.PI / 2);
    this.ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.ctx.fillText(this.emoji, this.x - 2, this.y + 16);
    this.ctx.restore();
  }
}

class Lizard extends Enemy {
  constructor({ x, y, game }) {
    super({ x, y, game });
    this.emoji = "🦎";
    this.team = "lizards";
    this.aim = [Spock, Paper];
    this.color = "green";
  }

  drawEmoji() {
    this.ctx.save();
    this.ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.rotate(this.angle + Math.PI / 1.5);
    this.ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.ctx.fillText(this.emoji, this.x - 2, this.y + 16);
    this.ctx.restore();
  }
}

class Spock extends Enemy {
  constructor({ x, y, game }) {
    super({ x, y, game });
    this.emoji = "🖖";
    this.team = "spocks";
    this.aim = [Rock, Scissors];
    this.color = "yellow";
  }
}

class Particle {
  constructor({ ctx, x, y, game }) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.game = game;
    this.dead = false;
    this.vx = Math.random() * 0.5 - 0.25;
    this.vy = Math.random() * 0.5 - 0.25;
    this.life = 1000;
    this.opacity = 1;
    this.size = Math.random() * 5 + 5;
    this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
  }

  update(deltaTime) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.life -= deltaTime;
    this.opacity = this.life / 1000;
    if (this.life <= 0 || this.x < 0 || this.x > this.game.width || this.y < 0 || this.y > this.game.height) {
      this.dead = true;
    }
  }

  draw() {
    this.ctx.save();
    this.ctx.globalAlpha = this.opacity;
    this.ctx.translate(this.x, this.y);
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }
}

class BloodParticles extends Particle {
  constructor({ ctx, x, y, game, life = 650, size = 2, color = "red" }) {
    super({ ctx, x, y, game });
    this.vx = Math.random() * 0.5 - 0.25;
    this.vy = Math.random() * 0.5 - 0.25;
    this.life = life;
    this.size = 2;
    this.color = "red";
  }
}

class ParticleManager {
  constructor({ game }) {
    this.game = game;
    this.ctx = this.game.canvasManager.getCtx();
    this.particles = [];
  }

  addParticle(particle) {
    this.particles.push(particle);
  }

  collision(x, y) {
    for (let i = 0; i < 10; i++) {
      this.game.options.effects.blood &&
        this.addParticle(
          new BloodParticles({
            ctx: this.ctx,
            x,
            y,
            game: this.game,
            life: this.game.options.effects.snuff ? 3000 : 1000
          })
        );
    }
  }

  update(deltaTime) {
    for (const particle of this.particles) {
      particle.update(deltaTime);
    }
    this.particles = this.particles.filter(particle => !particle.dead);
  }

  draw() {
    for (const particle of this.particles) {
      particle.draw();
    }
  }
}

class Game {
  constructor({ startLevel = 0 } = {}) {
    // Inyectar dependencias
    this.inputHandler = new InputHandler();
    this.storageAdapter = new LocalStorageAdapter();
    this.options = new OptionsManager({
      inputHandler: this.inputHandler,
      storageAdapter: this.storageAdapter,
      gameConfig: GAME_CONFIG
    });

    this.canvasManager = new CanvasManager({
      canvasId: "canvas1",
      displayConfig: this.options.display
    });

    // Redimensionar canvas según nivel inicial (fiel al original)
    const { width, height } = this.canvasManager.resize(startLevel);
    this.width = width;
    this.height = height;

    this.clock = new Clock();
    this.eventBus = new EventBus();

    this.debugDrawer = new DebugDrawer({
      canvasManager: this.canvasManager,
      clock: this.clock,
      options: this.options
    });

    this.ctx = this.canvasManager.getCtx();
    this.width = this.canvasManager.getWidth();
    this.height = this.canvasManager.getHeight();
    this.timeLeft = 10000;
    this.match = startLevel;
    this.enemiesQty = Math.floor(startLevel / 10) || 1;
    this.scoreManager = new ScoreManager();
    this.scorePanel = new ScorePanel();
    this.enemies = [];
    this.lastWin = null;
    this.particles = new ParticleManager({ game: this });
    this.destroyed = false;
    this.rafId = null;

    this.#restart();
  }

  /**
   * Detener el juego y liberar todos sus recursos
   */
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.inputHandler.destroy();
  }

  #restart() {
    this.options.setMechanic("timeless", true);
    this.match++;
    this.enemiesQty = Math.floor(this.match / 10) || 1;

    if (this.match >= 50) {
      this.options.setMechanic("capture", false);
    }
    if (this.match >= 100) {
      this.options.setEffect("snuff", false);
    }

    if (this.width < this.options.display.maxWidth) {
      const { width, height } = this.canvasManager.resize(1.003 * this.match);
      this.width = width;
      this.height = height;
    }

    this.timeLeft = 9000 + this.match * 1000 * 0.1;

    this.enemies = [];
    for (let i = 0; i < this.enemiesQty; i++) {
      [Rock, Paper, Scissors, Lizard, Spock].forEach(enemy => {
        this.enemies.push(new enemy({ game: this, x: null, y: null }));
      });
    }
  }

  #captureEnemy(killed) {
    if (killed.killedBy && killed.killedBy !== Enemy) {
      this.enemies.push(
        new killed.killedBy({
          x: killed.x,
          y: killed.y,
          game: this,
          angle: killed.angle
        })
      );
    }
  }

  update(deltaTime) {
    this.options.update();
    const alive = this.enemies.filter(enemy => !enemy.dead).map(enemy => enemy.team);
    const unique = [...new Set(alive)];

    if (unique.length <= 3) {
      this.options.setMechanic("timeless", false);
    }

    if (!this.options.mechanics.timeless) {
      this.timeLeft -= deltaTime;
    }

    if (unique.length === 1) {
      this.scoreManager.addWin(unique[0]);
      this.lastWin = unique[0];
      this.#restart();
    }

    if (this.timeLeft <= 0) {
      if (unique.length === 2) {
        const team1 = this.enemies.filter(enemy => enemy.team === unique[0]);
        const team2 = this.enemies.filter(enemy => enemy.team === unique[1]);
        if (team1[0].aim.includes(team2[0].constructor)) {
          this.scoreManager.addWin(unique[1]);
          this.lastWin = unique[1];
        }
        if (team2[0].aim.includes(team1[0].constructor)) {
          this.scoreManager.addWin(unique[0]);
          this.lastWin = unique[0];
        }
      } else {
        this.lastWin = "DRAW";
      }

      this.#restart();
    }

    const dead = this.enemies.filter(enemy => enemy.dead);
    for (const killed of dead) {
      this.options.mechanics.capture && this.#captureEnemy(killed);
      this.particles.collision(killed.x, killed.y);
    }
    this.enemies = this.enemies.filter(enemy => !enemy.dead);
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, this.enemies);
    }
    this.particles.update(deltaTime);
  }

  draw() {
    this.particles.draw();
    this.debugDrawer.draw();
    for (const enemy of this.enemies) {
      enemy.draw();
    }
    this.scorePanel.update(
      this.scoreManager,
      this.match,
      this.timeLeft,
      this.options.mechanics,
      this.lastWin
    );
  }

  run() {
    if (this.destroyed) return;
    this.canvasManager.clear(this.options.display.persist);
    const deltaTime = this.clock.update();
    this.update(deltaTime);
    this.draw();
  }
}

// ====================
// INICIALIZACIÓN
// ====================

document.addEventListener("DOMContentLoaded", () => {
  const panelToggle = document.querySelector(".panel-toggle");
  const controlsPanel = document.getElementById("controls-panel");
  panelToggle?.addEventListener("click", () => {
    controlsPanel.classList.toggle("collapsed");
  });

  const startBtn = document.getElementById("start-btn");
  const startLevelInput = document.getElementById("start-level");

  let game = null;
  let rafId = null;

  const start = () => {
    let startLevel = +startLevelInput.value;
    if (startLevel < 0 || startLevel > 2000 || isNaN(startLevel)) {
      startLevel = 0;
    }

    if (game) game.destroy();
    cancelAnimationFrame(rafId);

    const instance = new Game({ startLevel });
    game = instance;

    const animate = () => {
      if (instance.destroyed) return;
      instance.run();
      rafId = instance.rafId = requestAnimationFrame(animate);
    };

    animate();
  };

  startBtn.addEventListener("click", start);
});
