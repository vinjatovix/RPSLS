import { UPGRADES, RACE_STATS } from "../config/gameConfig.js";

const PER_RACE_UPGRADES = Object.keys(UPGRADES).filter(key => UPGRADES[key].perRace);
const RACE_TEAMS = Object.keys(RACE_STATS);

function isNonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export class ProgressManager {
  #credits = 0;
  #selectedTeam = "rocks";
  #teamChosen = false;
  #upgrades = {};
  #raceUpgrades = {};

  constructor({ eventBus }) {
    this.eventBus = eventBus;

    this.#upgrades = this.#defaultUpgrades();
    this.#raceUpgrades = this.#defaultRaceUpgrades();

    this.#subscribe();
  }

  #defaultUpgrades() {
    return {
      powerupLuck: 0,
      creditRate: 0,
      timeCompression: 0,
      powerupDuration: 0,
      powerupLimit: 0,
      collectRadius: 0
    };
  }

  #defaultRaceUpgrades() {
    const raceUpgrades = {};
    RACE_TEAMS.forEach(team => {
      raceUpgrades[team] = {};
      PER_RACE_UPGRADES.forEach(key => {
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
  }

  spendCredits(amount) {
    if (!isNonNegativeFinite(amount)) return false;
    if (this.#credits < amount) return false;
    this.#credits -= amount;
    this.eventBus.emit("progress:update", { credits: this.#credits });
    return true;
  }

  isTeamChosen() {
    return this.#teamChosen;
  }

  selectTeam(team) {
    if (!RACE_TEAMS.includes(team)) return false;
    this.#selectedTeam = team;
    this.#teamChosen = true;
    return true;
  }

  getUpgradeCost(key, team = null) {
    const config = UPGRADES[key];
    if (!config) return 0;
    const level = this.getUpgradeLevel(key, team);
    return Math.floor(config.baseCost * Math.pow(config.costGrowth, level));
  }

  getUpgradeLevel(key, team = null) {
    if (UPGRADES[key].perRace) {
      const t = team || this.selectedTeam;
      return this.#raceUpgrades[t]?.[key] ?? 0;
    }
    return this.#upgrades[key] ?? 0;
  }

  buyUpgrade(key, team = null) {
    const config = UPGRADES[key];
    if (!config) return false;
    const cost = this.getUpgradeCost(key, team);
    if (!this.spendCredits(cost)) return false;

    if (config.perRace) {
      const t = team || this.selectedTeam;
      this.#raceUpgrades[t][key] += 1;
    } else {
      this.#upgrades[key] += 1;
    }
    this.eventBus.emit("progress:update", { credits: this.#credits });
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
  }
}
