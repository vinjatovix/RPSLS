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
 * Cada raza con estadísticas diferenciadas:
 * - rock: tanque lento (mucha vida, poca velocidad)
 * - lizard: rápida y frágil
 * - scissors: mucho daño
 * - spock: gran aceleración
 * - paper: buen giro
 * Balance general: fuerza total (~vida × daño × movilidad) equilibrada
 */
export const RACE_STATS = Object.freeze({
  rocks: {
    emoji: "🪨",
    team: "rocks",
    color: "gray",
    aim: ["scissors", "lizards"],
    health: { current: 220, max: 220 },
    damage: { amount: 7 },
    movement: {
      baseSpeed: 3,
      maxSpeed: 14,
      minSpeed: 0.4,
      speedVariance: 2,
      acceleration: 0.05,
      deceleration: 0.06,
      rotationSpeed: 0.009,
      rotationAcceleration: 0.0004
    }
  },
  papers: {
    emoji: "📄",
    team: "papers",
    color: "purple",
    aim: ["rocks", "spocks"],
    health: { current: 200, max: 200 },
    damage: { amount: 8 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      speedVariance: 3,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.022,
      rotationAcceleration: 0.0014
    }
  },
  scissors: {
    emoji: "✂️",
    team: "scissors",
    color: "red",
    aim: ["papers", "lizards"],
    health: { current: 180, max: 180 },
    damage: { amount: 10 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      speedVariance: 3,
      acceleration: 0.06,
      deceleration: 0.06,
      rotationSpeed: 0.014,
      rotationAcceleration: 0.0006
    }
  },
  lizards: {
    emoji: "🦎",
    team: "lizards",
    color: "green",
    aim: ["spocks", "papers"],
    health: { current: 160, max: 160 },
    damage: { amount: 8 },
    movement: {
      baseSpeed: 5,
      maxSpeed: 22,
      minSpeed: 0.5,
      speedVariance: 4,
      acceleration: 0.09,
      deceleration: 0.08,
      rotationSpeed: 0.014,
      rotationAcceleration: 0.0006
    }
  },
  spocks: {
    emoji: "🖖",
    team: "spocks",
    color: "yellow",
    aim: ["rocks", "scissors"],
    health: { current: 190, max: 190 },
    damage: { amount: 7 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 17,
      minSpeed: 0.5,
      speedVariance: 3,
      acceleration: 0.16,
      deceleration: 0.1,
      rotationSpeed: 0.013,
      rotationAcceleration: 0.0006
    }
  }
});

/**
 * Tipos de powerup que spawnean en el mapa
 * duration: ms que dura el efecto (0 = instantáneo)
 * amount: cantidad/multiplicador del efecto
 * trap: true = efecto negativo para quien lo recoge
 * weight: peso relativo para el spawn aleatorio
 */
export const POWERUP_TYPES = Object.freeze({
  heal: { emoji: "❤️", color: "#ff5c5c", duration: 0, amount: 80, weight: 20 },
  speed: { emoji: "⚡", color: "#ffe14d", duration: 8000, amount: 1.5, weight: 16 },
  damage: { emoji: "💥", color: "#ff8c00", duration: 8000, amount: 6, weight: 14 },
  turn: { emoji: "🔄", color: "#6ec6ff", duration: 8000, amount: 1.5, weight: 12 },
  armor: { emoji: "🛡️", color: "#8ce0ff", duration: 8000, amount: 0.5, weight: 12 },
  slow: { emoji: "🐌", color: "#b388ff", duration: 8000, amount: 0.6, weight: 10, trap: true },
  zap: { emoji: "💀", color: "#9e9e9e", duration: 0, amount: 40, weight: 10, trap: true },
  time: { emoji: "⏰", color: "#ffd54f", duration: 0, amount: 5000, weight: 6 }
});

/**
 * Mejoras del shop de entrenamiento
 * perRace: true = solo afecta a la raza seleccionada (nivel por raza)
 *          false = global (nivel único)
 */
export const UPGRADES = Object.freeze({
  hp: {
    label: "Vida",
    emoji: "❤️",
    perRace: true,
    baseCost: 20,
    costGrowth: 1.35,
    description: "+10% vida"
  },
  damage: {
    label: "Daño",
    emoji: "💥",
    perRace: true,
    baseCost: 25,
    costGrowth: 1.35,
    description: "+10% daño"
  },
  speed: {
    label: "Velocidad",
    emoji: "⚡",
    perRace: true,
    baseCost: 25,
    costGrowth: 1.35,
    description: "+8% velocidad"
  },
  accel: {
    label: "Aceleración",
    emoji: "🚀",
    perRace: true,
    baseCost: 20,
    costGrowth: 1.35,
    description: "+10% aceleración"
  },
  turn: {
    label: "Giro",
    emoji: "🔄",
    perRace: true,
    baseCost: 20,
    costGrowth: 1.35,
    description: "+10% giro"
  },
  powerupLuck: {
    label: "Suerte powerups",
    emoji: "🍀",
    perRace: false,
    baseCost: 30,
    costGrowth: 1.4,
    description: "+5% frecuencia de spawn"
  },
  creditRate: {
    label: "Créditos",
    emoji: "💰",
    perRace: false,
    baseCost: 40,
    costGrowth: 1.4,
    description: "+10% créditos ganados"
  },
  timeCompression: {
    label: "Compresión",
    emoji: "⏩",
    perRace: false,
    baseCost: 100,
    costGrowth: 2.5,
    description: "Simulación ×2 (más matches por hora)"
  }
});
