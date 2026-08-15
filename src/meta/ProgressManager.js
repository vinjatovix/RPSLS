/**
 * ProgressManager - Meta-progresión del juego idle
 * Gestiona:
 * - Créditos (moneda del meta-juego)
 * - Equipo seleccionado por el jugador
 * - Mejoras de entrenamiento (por raza + globales)
 * - Persistencia en localStorage
 * Convierte eventos de match/kill en créditos vía EventBus
 */

import { UPGRADES, RACE_STATS } from "../config/gameConfig.js";

const PER_RACE_UPGRADES = Object.keys(UPGRADES).filter(key => UPGRADES[key].perRace);
const RACE_TEAMS = Object.keys(RACE_STATS);

export class ProgressManager {
  constructor({ storageAdapter, eventBus }) {
    this.storageAdapter = storageAdapter;
    this.eventBus = eventBus;
    this.saveKey = "idleSave-v1";

    // El progreso es de sesión: al recargar se empieza desde 0.
    // Solo se persisten las opciones (gameOptions-v2: debug, snuff, ...).
    this.storageAdapter.clear(this.saveKey);

    this.credits = 0;
    this.selectedTeam = "rocks";
    this.teamChosen = false;
    this.upgrades = { powerupLuck: 0, creditRate: 0, timeCompression: 0 };
    this.raceUpgrades = {};

    RACE_TEAMS.forEach(team => {
      if (!this.raceUpgrades[team]) {
        this.raceUpgrades[team] = {};
      }
      PER_RACE_UPGRADES.forEach(key => {
        if (!(key in this.raceUpgrades[team])) {
          this.raceUpgrades[team][key] = 0;
        }
      });
    });

    this.#subscribe();
  }

  #subscribe() {
    this.eventBus.subscribe("kill", ({ killerTeam }) => {
      if (killerTeam === this.selectedTeam) {
        this.awardCredits(1);
      }
    });

    this.eventBus.subscribe("match-win", ({ team, match, mvp }) => {
      if (team === this.selectedTeam) {
        this.awardCredits(10 + match + (mvp ? 5 : 0));
      }
    });
  }

  /**
   * Añadir créditos aplicando el multiplicador de rate
   */
  awardCredits(base) {
    this.credits += Math.round(base * this.getCreditMultiplier());
    this.save();
    this.eventBus.emit("credits-updated", { credits: this.credits });
  }

  /**
   * Intentar gastar créditos. Devuelve true si se pudo.
   */
  spendCredits(amount) {
    if (this.credits < amount) return false;
    this.credits -= amount;
    this.save();
    this.eventBus.emit("credits-updated", { credits: this.credits });
    return true;
  }

  /**
   * ¿El jugador ya eligió equipo? (la primera vez hay que elegir antes de empezar)
   */
  isTeamChosen() {
    return this.teamChosen;
  }

  /**
   * Cambiar de equipo
   */
  selectTeam(team) {
    if (!RACE_TEAMS.includes(team)) return false;
    this.selectedTeam = team;
    this.teamChosen = true;
    this.save();
    return true;
  }

  /**
   * Coste de una mejora (por raza o global)
   */
  getUpgradeCost(key, team = null) {
    const config = UPGRADES[key];
    if (!config) return 0;
    const level = this.getUpgradeLevel(key, team);
    return Math.floor(config.baseCost * Math.pow(config.costGrowth, level));
  }

  getUpgradeLevel(key, team = null) {
    if (UPGRADES[key].perRace) {
      const t = team || this.selectedTeam;
      return this.raceUpgrades[t]?.[key] ?? 0;
    }
    return this.upgrades[key] ?? 0;
  }

  /**
   * Comprar mejora. Devuelve true si se compró.
   */
  buyUpgrade(key, team = null) {
    const config = UPGRADES[key];
    if (!config) return false;
    const cost = this.getUpgradeCost(key, team);
    if (!this.spendCredits(cost)) return false;

    if (config.perRace) {
      const t = team || this.selectedTeam;
      this.raceUpgrades[t][key] += 1;
    } else {
      this.upgrades[key] += 1;
    }
    this.save();
    return true;
  }

  /**
   * Modifiers aplicados a la raza según sus mejoras
   */
  getRaceModifiers(team) {
    const levels = this.raceUpgrades[team] ?? {};
    return {
      hp: 1 + 0.1 * (levels.hp ?? 0),
      damage: 1 + 0.1 * (levels.damage ?? 0),
      speed: 1 + 0.08 * (levels.speed ?? 0),
      accel: 1 + 0.1 * (levels.accel ?? 0),
      turn: 1 + 0.1 * (levels.turn ?? 0)
    };
  }

  /**
   * Compresión de tiempo: ×2 por nivel
   */
  getTimeCompression() {
    return Math.pow(2, this.upgrades.timeCompression ?? 0);
  }

  /**
   * Multiplicador de créditos: +10% por nivel
   */
  getCreditMultiplier() {
    return 1 + 0.1 * (this.upgrades.creditRate ?? 0);
  }

  /**
   * Suerte de powerups: +5% frecuencia de spawn por nivel
   */
  getPowerupLuck() {
    return 1 + 0.05 * (this.upgrades.powerupLuck ?? 0);
  }

  save() {
    // El progreso es de sesión: no se persiste nada en localStorage.
  }

  /**
   * Resetear todo el progreso
   */
  reset() {
    this.credits = 0;
    this.selectedTeam = "rocks";
    this.teamChosen = false;
    this.upgrades = { powerupLuck: 0, creditRate: 0, timeCompression: 0 };
    this.raceUpgrades = {};
    RACE_TEAMS.forEach(team => {
      this.raceUpgrades[team] = {};
      PER_RACE_UPGRADES.forEach(key => {
        this.raceUpgrades[team][key] = 0;
      });
    });
    this.save();
    this.eventBus.emit("credits-updated", { credits: 0 });
  }
}
