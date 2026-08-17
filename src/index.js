import { GAME_CONFIG, GAME_MODES, RACE_STATS, UPGRADES, POWERUP_TYPES, LEAGUE_LENGTHS } from "./config/gameConfig.js";
import { Clock } from "./core/Clock.js";
import { EventBus } from "./core/EventBus.js";
import { deepFreeze } from "./core/deepFreeze.js";
import { CanvasAdapter } from "./canvas/CanvasAdapter.js";
import { CollisionDetector } from "./canvas/geometry/CollisionDetector.js";
import { InputHandler } from "./input/InputHandler.js";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter.js";
import { GameSettings } from "./options/GameSettings.js";
import { ScoreManager } from "./scoring/ScoreManager.js";
import { ProgressManager } from "./meta/ProgressManager.js";
import { Enemy } from "./entities/Enemy.js";
import { RACE_CLASSES } from "./entities/races.js";
import { EnemyFactory } from "./entities/EnemyFactory.js";
import { PowerUp } from "./entities/PowerUp.js";
import { ParticleSystem } from "./particles/ParticleSystem.js";
import { MenuController } from "./ui/MenuController.js";
import { InfoPanel } from "./ui/InfoPanel.js";
import { ScorePanel } from "./ui/ScorePanel.js";
import { DebugDrawer } from "./ui/DebugDrawer.js";
import { MetaPanel } from "./ui/MetaPanel.js";

class Game {
  constructor({ startLevel = 0, mode = "infinite-death", leagueLength = 50, team = null } = {}) {
    this.modeKey = GAME_MODES[mode] ? mode : "infinite-death";
    this.mode = GAME_MODES[this.modeKey];
    this.leagueLength = leagueLength;

    this.inputHandler = new InputHandler();
    this.storageAdapter = new LocalStorageAdapter();
    this.options = new GameSettings({
      inputHandler: this.inputHandler,
      storageAdapter: this.storageAdapter,
      gameConfig: GAME_CONFIG
    });

    this.canvasAdapter = new CanvasAdapter({
      canvasId: "canvas1",
      displayConfig: this.options.display
    });

    const resizeLevel = this.mode.kind === "level" ? startLevel : 0;
    const { width, height } = this.canvasAdapter.resize(resizeLevel);
    this.width = width;
    this.height = height;

    this.clock = new Clock();
    this.eventBus = new EventBus();

    this.debugDrawer = new DebugDrawer({
      canvasAdapter: this.canvasAdapter,
      clock: this.clock,
      options: this.options
    });

    this.ctx = this.canvasAdapter.getContext();
    this.width = this.canvasAdapter.getWidth();
    this.height = this.canvasAdapter.getHeight();
    this.timeLeft = GAME_CONFIG.meta.initialTimeLeftMs;
    this.match = this.mode.kind === "level" ? startLevel : 0;
    this.enemyGroupCount = Math.max(1, Math.floor(this.match / GAME_CONFIG.meta.enemiesPerLevel));
    this.progressManager = new ProgressManager({
      eventBus: this.eventBus
    });
    if (team && RACE_STATS[team]) {
      this.progressManager.selectTeam(team);
    }

    this.scoreManager = new ScoreManager({ eventBus: this.eventBus });
    this.scorePanel = new ScorePanel({ 
      scoreManager: this.scoreManager, 
      eventBus: this.eventBus 
    });
    this.infoPanel = new InfoPanel({ 
      progressManager: this.progressManager, 
      eventBus: this.eventBus 
    });
    this.enemies = [];
    this.lastWin = null;
    this.particles = new ParticleSystem({ game: this });
    this.destroyed = false;
    this.animationFrameId = null;
    this.onLeagueEnd = null;
    this.metaPanel = new MetaPanel({
      progressManager: this.progressManager,
      eventBus: this.eventBus
    });

    this.gameTime = 0;
    this.lastMechanicTimeless = null;
    this.powerups = [];
    this.powerupTimer = GAME_CONFIG.meta.powerupSpawnIntervalMs / this.progressManager.getPowerupLuck();
    this.timeSinceLastAction = 0;
    this.lastTickSecond = -1;
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

  onTeamChanged() {
    this.#restart();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrameId);
    this.inputHandler.destroy();
    this.canvasAdapter.getCanvas().removeEventListener("pointerdown", this.boundPointerDown);
    
    if (this.scorePanel && typeof this.scorePanel.destroy === 'function') {
      this.scorePanel.destroy();
    }
    if (this.infoPanel && typeof this.infoPanel.destroy === 'function') {
      this.infoPanel.destroy();
    }
    if (this.metaPanel && typeof this.metaPanel.destroy === 'function') {
      this.metaPanel.destroy();
    }
  }

  #setupPointerEvents() {
    this.boundPointerDown = event => this.#handlePointerDown(event);
    this.canvasAdapter.getCanvas().addEventListener("pointerdown", this.boundPointerDown);
  }

  #handlePointerDown(event) {
    if (this.paused || !this.progressManager.isTeamChosen()) return;
    const canvas = this.canvasAdapter.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pointerX = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const pointerY = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const team = this.progressManager.selectedTeam;

    for (const powerup of this.powerups) {
      if (powerup.dead || powerup.isExpired()) continue;
      const centerX = powerup.x + powerup.width / 2;
      const centerY = powerup.y + powerup.height / 2;
      const deltaX = pointerX - centerX;
      const deltaY = pointerY - centerY;
      const radius = powerup.width * this.progressManager.getCollectRadiusMultiplier();
      if (deltaX * deltaX + deltaY * deltaY <= radius * radius) {
        powerup.applyForClick(team);
        break;
      }
    }
  }

  #spawnMatch() {
    this.options.setMechanic("timeless", true);
    this.options.setMechanic("capture", this.mode.capture);
    this.enemyGroupCount = Math.max(1, Math.floor(this.match / GAME_CONFIG.meta.enemiesPerLevel));

    this.timeLeft = Math.min(
      GAME_CONFIG.mechanics.matchTimeMaxMs,
      GAME_CONFIG.mechanics.matchTimeBaseMs + this.match * GAME_CONFIG.mechanics.matchTimeGrowthMs
    );

    this.timeSinceLastAction = 0;
    this.eventBus?.emit("game:match-start", { 
      matchNumber: this.match, 
      mode: this.mode, 
      leagueLength: this.leagueLength,
      timeLeft: this.timeLeft,
      timeless: this.options.mechanics.timeless
    });
    this.enemies = EnemyFactory.spawnMatch(
      this,
      this.progressManager.selectedTeam,
      this.progressManager,
      this.enemyGroupCount
    );
    this.powerups = [];
  }

  #restart() {
    this.eventBus?.emit("game:match-end", { 
      match: this.match,
      winners: this.lastWin,
      modeKey: this.modeKey,
      leagueLength: this.leagueLength
    });
    this.match++;

    if (this.mode.isLeague && this.match > this.leagueLength) {
      this.#endLeague();
      return;
    }

    if (this.width < this.options.display.maxWidth) {
      const { width, height } = this.canvasAdapter.resize(1.003 * this.match);
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
    const captured = EnemyFactory.captureEnemy(killed, this, this.progressManager);
    if (captured) {
      this.enemies.push(captured);
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

    this.timeSinceLastAction += deltaTime;
    const isStalled = this.timeSinceLastAction > GAME_CONFIG.meta.stallTimeoutMs && unique.length > 2;
    const shouldBeTimeless = unique.length > 3 && !isStalled;

    if (this.options.mechanics.timeless !== shouldBeTimeless) {
      this.options.setMechanic("timeless", shouldBeTimeless);
    }

    if (isStalled) {
      this.timeLeft = Math.min(this.timeLeft, GAME_CONFIG.meta.stallCountdownMs);
    }

    if (!this.options.mechanics.timeless) {
      this.timeLeft -= deltaTime;
    }

    if (!this.options.mechanics.timeless) {
      const currentSecond = Math.floor(this.timeLeft / 1000);
      if (currentSecond !== this.lastTickSecond) {
        this.lastTickSecond = currentSecond;
        this.eventBus?.emit("tick", { timeLeft: this.timeLeft });
      }
    }

    if (this.options.mechanics.timeless !== this.lastMechanicTimeless) {
      this.lastMechanicTimeless = this.options.mechanics.timeless;
      this.eventBus?.emit("game:mechanics-change", { timeless: this.options.mechanics.timeless });
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
    if (
      this.powerupTimer <= 0 &&
      this.powerups.length < GAME_CONFIG.meta.powerupMaxConcurrent + this.progressManager.getPowerupLimitBonus()
    ) {
      this.powerups.push(new PowerUp({ game: this }));
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

  draw() {
    this.particles.draw();
    for (const powerup of this.powerups) {
      powerup.draw();
    }
    this.debugDrawer.draw();
    for (const enemy of this.enemies) {
      enemy.draw();
    }
  }

  run() {
    if (this.destroyed) return;
    this.canvasAdapter.clear(this.options.display.persist);
    const deltaTime = this.clock.update();
    this.update(deltaTime);
    this.draw();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.__NO_AUTOSTART__) return;

  // Anti-hack barrier: deep-freezes the config and the prototypes of the
  // game classes. ONLY here (browser bootstrap); never at module level,
  // because the balance harness in Node mutates RACE_STATS/GAME_CONFIG
  // to calibrate.
  deepFreeze(RACE_STATS);
  deepFreeze(GAME_CONFIG);
  deepFreeze(GAME_MODES);
  deepFreeze(UPGRADES);
  deepFreeze(POWERUP_TYPES);
  deepFreeze(LEAGUE_LENGTHS);
  for (const classes of [
    Game,
    ScorePanel,
    InfoPanel,
    DebugDrawer,
    MetaPanel,
    ParticleSystem,
    MenuController,
    PowerUp,
    Enemy,
    ...Object.values(RACE_CLASSES)
  ]) {
    if (classes && classes.prototype) deepFreeze(classes.prototype);
  }

  let game = null;
  let animationFrameId = null;

  const start = (config = {}) => {
    const { mode = "infinite-death", leagueLength = 50, startLevel = 0, team = null } = config;
    let level = +startLevel;
    if (level < 0 || level > 2000 || isNaN(level)) {
      level = 0;
    }

    if (game) game.destroy();
    cancelAnimationFrame(animationFrameId);

    const instance = new Game({ startLevel: level, mode, leagueLength, team });
    game = instance;

    instance.onLeagueEnd = payload => menu.showLeagueResult(payload);

    const animate = () => {
      if (instance.destroyed) return;
      instance.run();
      animationFrameId = instance.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  };

  const menu = new MenuController({
    getGame: () => game,
    onStart: start
  });

  start();

  if (!game.progressManager.isTeamChosen()) {
    menu.showPause(false);
  }

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
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
      // Avoid the giant deltaTime of the resumption (rAF stops in the
      // background and Date.now() would accumulate all that time).
      game.clock.reset();
      if (!menu.isOpen()) {
        game.paused = false;
      }
    }
  });
});

export { Game };
