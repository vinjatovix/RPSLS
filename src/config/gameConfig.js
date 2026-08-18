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
  },
  meta: {
    initialTimeLeftMs: 10000,
    stallTimeoutMs: 30000,
    stallCountdownMs: 10000,
    powerupSpawnIntervalMs: 4500,
    powerupMaxConcurrent: 8,
    enemiesPerLevel: 10
  }
});

function race(team, { emoji, color, description, aim, health, damage, baseSpeed, rotationOffset = 0, ...movement }) {
  return {
    emoji,
    team,
    color,
    description,
    aim,
    health: { current: health, max: health },
    damage: { amount: damage },
    movement: { baseSpeed, ...movement },
    rotationOffset
  };
}

export const RACE_STATS = Object.freeze({
  rocks: race("rocks", {
    emoji: "🪨",
    color: "gray",
    description: "High health, slow turn",
    aim: ["scissors", "lizards"],
    health: 570,
    damage: 10,
    baseSpeed: 3.2,
    maxSpeed: 14,
    minSpeed: 0.4,
    speedVariance: 2,
    acceleration: 0.07,
    deceleration: 0.05,
    rotationSpeed: 0.013,
    rotationAcceleration: 0.0012
  }),
  papers: race("papers", {
    emoji: "📄",
    color: "purple",
    description: "Best turn, balanced",
    aim: ["rocks", "spocks"],
    health: 450,
    damage: 9,
    baseSpeed: 3.5,
    maxSpeed: 15,
    minSpeed: 0.5,
    speedVariance: 3,
    acceleration: 0.08,
    deceleration: 0.07,
    rotationSpeed: 0.018,
    rotationAcceleration: 0.003
  }),
  scissors: race("scissors", {
    emoji: "✂️",
    color: "red",
    description: "Max damage, low health",
    aim: ["papers", "lizards"],
    health: 340,
    damage: 14,
    baseSpeed: 3.8,
    maxSpeed: 15,
    minSpeed: 0.5,
    speedVariance: 3,
    acceleration: 0.08,
    deceleration: 0.06,
    rotationSpeed: 0.017,
    rotationAcceleration: 0.002,
    rotationOffset: Math.PI
  }),
  lizards: race("lizards", {
    emoji: "🦎",
    color: "green",
    description: "Fastest, balanced",
    aim: ["spocks", "papers"],
    health: 470,
    damage: 13,
    baseSpeed: 5,
    maxSpeed: 19,
    minSpeed: 0.5,
    speedVariance: 4,
    acceleration: 0.09,
    deceleration: 0.09,
    rotationSpeed: 0.015,
    rotationAcceleration: 0.002
  }),
  spocks: race("spocks", {
    emoji: "🖖",
    color: "yellow",
    description: "Strong acceleration, good braking",
    aim: ["rocks", "scissors"],
    health: 445,
    damage: 13,
    baseSpeed: 3.5,
    maxSpeed: 15,
    minSpeed: 0.5,
    speedVariance: 3,
    acceleration: 0.11,
    deceleration: 0.11,
    rotationSpeed: 0.014,
    rotationAcceleration: 0.0018
  })
});

function powerup({ emoji, label, color, duration = 0, amount = 0, weight, trap = false }) {
  return { emoji, label, color, duration, amount, weight, ...(trap && { trap }) };
}

export const POWERUP_TYPES = Object.freeze({
  heal: powerup({ emoji: "❤️", label: "Heal", color: "#ff5c5c", weight: 20 }),
  speed: powerup({ emoji: "⚡", label: "Speed", color: "#ffe14d", duration: 15000, amount: 2, weight: 16 }),
  damage: powerup({ emoji: "💥", label: "Damage", color: "#ff8c00", duration: 15000, amount: 2, weight: 14 }),
  turn: powerup({ emoji: "🔄", label: "Turn", color: "#6ec6ff", duration: 15000, amount: 2, weight: 12 }),
  armor: powerup({ emoji: "🛡️", label: "Armor", color: "#8ce0ff", duration: 10000, weight: 12 }),
  slow: powerup({ emoji: "🐌", label: "Slow", color: "#b388ff", duration: 15000, amount: 0.6, weight: 10, trap: true }),
  zap: powerup({ emoji: "💀", label: "Zap", color: "#9e9e9e", amount: 0.5, weight: 10, trap: true }),
  time: powerup({ emoji: "⏰", label: "Time", color: "#ffd54f", amount: 5000, weight: 6 }),
  haste: powerup({ emoji: "🚀", label: "Turbo", color: "#ffa94d", duration: 15000, amount: 2, weight: 10 }),
  gold: powerup({ emoji: "💰", label: "Gold", color: "#ffd700", amount: 5, weight: 6 }),
  freeze: powerup({ emoji: "❄️", label: "Frozen", color: "#a8e6ff", duration: 5000, weight: 6, trap: true }),
  vampire: powerup({ emoji: "🧛", label: "Vampire", color: "#ff4d6d", duration: 10000, amount: 0.5, weight: 8 }),
  confusion: powerup({ emoji: "🌀", label: "Confused", color: "#c586ff", duration: 8000, weight: 6, trap: true }),
  regeneration: powerup({ emoji: "💚", label: "Regen", color: "#5cff8c", duration: 10000, amount: 40, weight: 8 })
});

function mode(kind, capture) {
  const captureLabel = capture ? "Capture" : "Death";
  const kindLabel = kind === "league" ? "League" : kind === "level" ? "Level" : "Infinite";
  return { label: `${kindLabel} · ${captureLabel}`, capture, isLeague: kind === "league", kind };
}

export const GAME_MODES = Object.freeze({
  "league-death": mode("league", false),
  "infinite-death": mode("infinite", false),
  "level-death": mode("level", false),
  "league-capture": mode("league", true),
  "infinite-capture": mode("infinite", true),
  "level-capture": mode("level", true)
});

export const LEAGUE_LENGTHS = Object.freeze([50, 100, 200]);

function upgrade({ label, emoji, perRace = true, baseCost, costGrowth = 1.35, description }) {
  return { label, emoji, perRace, baseCost, costGrowth, description };
}

export const UPGRADES = Object.freeze({
  health: upgrade({ label: "Health", emoji: "❤️", baseCost: 20, description: "+10% health" }),
  damage: upgrade({ label: "Damage", emoji: "💥", baseCost: 25, description: "+10% damage" }),
  speed: upgrade({ label: "Speed", emoji: "⚡", baseCost: 25, description: "+8% speed" }),
  acceleration: upgrade({ label: "Acceleration", emoji: "🚀", baseCost: 20, description: "+10% acceleration" }),
  turn: upgrade({ label: "Turn", emoji: "🔄", baseCost: 20, description: "+10% turn" }),
  deceleration: upgrade({ label: "Braking", emoji: "🛑", baseCost: 20, description: "+10% braking" }),
  regeneration: upgrade({ label: "Regeneration", emoji: "❤️🔄", baseCost: 25, description: "+4 health/s" }),
  armor: upgrade({ label: "Armor", emoji: "🛡️", baseCost: 25, description: "-8% incoming damage" }),
  vampire: upgrade({ label: "Lifesteal", emoji: "🧛", baseCost: 30, description: "+5% heal on damage" }),
  powerupLuck: upgrade({ label: "Power-up luck", emoji: "🍀", perRace: false, baseCost: 30, costGrowth: 1.4, description: "+5% spawn frequency" }),
  creditRate: upgrade({ label: "Credits", emoji: "💰", perRace: false, baseCost: 40, costGrowth: 1.4, description: "+10% credits earned" }),
  timeCompression: upgrade({ label: "Compression", emoji: "⏩", perRace: false, baseCost: 100, costGrowth: 2.5, description: "Simulation ×2 (more matches per hour)" }),
  powerupDuration: upgrade({ label: "Buff duration", emoji: "⏱️", perRace: false, baseCost: 30, costGrowth: 1.4, description: "+10% power-up duration" }),
  powerupLimit: upgrade({ label: "Power-up limit", emoji: "📦", perRace: false, baseCost: 35, costGrowth: 1.4, description: "+2 simultaneous power-ups" }),
  collectRadius: upgrade({ label: "Collect radius", emoji: "🎯", perRace: false, baseCost: 25, costGrowth: 1.4, description: "+15% pick-up radius" })
});
