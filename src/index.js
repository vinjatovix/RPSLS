import { CollisionDetector, SpatialGrid } from "./canvas/index.js";
import { GAME_CONFIG, GAME_MODES, LEAGUE_LENGTHS, POWERUP_TYPES, RACE_STATS, UPGRADES } from "./config/gameConfig.js";
import { Clock, EventBus } from "./core/index.js";
import { EntityManager, MatchManager } from "./entities/index.js";
import { ProgressManager } from "./meta/ProgressManager.js";
import { GameSettings } from "./options/GameSettings.js";
import { ScoreManager } from "./scoring/ScoreManager.js";
import { DebugDrawer } from "./ui/index.js";

class Game {
  constructor({
    startLevel = 0,
    mode = "infinite-death",
    leagueLength = 50,
    team = null,
    config = GAME_CONFIG,
    raceStats = RACE_STATS,
    upgrades = UPGRADES,
    powerupTypes = POWERUP_TYPES,
    gameModes = GAME_MODES,
    leagueLengths = LEAGUE_LENGTHS,
    adapters
  } = {}) {
    this.config = config;
    this.raceStats = raceStats;
    this.upgrades = upgrades;
    this.powerupTypes = powerupTypes;
    this.gameModes = gameModes;
    this.leagueLengths = leagueLengths;
    this.predators = {};
    for (const team of Object.keys(this.raceStats)) {
      this.predators[team] = Object.keys(this.raceStats).filter(
        predator => this.raceStats[predator].aim?.includes(team)
      );
    }
    this.modeKey = this.gameModes[mode] ? mode : "infinite-death";
    this.mode = this.gameModes[this.modeKey];
    this.leagueLength = leagueLength;

    if (!adapters || !adapters.inputHandler || !adapters.storageAdapter || !adapters.canvasAdapter) {
      throw new Error("Game requires valid adapters: inputHandler, storageAdapter, and canvasAdapter must be provided.");
    }

    this.inputHandler = adapters.inputHandler;
    this.storageAdapter = adapters.storageAdapter;
    this.options = new GameSettings({
      inputHandler: this.inputHandler,
      storageAdapter: this.storageAdapter,
      gameConfig: this.config
    });

    this.canvasAdapter = adapters.canvasAdapter;

    const resizeLevel = this.mode.kind === "level" ? startLevel : 0;
    const { width, height } = this.canvasAdapter.resize(resizeLevel);
    this.width = width;
    this.height = height;

    this.clock = new Clock();
    this.eventBus = new EventBus();
    this.activeTeams = new Set();

    this.debugDrawer = new DebugDrawer({
      game: this,
      canvasAdapter: this.canvasAdapter,
      clock: this.clock,
      options: this.options
    });

    this.ctx = this.canvasAdapter.getContext();
    this.width = this.canvasAdapter.getWidth();
    this.height = this.canvasAdapter.getHeight();
    this.progressManager = new ProgressManager({
      eventBus: this.eventBus,
      raceStats: this.raceStats,
      upgrades: this.upgrades
    });
    if (team && this.raceStats[team]) {
      this.progressManager.selectTeam(team);
    }

    this.spatialGrid = new SpatialGrid(100, 100, {
      isToroidal: this.options?.mechanics?.isToroidal || false,
      width: this.width,
      height: this.height
    });

    this.entityManager = new EntityManager({
      game: this,
      eventBus: this.eventBus,
      progressManager: this.progressManager
    });

    this.scoreManager = new ScoreManager({
      eventBus: this.eventBus,
      raceStats: this.raceStats
    });
    this.matchManager = new MatchManager({
      game: this,
      eventBus: this.eventBus,
      options: this.options,
      startLevel
    });

    this.eventBus.subscribe("game:match-start", ({ matchNumber }) => {
      const enemyGroupCount = Math.max(1, Math.floor(matchNumber / this.config.meta.enemiesPerLevel));
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

    this.lastWin = null;
    this.destroyed = false;
    this.animationFrameId = null;
    this.onLeagueEnd = null;

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
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.canvasAdapter.getCanvas().removeEventListener("pointerdown", this.boundPointerDown);
  }

  #setupPointerEvents() {
    this.boundPointerDown = event => this.#handlePointerDown(event);
    this.canvasAdapter.getCanvas().addEventListener("pointerdown", this.boundPointerDown);
  }

  #handlePointerDown(event) {
    if (this.matchManager.paused || !this.progressManager.isTeamChosen()) {
      return;
    }

    const coords = this.canvasAdapter.clientToCanvasCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    const team = this.progressManager.selectedTeam;

    for (const powerup of this.powerups) {
      if (powerup.dead || powerup.isExpired()) {
        continue;
      }

      const centerX = powerup.x + powerup.width / 2;
      const centerY = powerup.y + powerup.height / 2;
      const radius = powerup.width * this.progressManager.getCollectRadiusMultiplier();

      if (CollisionDetector.isPointInsideCircle(coords.x, coords.y, centerX, centerY, radius)) {
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

export { Game };
