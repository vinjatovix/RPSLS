/**
 * Punto de entrada de la aplicación
 * Integra todos los módulos refactorizados
 * Mantiene la lógica original sin cambios de comportamiento
 * Añade capa idle: razas diferenciadas, powerups, créditos y entrenamiento
 */

import { GAME_CONFIG, GAME_MODES, RACE_STATS, UPGRADES } from "./config/gameConfig.js";
import { Clock } from "./core/Clock.js";
import { EventBus } from "./core/EventBus.js";
import { CanvasManager } from "./canvas/CanvasManager.js";
import { CollisionDetector } from "./canvas/geometry/CollisionDetector.js";
import { InputHandler } from "./input/InputHandler.js";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter.js";
import { OptionsManager } from "./options/OptionsManager.js";
import { ScoreManager } from "./scoring/ScoreManager.js";
import { ProgressManager } from "./meta/ProgressManager.js";
import { ALL_RACES, RACE_CLASSES } from "./entities/races.js";
import { PowerUp } from "./entities/PowerUp.js";
import { PowerUpBurst } from "./particles/PowerUpEffects.js";
import { FloatingText } from "./particles/FloatingText.js";
import { MenuManager } from "./ui/MenuManager.js";

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

  update(scoreManager, match, timeLeft, mechanics, lastWin, credits, started = true, mode = null, leagueLength = null) {
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

    this.roundInfoEl.innerHTML = !started
      ? `<p class="timer-active"><strong>👆 Elige tu equipo para empezar</strong></p>`
      : `
      <p><strong>Match:</strong> ${match}${mode?.isLeague && leagueLength ? `/${leagueLength}` : ""}</p>
      ${lastWin ? `<p><strong>Last:</strong> ${lastWin}</p>` : ""}
      <p><strong>Credits:</strong> ${credits} 💰</p>
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
    this.ctx.fillText(`Blood: ${this.options.effects.blood}`, this.position, 6 * this.fontSize);
    this.ctx.fillText(`Snuff: ${this.options.effects.snuff}`, this.position, 7 * this.fontSize);
    this.ctx.restore();
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

  powerUpBurst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.addParticle(new PowerUpBurst({ ctx: this.ctx, x, y, color }));
    }
  }

  floatText(x, y, text, color) {
    this.addParticle(new FloatingText({ ctx: this.ctx, x, y, text, color }));
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

// ====================
// META-PROGRESIÓN (UI)
// ====================

class MetaPanel {
  constructor({ progressManager, game }) {
    this.progressManager = progressManager;
    this.game = game;
    this.shopListEl = document.getElementById("shop-list");
    this.creditsEl = document.getElementById("credits");

    this.progressManager.eventBus.subscribe("credits-updated", () => this.render());
    this.render();
  }

  render() {
    const selected = this.progressManager.selectedTeam;
    this.creditsEl.textContent = this.progressManager.credits;
    this.#renderShop(selected);
  }

  #renderShop(selected) {
    this.shopListEl.innerHTML = "";

    const perRace = Object.entries(UPGRADES).filter(([, config]) => config.perRace);
    const globalUpgrades = Object.entries(UPGRADES).filter(([, config]) => !config.perRace);

    const raceHeader = document.createElement("div");
    raceHeader.className = "shop-section-title";
    raceHeader.textContent = `${RACE_STATS[selected].emoji} ${selected}`;
    this.shopListEl.appendChild(raceHeader);

    perRace.forEach(([key, config]) => {
      this.#renderItem(this.shopListEl, key, config, selected);
    });

    const globalHeader = document.createElement("div");
    globalHeader.className = "shop-section-title";
    globalHeader.textContent = "Global";
    this.shopListEl.appendChild(globalHeader);

    globalUpgrades.forEach(([key, config]) => {
      this.#renderItem(this.shopListEl, key, config, null);
    });
  }

  #renderItem(container, key, config, team) {
    const level = this.progressManager.getUpgradeLevel(key, team);
    const cost = this.progressManager.getUpgradeCost(key, team);
    const canAfford = this.progressManager.credits >= cost;

    const item = document.createElement("div");
    item.className = "shop-item";
    item.innerHTML = `
      <span class="shop-emoji">${config.emoji}</span>
      <div class="shop-info">
        <span class="shop-name">${config.label}</span>
        <span class="shop-desc">${config.description} · Lv.${level}</span>
      </div>
      <button type="button" class="shop-btn" ${canAfford ? "" : "disabled"}>${cost} 💰</button>
    `;
    item.querySelector(".shop-btn").addEventListener("click", () => {
      this.progressManager.buyUpgrade(key, team);
      this.render();
    });
    container.appendChild(item);
  }
}

class Game {
  constructor({ startLevel = 0, mode = "infinito-muerte", leagueLength = 50, team = null } = {}) {
    this.modeKey = GAME_MODES[mode] ? mode : "infinito-muerte";
    this.mode = GAME_MODES[this.modeKey];
    this.leagueLength = leagueLength;

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

    const resizeLevel = this.mode.kind === "level" ? startLevel : 0;
    const { width, height } = this.canvasManager.resize(resizeLevel);
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
    this.match = this.mode.kind === "level" ? startLevel : 0;
    this.enemiesQty = Math.floor(this.match / 10) || 1;
    this.scoreManager = new ScoreManager({ eventBus: this.eventBus });
    this.scorePanel = new ScorePanel();
    this.enemies = [];
    this.lastWin = null;
    this.particles = new ParticleManager({ game: this });
    this.destroyed = false;
    this.rafId = null;
    this.onLeagueEnd = null;

    // Capa idle
    this.progressManager = new ProgressManager({
      storageAdapter: this.storageAdapter,
      eventBus: this.eventBus
    });
    if (team && RACE_STATS[team]) {
      this.progressManager.selectTeam(team);
    }
    this.metaPanel = new MetaPanel({
      progressManager: this.progressManager,
      game: this
    });

    this.gameTime = 0;
    this.powerups = [];
    this.powerupTimer = 6000 / this.progressManager.getPowerupLuck();
    this.timeSinceLastAction = 0;
    this.paused = false;
    this.eventBus.subscribe("kill", () => {
      this.timeSinceLastAction = 0;
    });

    if (this.progressManager.isTeamChosen()) {
      if (this.mode.kind === "level") {
        this.#spawnMatch();
      } else {
        this.#restart();
      }
    }

    this.#setupPointerEvents();
  }

  /**
   * Al cambiar de equipo se reinicia el match para aplicar las mejoras
   */
  onTeamChanged() {
    this.#restart();
  }

  /**
   * Detener el juego y liberar todos sus recursos
   */
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.inputHandler.destroy();
    this.canvasManager.getCanvas().removeEventListener("pointerdown", this.boundPointerDown);
  }

  /**
   * Escuchar clicks sobre el canvas para recoger powerups con el equipo del jugador
   */
  #setupPointerEvents() {
    this.boundPointerDown = e => this.#handlePointerDown(e);
    this.canvasManager.getCanvas().addEventListener("pointerdown", this.boundPointerDown);
  }

  #handlePointerDown(e) {
    if (this.paused || !this.progressManager.isTeamChosen()) return;
    const canvas = this.canvasManager.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const px = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const py = ((e.clientY - rect.top) * canvas.height) / rect.height;
    const team = this.progressManager.selectedTeam;

    for (const powerup of this.powerups) {
      if (powerup.dead || powerup.isExpired()) continue;
      const cx = powerup.x + powerup.width / 2;
      const cy = powerup.y + powerup.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      const radius = powerup.width;
      if (dx * dx + dy * dy <= radius * radius) {
        powerup.applyForClick(team);
        break;
      }
    }
  }

  #spawnMatch() {
    this.options.setMechanic("timeless", true);
    this.options.setMechanic("capture", this.mode.capture);
    this.enemiesQty = Math.floor(this.match / 10) || 1;

    this.timeLeft = Math.min(
      GAME_CONFIG.mechanics.matchTimeMaxMs,
      GAME_CONFIG.mechanics.matchTimeBaseMs + this.match * GAME_CONFIG.mechanics.matchTimeGrowthMs
    );

    this.timeSinceLastAction = 0;
    this.enemies = [];
    const selectedTeam = this.progressManager.selectedTeam;
    for (let i = 0; i < this.enemiesQty; i++) {
      ALL_RACES.forEach(enemyClass => {
        const modifiers =
          enemyClass.teamName === selectedTeam
            ? this.progressManager.getRaceModifiers(selectedTeam)
            : null;
        this.enemies.push(new enemyClass({ game: this, x: null, y: null, modifiers }));
      });
    }
    this.powerups = [];
  }

  #restart() {
    this.match++;

    if (this.mode.isLeague && this.match > this.leagueLength) {
      this.#endLeague();
      return;
    }

    if (this.width < this.options.display.maxWidth) {
      const { width, height } = this.canvasManager.resize(1.003 * this.match);
      this.width = width;
      this.height = height;
    }

    this.#spawnMatch();
  }

  #endLeague() {
    this.paused = true;
    const ranking = this.scoreManager.sortRanking(
      Object.entries(this.scoreManager.teams).map(([name, team]) => ({ name, ...team }))
    );
    this.onLeagueEnd?.({
      ranking,
      playerTeam: this.progressManager.selectedTeam,
      modeKey: this.modeKey,
      leagueLength: this.leagueLength
    });
  }

  #captureEnemy(killed) {
    if (killed.killedBy && RACE_CLASSES[killed.killedBy]) {
      const enemyClass = RACE_CLASSES[killed.killedBy];
      const modifiers =
        enemyClass.teamName === this.progressManager.selectedTeam
          ? this.progressManager.getRaceModifiers(this.progressManager.selectedTeam)
          : null;
      this.enemies.push(
        new enemyClass({
          x: killed.x,
          y: killed.y,
          game: this,
          angle: killed.angle,
          modifiers
        })
      );
    }
  }

  update(deltaTime) {
    if (this.paused || !this.progressManager.isTeamChosen()) return;
    const substeps = this.progressManager.getTimeCompression();
    const step = deltaTime / substeps;
    for (let i = 0; i < substeps; i++) {
      this.#updateStep(step);
    }
  }

  #updateStep(deltaTime) {
    this.gameTime += deltaTime;
    this.options.update();
    const alive = this.enemies.filter(enemy => !enemy.dead).map(enemy => enemy.team);
    const unique = [...new Set(alive)];

    if (unique.length <= 3) {
      this.options.setMechanic("timeless", false);
    }

    if (!this.options.mechanics.timeless) {
      this.timeLeft -= deltaTime;
    }

    // Anti-estancamiento: si no hay kills y quedan 3+ equipos,
    // fuerza una cuenta atrás corta para que el match siempre fluya
    this.timeSinceLastAction += deltaTime;
    if (this.timeSinceLastAction > 30000 && unique.length > 2) {
      this.options.setMechanic("timeless", false);
      this.timeLeft = Math.min(this.timeLeft, 10000);
    }

    if (unique.length === 1) {
      this.scoreManager.addWin(unique[0], { match: this.match });
      this.lastWin = unique[0];
      this.#restart();
    }

    if (this.timeLeft <= 0) {
      if (unique.length === 2) {
        const team1 = this.enemies.filter(enemy => enemy.team === unique[0]);
        const team2 = this.enemies.filter(enemy => enemy.team === unique[1]);
        if (team1[0].aim.includes(team2[0].team)) {
          this.scoreManager.addWin(unique[1], { match: this.match });
          this.lastWin = unique[1];
        }
        if (team2[0].aim.includes(team1[0].team)) {
          this.scoreManager.addWin(unique[0], { match: this.match });
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
    this.#updatePowerups(deltaTime);
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, this.enemies);
    }
    this.particles.update(deltaTime);
  }

  #updatePowerups(deltaTime) {
    this.powerupTimer -= deltaTime;
    if (this.powerupTimer <= 0 && this.powerups.length < 8) {
      this.powerups.push(new PowerUp({ game: this }));
      this.powerupTimer = 6000 / this.progressManager.getPowerupLuck();
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

  draw() {
    this.particles.draw();
    for (const powerup of this.powerups) {
      powerup.draw();
    }
    this.debugDrawer.draw();
    for (const enemy of this.enemies) {
      enemy.draw();
    }
    this.scorePanel.update(
      this.scoreManager,
      this.match,
      this.timeLeft,
      this.options.mechanics,
      this.lastWin,
      this.progressManager.credits,
      this.progressManager.isTeamChosen(),
      this.mode,
      this.leagueLength
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
  if (window.__NO_AUTOSTART__) return;

  let game = null;
  let rafId = null;

  const start = (config = {}) => {
    const { mode = "infinito-muerte", leagueLength = 50, startLevel = 0, team = null } = config;
    let level = +startLevel;
    if (level < 0 || level > 2000 || isNaN(level)) {
      level = 0;
    }

    if (game) game.destroy();
    cancelAnimationFrame(rafId);

    const instance = new Game({ startLevel: level, mode, leagueLength, team });
    game = instance;

    instance.onLeagueEnd = payload => menu.showLeagueResult(payload);

    const animate = () => {
      if (instance.destroyed) return;
      instance.run();
      rafId = instance.rafId = requestAnimationFrame(animate);
    };

    animate();
  };

  const menu = new MenuManager({
    getGame: () => game,
    onStart: start
  });

  start();

  if (!game.progressManager.isTeamChosen()) {
    menu.showPause(false);
  }

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (menu.isOpen()) {
        menu.close();
      } else {
        menu.showPause(!!game?.progressManager?.isTeamChosen());
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!game) return;
    if (document.hidden) {
      game.paused = true;
    } else {
      // Evita el deltaTime gigante de la reanudación (rAF se detiene
      // en segundo plano y Date.now() acumularía todo ese tiempo).
      game.clock.reset();
      if (!menu.isOpen()) {
        game.paused = false;
      }
    }
  });
});

export { Game };
