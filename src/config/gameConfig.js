/**
 * Configuración centralizada del juego
 * Contiene todos los parámetros globales que pueden ser ajustados
 */

export const GAME_CONFIG = Object.freeze({
  display: {
    maxWidth: 1280 * 4,
    minWidth: 1280 / 2,
    maxHeight: 768 * 4,
    minHeight: 768 / 2,
    persist: false
  },
  mechanics: {
    maxLevel: 1100,
    capture: true,
    limitCanvas: false,
    outDies: true,
    timeless: true
  },
  effects: {
    blood: true,
    snuff: false,
    debug: false,
    dot: false,
    collider: false,
    arrow: false,
    triangle: false
  }
});

/**
 * Configuración de equipos/razas
 * Por ahora todos con estadísticas iguales (a diferenciarse en próximos pasos)
 */
export const RACE_STATS = Object.freeze({
  rock: {
    emoji: "🪨",
    team: "rocks",
    color: "gray",
    aim: ["scissors", "lizard"],
    health: { current: 200, max: 200 },
    damage: { amount: 5 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.0125,
      rotationAcceleration: 0.0005
    }
  },
  paper: {
    emoji: "📄",
    team: "papers",
    color: "purple",
    aim: ["rock", "spock"],
    health: { current: 200, max: 200 },
    damage: { amount: 5 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.0125,
      rotationAcceleration: 0.0005
    }
  },
  scissors: {
    emoji: "✂️",
    team: "scissors",
    color: "red",
    aim: ["paper", "lizard"],
    health: { current: 200, max: 200 },
    damage: { amount: 5 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.0125,
      rotationAcceleration: 0.0005
    }
  },
  lizard: {
    emoji: "🦎",
    team: "lizards",
    color: "green",
    aim: ["spock", "paper"],
    health: { current: 200, max: 200 },
    damage: { amount: 5 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.0125,
      rotationAcceleration: 0.0005
    }
  },
  spock: {
    emoji: "🖖",
    team: "spocks",
    color: "yellow",
    aim: ["rock", "scissors"],
    health: { current: 200, max: 200 },
    damage: { amount: 5 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.0125,
      rotationAcceleration: 0.0005
    }
  }
});
