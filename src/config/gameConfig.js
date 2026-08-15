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
    capture: true,
    limitCanvas: false,
    outDies: true,
    timeless: true,
    matchTimeBaseMs: 10000,
    matchTimeGrowthMs: 50,
    matchTimeMaxMs: 60000,
    ai: {
      dangerRadius: 220,
      escape: {
        margin: 30,
        step: Math.PI / 12,
        clearanceWeight: 0.78,
        awayWeight: 0.22
      }
    }
  },
  effects: {
    blood: true,
    snuff: false,
    debug: false,
    collider: false
  }
});

/**
 * Configuración de equipos/razas
 * Cada raza con estadísticas diferenciadas:
 * - rock: el tanque, mucha vida
 * - lizard: la más rápida
 * - scissors: el cristal, máximo daño
 * - spock: gran aceleración y frenada
 * - paper: el mejor giro
 * El RPS (quién mata a quién) está forzado por aim en código.
 */
export const RACE_STATS = Object.freeze({
  rocks: {
    emoji: "🪨",
    team: "rocks",
    color: "gray",
    description: "Mucha vida, poco giro",
    aim: ["scissors", "lizards"],
    health: { current: 545, max: 545 },
    damage: { amount: 10 },
    movement: {
      baseSpeed: 3,
      maxSpeed: 14,
      minSpeed: 0.4,
      speedVariance: 2,
      acceleration: 0.06,
      deceleration: 0.05,
      rotationSpeed: 0.012,
      rotationAcceleration: 0.0012
    }
  },
  papers: {
    emoji: "📄",
    team: "papers",
    color: "purple",
    description: "El mejor giro, equilibrado",
    aim: ["rocks", "spocks"],
    health: { current: 450, max: 450 },
    damage: { amount: 9 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      speedVariance: 3,
      acceleration: 0.08,
      deceleration: 0.07,
      rotationSpeed: 0.018,
      rotationAcceleration: 0.003
    }
  },
  scissors: {
    emoji: "✂️",
    team: "scissors",
    color: "red",
    description: "Máximo daño, poca vida",
    aim: ["papers", "lizards"],
    health: { current: 340, max: 340 },
    damage: { amount: 15 },
    movement: {
      baseSpeed: 4,
      maxSpeed: 16,
      minSpeed: 0.5,
      speedVariance: 3,
      acceleration: 0.08,
      deceleration: 0.06,
      rotationSpeed: 0.017,
      rotationAcceleration: 0.002
    }
  },
  lizards: {
    emoji: "🦎",
    team: "lizards",
    color: "green",
    description: "La más rápida, equilibrada",
    aim: ["spocks", "papers"],
    health: { current: 470, max: 470 },
    damage: { amount: 13 },
    movement: {
      baseSpeed: 5,
      maxSpeed: 19,
      minSpeed: 0.5,
      speedVariance: 4,
      acceleration: 0.09,
      deceleration: 0.09,
      rotationSpeed: 0.015,
      rotationAcceleration: 0.002
    }
  },
  spocks: {
    emoji: "🖖",
    team: "spocks",
    color: "yellow",
    description: "Gran aceleración, frena bien",
    aim: ["rocks", "scissors"],
    health: { current: 430, max: 430 },
    damage: { amount: 13 },
    movement: {
      baseSpeed: 3.5,
      maxSpeed: 15,
      minSpeed: 0.5,
      speedVariance: 3,
      acceleration: 0.11,
      deceleration: 0.11,
      rotationSpeed: 0.013,
      rotationAcceleration: 0.0018
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
  heal: { emoji: "❤️", label: "Heal", color: "#ff5c5c", duration: 0, amount: 0, weight: 20 },
  speed: { emoji: "⚡", label: "Speed", color: "#ffe14d", duration: 15000, amount: 2, weight: 16 },
  damage: { emoji: "💥", label: "Damage", color: "#ff8c00", duration: 15000, amount: 2, weight: 14 },
  turn: { emoji: "🔄", label: "Turn", color: "#6ec6ff", duration: 15000, amount: 2, weight: 12 },
  armor: { emoji: "🛡️", label: "Armor", color: "#8ce0ff", duration: 10000, amount: 0, weight: 12 },
  slow: { emoji: "🐌", label: "Slow", color: "#b388ff", duration: 15000, amount: 0.6, weight: 10, trap: true },
  zap: { emoji: "💀", label: "Zap", color: "#9e9e9e", duration: 0, amount: 0.5, weight: 10, trap: true },
  time: { emoji: "⏰", label: "Time", color: "#ffd54f", duration: 0, amount: 5000, weight: 6 },
  haste: { emoji: "🚀", label: "Turbo", color: "#ffa94d", duration: 15000, amount: 2, weight: 10 },
  gold: { emoji: "💰", label: "Gold", color: "#ffd700", duration: 0, amount: 5, weight: 6 },
  freeze: { emoji: "❄️", label: "Frozen", color: "#a8e6ff", duration: 5000, amount: 0, weight: 6, trap: true },
  vampire: { emoji: "🧛", label: "Vampire", color: "#ff4d6d", duration: 10000, amount: 0.5, weight: 8 },
  confusion: { emoji: "🌀", label: "Confused", color: "#c586ff", duration: 8000, amount: 0, weight: 6, trap: true },
  regen: { emoji: "💚", label: "Regen", color: "#5cff8c", duration: 10000, amount: 40, weight: 8 }
});

/**
 * Modos de juego
 * capture: true = los muertos se convierten en el equipo del killer
 * isLeague: true = partida limitada a un número de matches (length)
 * kind: league = elige longitud | level = elige nivel inicial | infinite = sin límite
 */
export const GAME_MODES = Object.freeze({
  "liga-muerte": { label: "Liga · Muerte", capture: false, isLeague: true, kind: "league" },
  "infinito-muerte": { label: "Infinito · Muerte", capture: false, isLeague: false, kind: "infinite" },
  "lvl-muerte": { label: "Nivel · Muerte", capture: false, isLeague: false, kind: "level" },
  "liga-captura": { label: "Liga · Captura", capture: true, isLeague: true, kind: "league" },
  "infinito-captura": { label: "Infinito · Captura", capture: true, isLeague: false, kind: "infinite" },
  "lvl-captura": { label: "Nivel · Captura", capture: true, isLeague: false, kind: "level" }
});

export const LEAGUE_LENGTHS = Object.freeze([50, 100, 200]);

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
  decel: {
    label: "Frenada",
    emoji: "🛑",
    perRace: true,
    baseCost: 20,
    costGrowth: 1.35,
    description: "+10% frenada"
  },
  regen: {
    label: "Regeneración",
    emoji: "❤️🔄",
    perRace: true,
    baseCost: 25,
    costGrowth: 1.35,
    description: "+4 vida/s"
  },
  armor: {
    label: "Armadura",
    emoji: "🛡️",
    perRace: true,
    baseCost: 25,
    costGrowth: 1.35,
    description: "-8% daño recibido"
  },
  vampire: {
    label: "Vampirismo",
    emoji: "🧛",
    perRace: true,
    baseCost: 30,
    costGrowth: 1.35,
    description: "+5% curación al dañar"
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
  },
  powerupDuration: {
    label: "Duración buffs",
    emoji: "⏱️",
    perRace: false,
    baseCost: 30,
    costGrowth: 1.4,
    description: "+10% duración de powerups"
  },
  powerupCap: {
    label: "Tope powerups",
    emoji: "📦",
    perRace: false,
    baseCost: 35,
    costGrowth: 1.4,
    description: "+2 powerups simultáneos"
  },
  collectRadius: {
    label: "Alcance recogida",
    emoji: "🎯",
    perRace: false,
    baseCost: 25,
    costGrowth: 1.4,
    description: "+15% radio de recogida"
  }
});
