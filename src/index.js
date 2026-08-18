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
import { MatchManager } from "./entities/MatchManager.js";
import { EntityManager } from "./entities/EntityManager.js";

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
    this.progressManager = new ProgressManager({
      eventBus: this.eventBus
    });
    if (team && RACE_STATS[team]) {
      this.progressManager.selectTeam(team);
    }

    this.entityManager = new EntityManager({
      game: this,
      eventBus: this.eventBus,
      progressManager: this.progressManager
    });

    this.scoreManager = new ScoreManager({ eventBus: this.eventBus });
    this.matchManager = new MatchManager({
      game: this,
      eventBus: this.eventBus,
      options: this.options,
      startLevel
    });

    this.eventBus.subscribe("game:match-start", ({ matchNumber }) => {
      const enemyGroupCount = Math.max(1, Math.floor(matchNumber / GAME_CONFIG.meta.enemiesPerLevel));
      this.entityManager.spawnMatch(enemyGroupCount);
    });

    this.eventBus.subscribe("game:league-ended", () => {
      this.matchManager.paused = true;
      const ranking = this.scoreManager.sortRanking(
        Object.entries(this.scoreManager.teams).map(([name, team]) => ({ name, ...team }))
      );
      this.onLeagueEnd?.({
        ranking,
        playerTeam: this.progressManager.selectedTeam,
        modeKey: this.modeKey,
        leagueLength: this.leagueLength
      });
    });

    this.scorePanel = new ScorePanel({ 
      scoreManager: this.scoreManager, 
      eventBus: this.eventBus 
    });
    this.infoPanel = new InfoPanel({ 
      progressManager: this.progressManager, 
      eventBus: this.eventBus 
    });
    this.lastWin = null;
    this.destroyed = false;
    this.animationFrameId = null;
    this.onLeagueEnd = null;
    this.metaPanel = new MetaPanel({
      progressManager: this.progressManager,
      eventBus: this.eventBus
    });

    if (this.progressManager.isTeamChosen()) {
      if (this.mode.kind === "level") {
        this.matchManager.startMatch();
      } else {
        this.matchManager.nextMatch();
      }
    }

    this.#setupPointerEvents();
  }

  get enemies() {
    return this.entityManager ? this.entityManager.getEnemies() : [];
  }

  set enemies(val) {
    if (this.entityManager) {
      this.entityManager.setEnemies(val);
    }
  }

  get powerups() {
    return this.entityManager ? this.entityManager.getPowerups() : [];
  }

  set powerups(val) {
    if (this.entityManager) {
      this.entityManager.setPowerups(val);
    }
  }

  get particles() {
    return this.entityManager ? this.entityManager.particles : null;
  }

  set particles(val) {
    if (this.entityManager) {
      this.entityManager.particles = val;
    }
  }

  get powerupTimer() {
    return this.entityManager ? this.entityManager.powerupTimer : 0;
  }

  set powerupTimer(val) {
    if (this.entityManager) {
      this.entityManager.powerupTimer = val;
    }
  }

  onTeamChanged() {
    this.matchManager.nextMatch();
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
    if (this.matchManager.paused || !this.progressManager.isTeamChosen()) return;
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



  update(deltaTime) {
    if (this.matchManager.paused || !this.progressManager.isTeamChosen()) return;
    const substeps = this.progressManager.getTimeCompression();
    const step = deltaTime / substeps;
    for (let i = 0; i < substeps; i++) {
      this.entityManager.update(step);
    }
  }

  draw() {
    this.entityManager.draw();
    this.debugDrawer.draw();
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
    EntityManager,
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
      game.matchManager.paused = true;
    } else {
      // Avoid the giant deltaTime of the resumption (rAF stops in the
      // background and Date.now() would accumulate all that time).
      game.clock.reset();
      if (!menu.isOpen()) {
        game.matchManager.paused = false;
      }
    }
  });
});

export { Game };
