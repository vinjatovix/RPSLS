function isNonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export class ProgressManager {
  #credits = 0;
  #selectedTeam = "rocks";
  #teamChosen = false;
  #upgrades = {};
  #raceUpgrades = {};
  #isMatchActive = false;

  constructor({ eventBus, raceStats, upgrades, storageAdapter, logger = console }) {
    if (!raceStats) {
      throw new TypeError("raceStats is required");
    }
    if (!upgrades) {
      throw new TypeError("upgrades is required");
    }
    if (!storageAdapter) {
      throw new TypeError("storageAdapter is required");
    }
    this.eventBus = eventBus;
    this.raceStats = raceStats;
    this.upgrades = upgrades;
    this.storageAdapter = storageAdapter;
    this.logger = logger;
    this.perRaceUpgrades = Object.keys(upgrades).filter(key => upgrades[key].perRace);

    this.#upgrades = this.#defaultUpgrades();
    this.#raceUpgrades = this.#defaultRaceUpgrades();

    this.#subscribe();
    this.loadProgress();
  }

  #defaultUpgrades() {
    const defaults = {};
    Object.keys(this.upgrades).forEach(key => {
      if (!this.upgrades[key].perRace) {
        defaults[key] = 0;
      }
    });

    return defaults;
  }

  #defaultRaceUpgrades() {
    const raceUpgrades = {};
    Object.keys(this.raceStats).forEach(team => {
      raceUpgrades[team] = {};
      this.perRaceUpgrades.forEach(key => {
        raceUpgrades[team][key] = 0;
      });
    });

    return raceUpgrades;
  }

  #subscribe() {
    this.eventBus.subscribe("kill", ({ killerTeam }) => {
      if (killerTeam === this.selectedTeam) {
        this.awardCredits(2);
      }
    });

    this.eventBus.subscribe("match-win", ({ team, match, mvp }) => {
      if (team === this.selectedTeam) {
        this.awardCredits(10 + match + (mvp ? 5 : 0));
      }
    });

    this.eventBus.subscribe("game:match-start", () => {
      this.#isMatchActive = true;
    });

    this.eventBus.subscribe("game:match-end", () => {
      this.#isMatchActive = false;
    });
  }

  get credits() {
    return this.#credits;
  }

  get selectedTeam() {
    return this.#selectedTeam;
  }

  get teamChosen() {
    return this.#teamChosen;
  }

  awardCredits(base) {
    if (!isNonNegativeFinite(base)) return;
    this.#credits += Math.round(base * this.getCreditMultiplier());
    this.eventBus.emit("progress:update", { credits: this.#credits });
    if (!this.#isMatchActive) {
      this.saveProgress();
    }
  }

  spendCredits(amount, emitEvent = true) {
    if (!isNonNegativeFinite(amount)) return false;
    if (this.#credits < amount) return false;
    this.#credits -= amount;
    if (emitEvent) {
      this.eventBus.emit("progress:update", { credits: this.#credits });
    }
    if (!this.#isMatchActive && emitEvent) {
      this.saveProgress();
    }

    return true;
  }

  isTeamChosen() {
    return this.#teamChosen;
  }

  selectTeam(team) {
    if (!Object.keys(this.raceStats).includes(team)) return false;
    this.#selectedTeam = team;
    this.#teamChosen = true;
    this.saveProgress();

    return true;
  }

  getUpgradeCost(key, team = null) {
    const config = this.upgrades[key];
    if (!config) return 0;
    const level = this.getUpgradeLevel(key, team);

    return Math.floor(config.baseCost * Math.pow(config.costGrowth, level));
  }

  getUpgradeLevel(key, team = null) {
    if (!this.upgrades[key]) {
      return 0;
    }

    if (this.upgrades[key].perRace) {
      const t = team || this.selectedTeam;

      return this.#raceUpgrades[t]?.[key] ?? 0;
    }

    return this.#upgrades[key] ?? 0;
  }

  buyUpgrade(key, team = null) {
    const config = this.upgrades[key];
    if (!config) return false;
    const cost = this.getUpgradeCost(key, team);
    if (!this.spendCredits(cost, false)) return false;

    if (config.perRace) {
      const t = team || this.selectedTeam;
      this.#raceUpgrades[t][key] += 1;
    } else {
      this.#upgrades[key] += 1;
    }
    this.eventBus.emit("progress:update", { credits: this.#credits });
    if (!this.#isMatchActive) {
      this.saveProgress();
    }
    
    return true;
  }

  getRaceModifiers(team) {
    const levels = this.#raceUpgrades[team] ?? {};

    return {
      health: 1 + 0.1 * (levels.health ?? 0),
      damage: 1 + 0.1 * (levels.damage ?? 0),
      speed: 1 + 0.08 * (levels.speed ?? 0),
      acceleration: 1 + 0.1 * (levels.acceleration ?? 0),
      turn: 1 + 0.1 * (levels.turn ?? 0),
      deceleration: 1 + 0.1 * (levels.deceleration ?? 0),
      regeneration: 4 * (levels.regeneration ?? 0),
      armor: 0.08 * (levels.armor ?? 0),
      vampire: 0.05 * (levels.vampire ?? 0)
    };
  }

  /**
   * Time compression: ×2 per level
   */
  getTimeCompression() {
    return Math.pow(2, this.#upgrades.timeCompression ?? 0);
  }

  /**
   * Credit multiplier: +10% per level
   */
  getCreditMultiplier() {
    return 1 + 0.1 * (this.#upgrades.creditRate ?? 0);
  }

  /**
   * Power-up luck: +5% spawn frequency per level
   */
  getPowerupLuck() {
    return 1 + 0.05 * (this.#upgrades.powerupLuck ?? 0);
  }

  /**
   * Buff duration: +10% per level (only the player's team)
   */
  getPowerupDurationMultiplier() {
    return 1 + 0.1 * (this.#upgrades.powerupDuration ?? 0);
  }

  /**
   * Simultaneous power-up limit: +2 per level
   */
  getPowerupLimitBonus() {
    return 2 * (this.#upgrades.powerupLimit ?? 0);
  }

  /**
   * Click pick-up radius: +15% per level
   */
  getCollectRadiusMultiplier() {
    return 1 + 0.15 * (this.#upgrades.collectRadius ?? 0);
  }

  reset() {
    this.#credits = 0;
    this.#selectedTeam = "rocks";
    this.#teamChosen = false;
    this.#upgrades = this.#defaultUpgrades();
    this.#raceUpgrades = this.#defaultRaceUpgrades();
    this.eventBus.emit("progress:update", { credits: 0 });
    this.saveProgress();
  }

  saveProgress() {
    const data = {
      credits: this.#credits,
      selectedTeam: this.#selectedTeam,
      teamChosen: this.#teamChosen,
      upgrades: this.#upgrades,
      raceUpgrades: this.#raceUpgrades
    };

    this.storageAdapter.save(data, "game-progress");
  }

  #loadBasicProperties(data) {
    if (typeof data.credits === "number" && Number.isFinite(data.credits) && data.credits >= 0) {
      this.#credits = Math.round(data.credits);
    } else {
      this.#credits = 0;
    }

    if (typeof data.teamChosen === "boolean") {
      this.#teamChosen = data.teamChosen;
    } else {
      this.#teamChosen = false;
    }

    const validTeams = Object.keys(this.raceStats);

    if (typeof data.selectedTeam === "string" && validTeams.includes(data.selectedTeam)) {
      this.#selectedTeam = data.selectedTeam;
    } else {
      this.#selectedTeam = "rocks";
    }
  }

  #loadUpgrades(data) {
    const defaultUpgrades = this.#defaultUpgrades();

    this.#upgrades = defaultUpgrades;

    if (!data.upgrades || typeof data.upgrades !== "object" || Array.isArray(data.upgrades)) {
      return;
    }

    Object.keys(defaultUpgrades).forEach(key => {
      const val = data.upgrades[key];

      if (typeof val === "number" && Number.isInteger(val) && val >= 0) {
        this.#upgrades[key] = val;
      }
    });
  }

  #loadRaceUpgrades(data) {
    const defaultRaceUpgrades = this.#defaultRaceUpgrades();

    this.#raceUpgrades = defaultRaceUpgrades;

    if (!data.raceUpgrades || typeof data.raceUpgrades !== "object" || Array.isArray(data.raceUpgrades)) {
      return;
    }

    const validTeams = Object.keys(this.raceStats);

    validTeams.forEach(team => {
      const teamData = data.raceUpgrades[team];

      if (!teamData || typeof teamData !== "object" || Array.isArray(teamData)) {
        return;
      }

      this.perRaceUpgrades.forEach(key => {
        const val = teamData[key];

        if (typeof val === "number" && Number.isInteger(val) && val >= 0) {
          this.#raceUpgrades[team][key] = val;
        }
      });
    });
  }

  loadProgress() {
    try {
      const data = this.storageAdapter.load("game-progress");

      if (!data) {
        return;
      }

      this.#loadBasicProperties(data);
      this.#loadUpgrades(data);
      this.#loadRaceUpgrades(data);

      this.eventBus.emit("progress:update", { credits: this.#credits });
    } catch (error) {
      this.logger.warn("The persistence data is corrupt or has been modified without authorization.", error);
      this.storageAdapter.clear("game-progress");
      this.reset();
    }
  }
}
