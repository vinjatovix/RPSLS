import { CollisionDetector, SpatialGrid } from "./canvas/index.js";
import { GAME_CONFIG, GAME_MODES, LEAGUE_LENGTHS, POWERUP_TYPES, RACE_STATS, UPGRADES } from "./config/gameConfig.js";
import { Clock, EventBus } from "./core/index.js";
import { EntityManager, MatchManager } from "./entities/index.js";
import { ProgressManager } from "./meta/ProgressManager.js";
import { GameSettings } from "./options/GameSettings.js";
import { ScoreManager } from "./scoring/ScoreManager.js";
import { DebugDrawer } from "./ui/index.js";

class Game {
  #started = false;

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
      upgrades: this.upgrades,
      storageAdapter: this.storageAdapter
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

    this.leagueSeed = (Date.now() ^ 0x99999999) | 0;

    if (team === null && startLevel === 0) {
      this.loadGameState();
    } else {
      this.clearGameState();
    }

    this.eventBus.subscribe("game:match-start", ({ matchNumber }) => {
      const enemyGroupCount = Math.max(1, Math.floor(matchNumber / this.config.meta.enemiesPerLevel));
      this.entityManager.spawnMatch(enemyGroupCount);
    });

    this.eventBus.subscribe("game:league-ended", () => {
      this.matchManager.paused = true;
      this.clearGameState();
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

    this.#setupPointerEvents();
  }

  start() {
    if (this.#started) {
      return;
    }

    if (this.progressManager.isTeamChosen()) {
      this.#started = true;
      if (this.mode.kind === "level" || this.matchManager.match > 0) {
        this.matchManager.startMatch();
      } else {
        this.matchManager.nextMatch();
      }
    }
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

  saveGameState() {
    const data = {
      match: this.matchManager.match,
      teams: this.scoreManager.teams,
      leagueSeed: this.leagueSeed,
      leagueLength: this.leagueLength,
      modeKey: this.modeKey
    };

    this.storageAdapter.save(data, "active-game-state");
    this.progressManager.saveProgress();
  }

  loadGameState() {
    try {
      const data = this.storageAdapter.load("active-game-state");

      if (!data) {
        return;
      }

      const isLoadedModeKeyValid = typeof data.modeKey === "string" && this.gameModes[data.modeKey];
      this.modeKey = isLoadedModeKeyValid ? data.modeKey : "infinite-death";
      this.mode = this.gameModes[this.modeKey];

      const isLoadedLeagueLengthValid = typeof data.leagueLength === "number" && Number.isInteger(data.leagueLength) && data.leagueLength > 0;
      this.leagueLength = isLoadedLeagueLengthValid ? data.leagueLength : 50;

      const isLoadedMatchValid = typeof data.match === "number" && Number.isInteger(data.match) && data.match >= 0;
      this.matchManager.match = isLoadedMatchValid ? data.match : 0;

      const isLoadedLeagueSeedValid = typeof data.leagueSeed === "number" && Number.isInteger(data.leagueSeed);
      this.leagueSeed = isLoadedLeagueSeedValid ? data.leagueSeed : (Date.now() ^ 0x99999999) | 0;

      const isLoadedTeamsObjectValid = data.teams && typeof data.teams === "object" && !Array.isArray(data.teams);
      if (isLoadedTeamsObjectValid) {
        for (const team of Object.keys(this.raceStats)) {
          const loadedTeam = data.teams[team];
          const isLoadedTeamValid = loadedTeam && typeof loadedTeam === "object" && !Array.isArray(loadedTeam);

          if (isLoadedTeamValid) {
            const kills = typeof loadedTeam.kills === "number" && Number.isInteger(loadedTeam.kills) && loadedTeam.kills >= 0 ? loadedTeam.kills : 0;
            const deaths = typeof loadedTeam.deaths === "number" && Number.isInteger(loadedTeam.deaths) && loadedTeam.deaths >= 0 ? loadedTeam.deaths : 0;
            const score = typeof loadedTeam.score === "number" && Number.isInteger(loadedTeam.score) && loadedTeam.score >= 0 ? loadedTeam.score : 0;
            const ratio = typeof loadedTeam.ratio === "number" && Number.isFinite(loadedTeam.ratio) && loadedTeam.ratio >= 0 ? loadedTeam.ratio : (deaths > 0 ? kills / deaths : kills);
            const emoji = typeof loadedTeam.emoji === "string" ? loadedTeam.emoji : (this.raceStats[team].emoji || "");
            const name = typeof loadedTeam.name === "string" ? loadedTeam.name : (this.raceStats[team].team || team);

            this.scoreManager.teams[team] = { emoji, name, kills, deaths, score, ratio };
          } else {
            this.scoreManager.teams[team] = {
              emoji: this.raceStats[team].emoji || "",
              name: this.raceStats[team].team || team,
              kills: 0,
              deaths: 0,
              score: 0,
              ratio: 0
            };
          }
        }
      } else {
        throw new TypeError("Invalid or missing teams object in loaded state");
      }

      if (this.width < this.options.display.maxWidth) {
        const resizeLevel = this.mode?.kind === "level" ? this.matchManager.match : 1.003 * this.matchManager.match;
        const { width, height } = this.canvasAdapter.resize(resizeLevel);
        this.width = width;
        this.height = height;
      }
    } catch (error) {
      console.warn("The active game state data is corrupt or has been modified without authorization.", error);
      this.clearGameState();

      this.modeKey = "infinite-death";
      this.mode = this.gameModes[this.modeKey];
      this.leagueLength = 50;
      this.matchManager.match = 0;
      this.leagueSeed = (Date.now() ^ 0x99999999) | 0;

      for (const team of Object.keys(this.raceStats)) {
        this.scoreManager.teams[team] = {
          emoji: this.raceStats[team].emoji || "",
          name: this.raceStats[team].team || team,
          kills: 0,
          deaths: 0,
          score: 0,
          ratio: 0
        };
      }
    }
  }

  clearGameState() {
    this.storageAdapter.clear("active-game-state");
  }
}

export { Game };
