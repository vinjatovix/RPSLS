import assert from "node:assert/strict";
import { test } from "node:test";

import { GAME_CONFIG, POWERUP_TYPES, UPGRADES } from "../../src/config/gameConfig.js";
import { EnemyBuilder } from "../builders/EnemyBuilder.mjs";
import { setupSimulationContext, TICK_MS } from "../doubles/setupSimulationContext.mjs";

const TEST_CREDITS_BUDGET = 500;
const TEST_TEAM = "rocks";

const parseIntegerFromDescription = (description) => {
  const match = description.match(/[+-]?\d+/);
  if (!match) {
    throw new Error(`Failed to parse integer from description: "${description}"`);
  }

  return parseInt(match[0], 10);
};

const REGEN_LEVEL_1_EXPECTED_VALUE = parseIntegerFromDescription(UPGRADES.regeneration.description);
const ARMOR_LEVEL_1_EXPECTED_VALUE = Math.abs(parseIntegerFromDescription(UPGRADES.armor.description)) / 100;
const VAMP_LEVEL_1_EXPECTED_VALUE = Math.abs(parseIntegerFromDescription(UPGRADES.vampire.description)) / 100;
const DECEL_LEVEL_1_EXPECTED_VALUE = 1 + parseIntegerFromDescription(UPGRADES.deceleration.description) / 100;

const POWERUP_DURATION_LEVEL_1_MULT = 1 + parseIntegerFromDescription(UPGRADES.powerupDuration.description) / 100;
const POWERUP_LIMIT_LEVEL_1_BONUS = parseIntegerFromDescription(UPGRADES.powerupLimit.description);
const COLLECT_RADIUS_LEVEL_1_MULT = 1 + parseIntegerFromDescription(UPGRADES.collectRadius.description) / 100;

const BASE_POWERUP_INTERVAL_MS = GAME_CONFIG.meta.powerupSpawnIntervalMs;
const POWERUP_LUCK_LEVEL_1_EXPECTED_VAL = 1 + parseIntegerFromDescription(UPGRADES.powerupLuck.description) / 100;

const EXPECTED_CREDITS_PER_TEAM_KILL = 2;
const EXPECTED_CREDITS_PER_OTHER_KILL = 0;

const TEST_POSITION_X = 100;
const TEST_POSITION_Y = 100;
const REGEN_VALUE = 4;
const ONE_SECOND_MS = 1000;
const HALF_LIFE_RATIO = 0.5;

const POSITION_Y_ARMORED = 140;
const POSITION_Y_UNARMORED = 180;
const ARMOR_REDUCTION_RATIO = 0.5;
const EXPECTED_ARMORED_MULTIPLIER = 0.5;
const EXPECTED_DEFAULT_MULTIPLIER = 1.0;
const EXPECTED_BUFFED_MULTIPLIER = 0.0;
const BUFF_DURATION_ARMOR_MS = POWERUP_TYPES.armor.duration;
const BUFF_VALUE_ARMOR_AMOUNT = POWERUP_TYPES.armor.amount ?? 0;

const POSITION_Y_BASE = 220;
const POSITION_Y_BRAKED = 260;
const POSITION_Y_ACCEL = 300;
const POSITION_Y_ACCEL_DECEL = 340;
const MODIFIER_FACTOR_TWO = 2;
const MODIFIER_FACTOR_FOUR = 4;

const VAMP_ATTACKER_POSITION_X = 200;
const VAMP_ATTACKER_POSITION_Y = 200;
const VAMP_MODIFIER_RATIO = 0.5;
const PREY_FROZEN_BUFF_DURATION_MS = POWERUP_TYPES.freeze.duration * 20;
const PREY_FROZEN_BUFF_VALUE = POWERUP_TYPES.freeze.amount ?? 0;
const PREY_MASSIVE_LIFE = 1000000000;
const ATTACKER_HEALTH_RATIO = 0.5;
const SIMULATION_STEPS_FOR_COMBAT = 40;

function makeGame() {
  const { game } = setupSimulationContext("rocks");
  game.matchManager = {
    match: 0,
    paused: false,
    update: () => {}
  };
  game.powerupTimer = Infinity;

  return game;
}

test("Config: UPGRADES regeneration is a per-race upgrade", () => {
  assert.equal(UPGRADES.regeneration?.perRace, true);
});

test("Config: UPGRADES armor is a per-race upgrade", () => {
  assert.equal(UPGRADES.armor?.perRace, true);
});

test("Config: UPGRADES vampire is a per-race upgrade", () => {
  assert.equal(UPGRADES.vampire?.perRace, true);
});

test("Config: UPGRADES deceleration is a per-race upgrade", () => {
  assert.equal(UPGRADES.deceleration?.perRace, true);
});

test("Config: UPGRADES powerupDuration is a global upgrade", () => {
  assert.equal(UPGRADES.powerupDuration?.perRace, false);
});

test("Config: UPGRADES powerupLimit is a global upgrade", () => {
  assert.equal(UPGRADES.powerupLimit?.perRace, false);
});

test("Config: UPGRADES collectRadius is a global upgrade", () => {
  assert.equal(UPGRADES.collectRadius?.perRace, false);
});

test("ProgressManager: buying regeneration upgrade on a team increases its regeneration modifier", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("regeneration", TEST_TEAM);
  assert.ok(purchased);

  const modifiers = game.progressManager.getRaceModifiers(TEST_TEAM);
  assert.equal(modifiers.regeneration, REGEN_LEVEL_1_EXPECTED_VALUE);

  game.destroy();
});

test("ProgressManager: buying armor upgrade on a team increases its armor modifier", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("armor", TEST_TEAM);
  assert.ok(purchased);

  const modifiers = game.progressManager.getRaceModifiers(TEST_TEAM);
  assert.equal(modifiers.armor, ARMOR_LEVEL_1_EXPECTED_VALUE);

  game.destroy();
});

test("ProgressManager: buying vampire upgrade on a team increases its vampire modifier", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("vampire", TEST_TEAM);
  assert.ok(purchased);

  const modifiers = game.progressManager.getRaceModifiers(TEST_TEAM);
  assert.equal(modifiers.vampire, VAMP_LEVEL_1_EXPECTED_VALUE);

  game.destroy();
});

test("ProgressManager: buying deceleration upgrade on a team increases its deceleration modifier", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("deceleration", TEST_TEAM);
  assert.ok(purchased);

  const modifiers = game.progressManager.getRaceModifiers(TEST_TEAM);
  assert.equal(modifiers.deceleration, DECEL_LEVEL_1_EXPECTED_VALUE);

  game.destroy();
});

test("ProgressManager: buying powerupDuration upgrade increases the duration multiplier", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("powerupDuration");
  assert.ok(purchased);

  const multiplier = game.progressManager.getPowerupDurationMultiplier();
  assert.equal(multiplier, POWERUP_DURATION_LEVEL_1_MULT);

  game.destroy();
});

test("ProgressManager: buying powerupLimit upgrade increases the limit bonus cap", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("powerupLimit");
  assert.ok(purchased);

  const bonus = game.progressManager.getPowerupLimitBonus();
  assert.equal(bonus, POWERUP_LIMIT_LEVEL_1_BONUS);

  game.destroy();
});

test("ProgressManager: buying collectRadius upgrade increases the collection radius multiplier", () => {
  const game = makeGame();
  game.progressManager.awardCredits(TEST_CREDITS_BUDGET);

  const purchased = game.progressManager.buyUpgrade("collectRadius");
  assert.ok(purchased);

  const multiplier = game.progressManager.getCollectRadiusMultiplier();
  assert.equal(multiplier, COLLECT_RADIUS_LEVEL_1_MULT);

  game.destroy();
});

test("Enemy: regeneration modifier heals an injured enemy over time", () => {
  const game = makeGame();
  const regenEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, TEST_POSITION_Y)
    .withModifiers({ regeneration: REGEN_VALUE })
    .build();

  regenEnemy.life = regenEnemy.maxLife * HALF_LIFE_RATIO;
  const initialLife = regenEnemy.life;

  regenEnemy.update(ONE_SECOND_MS, []);

  assert.ok(regenEnemy.life > initialLife);

  game.destroy();
});

test("Enemy: regeneration modifier does not heal past maxLife", () => {
  const game = makeGame();
  const regenEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, TEST_POSITION_Y)
    .withModifiers({ regeneration: REGEN_VALUE })
    .build();

  regenEnemy.life = regenEnemy.maxLife;

  regenEnemy.update(ONE_SECOND_MS, []);

  assert.equal(regenEnemy.life, regenEnemy.maxLife);

  game.destroy();
});

test("Enemy: getIncomingDamageMultiplier returns default multiplier when there is no armor", () => {
  const game = makeGame();
  const unarmored = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_UNARMORED)
    .build();

  const multiplier = unarmored.getIncomingDamageMultiplier();
  assert.equal(multiplier, EXPECTED_DEFAULT_MULTIPLIER);

  game.destroy();
});

test("Enemy: getIncomingDamageMultiplier is reduced by armor modifier", () => {
  const game = makeGame();
  const armored = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_ARMORED)
    .withModifiers({ armor: ARMOR_REDUCTION_RATIO })
    .build();

  const multiplier = armored.getIncomingDamageMultiplier();
  assert.equal(multiplier, EXPECTED_ARMORED_MULTIPLIER);

  game.destroy();
});

test("Enemy: getIncomingDamageMultiplier is nullified when armor buff is active", () => {
  const game = makeGame();
  const unarmored = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_UNARMORED)
    .build();

  unarmored.applyBuff("armor", BUFF_DURATION_ARMOR_MS, BUFF_VALUE_ARMOR_AMOUNT);

  const multiplier = unarmored.getIncomingDamageMultiplier();
  assert.equal(multiplier, EXPECTED_BUFFED_MULTIPLIER);

  game.destroy();
});

test("Enemy: deceleration modifier directly scales deceleration", () => {
  const game = makeGame();
  const baseEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_BASE)
    .build();

  const braked = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_BRAKED)
    .withModifiers({ deceleration: MODIFIER_FACTOR_TWO })
    .build();

  assert.equal(braked.deceleration, baseEnemy.deceleration * MODIFIER_FACTOR_TWO);

  game.destroy();
});

test("Enemy: acceleration modifier also scales deceleration", () => {
  const game = makeGame();
  const baseEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_BASE)
    .build();

  const accelOnly = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_ACCEL)
    .withModifiers({ acceleration: MODIFIER_FACTOR_TWO })
    .build();

  assert.equal(accelOnly.deceleration, baseEnemy.deceleration * MODIFIER_FACTOR_TWO);

  game.destroy();
});

test("Enemy: acceleration modifier scales acceleration", () => {
  const game = makeGame();
  const baseEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_BASE)
    .build();

  const accelOnly = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_ACCEL)
    .withModifiers({ acceleration: MODIFIER_FACTOR_TWO })
    .build();

  assert.equal(accelOnly.acceleration, baseEnemy.acceleration * MODIFIER_FACTOR_TWO);

  game.destroy();
});

test("Enemy: acceleration and deceleration modifiers accumulate in deceleration", () => {
  const game = makeGame();
  const baseEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_BASE)
    .build();

  const accelDecel = new EnemyBuilder()
    .withGame(game)
    .withTeam(TEST_TEAM)
    .withPosition(TEST_POSITION_X, POSITION_Y_ACCEL_DECEL)
    .withModifiers({ acceleration: MODIFIER_FACTOR_TWO, deceleration: MODIFIER_FACTOR_TWO })
    .build();

  assert.equal(accelDecel.deceleration, baseEnemy.deceleration * MODIFIER_FACTOR_FOUR);

  game.destroy();
});

test("Enemy: vampire modifier heals the attacker when dealing damage", () => {
  const game = makeGame();
  game.progressManager.awardCredits = () => {};

  const attacker = new EnemyBuilder()
    .withGame(game)
    .withTeam("rocks")
    .withPosition(VAMP_ATTACKER_POSITION_X, VAMP_ATTACKER_POSITION_Y)
    .withModifiers({ vampire: VAMP_MODIFIER_RATIO })
    .build();

  const prey = new EnemyBuilder()
    .withGame(game)
    .withTeam("scissors")
    .withPosition(VAMP_ATTACKER_POSITION_X, VAMP_ATTACKER_POSITION_Y)
    .build();

  prey.applyBuff("freeze", PREY_FROZEN_BUFF_DURATION_MS, PREY_FROZEN_BUFF_VALUE);
  prey.life = PREY_MASSIVE_LIFE;

  game.enemies = [attacker, prey];
  attacker.life = attacker.maxLife * ATTACKER_HEALTH_RATIO;
  const initialAttackerLife = attacker.life;

  for (let i = 0; i < SIMULATION_STEPS_FOR_COMBAT; i++) {
    game.entityManager.update(TICK_MS);
  }

  assert.ok(attacker.life > initialAttackerLife);

  game.destroy();
});

test("Power-up spawn: base spawn interval is 4500ms", () => {
  const { entityManager } = setupSimulationContext();

  assert.equal(entityManager.powerupTimer, BASE_POWERUP_INTERVAL_MS);
});

test("Power-up spawn: powerupLuck upgrade increases the spawn luck factor", () => {
  const { progressManager } = setupSimulationContext();
  progressManager.awardCredits(TEST_CREDITS_BUDGET);

  progressManager.buyUpgrade("powerupLuck");

  const luckFactor = progressManager.getPowerupLuck();
  assert.equal(luckFactor, POWERUP_LUCK_LEVEL_1_EXPECTED_VAL);
});

test("Credits: a kill by the player's selected team awards credits", () => {
  const { progressManager: pm } = setupSimulationContext();
  pm.reset();
  pm.selectTeam("rocks");

  pm.eventBus.emit("kill", { killerTeam: "rocks" });

  assert.equal(pm.credits, EXPECTED_CREDITS_PER_TEAM_KILL);
});

test("Credits: a kill by a team other than the player's selected team awards no credits", () => {
  const { progressManager: pm } = setupSimulationContext();
  pm.reset();
  pm.selectTeam("rocks");

  pm.eventBus.emit("kill", { killerTeam: "lizards" });

  assert.equal(pm.credits, EXPECTED_CREDITS_PER_OTHER_KILL);
});
