import assert from "node:assert/strict";
import { test } from "node:test";

import { POWERUP_TYPES } from "../../src/config/gameConfig.js";
import { Random } from "../../src/core/index.js";
import { PowerUpBuilder } from "../builders/PowerUpBuilder.mjs";
import { setupSimulationContext, TICK_MS } from "../doubles/setupSimulationContext.mjs";
import { EnemyMother } from "../mothers/EnemyMother.mjs";

const MIN_GOLD_CREDITS = POWERUP_TYPES.gold.amount;
const MAX_GOLD_CREDITS = MIN_GOLD_CREDITS + POWERUP_TYPES.gold.range - 1;

function setupEffectsContext() {
  const { game, progressManager } = setupSimulationContext("rocks");

  progressManager.awardCredits = () => {};
  game.enemies = [
    EnemyMother.rock(game),
    EnemyMother.paper(game),
    EnemyMother.scissors(game)
  ];

  return { game, progressManager };
}

test("Config: POWERUP_TYPES includes the expected types and durations", () => {
  const config = POWERUP_TYPES;

  ["haste", "gold", "freeze", "vampire", "confusion", "regeneration"].forEach(key => {
    assert.ok(config[key], `POWERUP_TYPES must include ${key}`);
  });
  assert.equal(config.speed.duration, 15000, "speed lasts 15s");
  assert.equal(config.damage.duration, 15000, "damage lasts 15s");
  assert.equal(config.turn.duration, 15000);
  assert.equal(config.turn.amount, 2);
  assert.equal(config.armor.duration, 10000);
  assert.equal(config.armor.amount, 0, "armor nullifies");
  assert.equal(config.slow.duration, 15000);
  assert.equal(config.zap.amount, 0.5, "zap reduces to half");
  assert.equal(config.haste.duration, 15000);
  assert.equal(config.haste.amount, 2);
  assert.equal(config.freeze.duration, 5000);
  assert.equal(config.vampire.duration, 10000);
  assert.equal(config.vampire.amount, 0.5);
  assert.equal(config.confusion.duration, 8000);
  assert.equal(config.regeneration.duration, 10000);
  assert.equal(config.regeneration.amount, 40);
});

test("heal: always heals to full", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");
  const heal = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .build();

  const halfLife = rock.maxLife / 2;
  rock.life = halfLife;

  heal.applyToTeam("rocks");

  assert.equal(rock.life, rock.maxLife, `left at ${rock.life}/${rock.maxLife}`);
});

test("zap: reduces the CURRENT life to half (base, not total)", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");
  const zap = new PowerUpBuilder()
    .withGame(game)
    .withType("zap")
    .build();

  const initialLife = 200;
  rock.life = initialLife;

  zap.applyToTeam("rocks");

  const expectedLifeAfterZap = Math.max(1, Math.floor(initialLife * POWERUP_TYPES.zap.amount));
  assert.equal(rock.life, expectedLifeAfterZap, `${initialLife} -> ${rock.life}`);
  assert.notEqual(rock.life, Math.floor(rock.maxLife * POWERUP_TYPES.zap.amount), "must not use the total as base");
  assert.ok(!rock.dead, "zap no longer kills");
});

test("armor buff: nullifies incoming damage", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");

  rock.applyBuff("armor", POWERUP_TYPES.armor.duration, POWERUP_TYPES.armor.amount);

  assert.equal(rock.getIncomingDamageMultiplier(), POWERUP_TYPES.armor.amount, "armor nullifies damage (x0)");
});

test("damage buff: increases damage output multiplicatively", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");

  rock.applyBuff("damage", POWERUP_TYPES.damage.duration, POWERUP_TYPES.damage.amount);

  const expectedDamageMultiplier = rock.baseDamage * rock.damageMultiplier * POWERUP_TYPES.damage.amount;
  assert.equal(rock.getDamage(), expectedDamageMultiplier, "damage x2 multiplicative");
});

test("speed multipliers: combining speed, slow, and freeze buffs", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");

  rock.applyBuff("speed", POWERUP_TYPES.speed.duration, POWERUP_TYPES.speed.amount);
  assert.equal(rock.getSpeedMultiplier(), POWERUP_TYPES.speed.amount, "speed multiplier is correct");

  rock.applyBuff("slow", POWERUP_TYPES.slow.duration, POWERUP_TYPES.slow.amount);
  const expectedSpeedAndSlowMultiplier = POWERUP_TYPES.speed.amount * POWERUP_TYPES.slow.amount;
  assert.equal(rock.getSpeedMultiplier(), expectedSpeedAndSlowMultiplier, "speed and slow combine multiplicatively");

  rock.applyBuff("freeze", POWERUP_TYPES.freeze.duration, POWERUP_TYPES.freeze.amount);
  assert.equal(rock.getSpeedMultiplier(), POWERUP_TYPES.freeze.amount, "freeze stops movement completely (x0)");
});

test("haste buff: increases acceleration and braking multipliers", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");

  rock.applyBuff("haste", POWERUP_TYPES.haste.duration, POWERUP_TYPES.haste.amount);

  assert.equal(rock.getAccelMultiplier(), POWERUP_TYPES.haste.amount, "haste multiplier is correct");
});

test("turn buff: increases turn rate multiplier", () => {
  const { game } = setupEffectsContext();
  const rock = game.enemies.find(e => e.team === "rocks");

  rock.applyBuff("turn", POWERUP_TYPES.turn.duration, POWERUP_TYPES.turn.amount);

  assert.equal(rock.getTurnMultiplier(), POWERUP_TYPES.turn.amount, "turn multiplier is correct");
});

test("regeneration: heals over time without exceeding the max", () => {
  const { game } = setupEffectsContext();
  const regen = game.enemies.find(e => e.team !== "rocks" && !e.dead);
  assert.ok(regen, "there must be a living enemy to test regeneration");
  const bystander = game.enemies.find(e => e.team === "rocks");

  game.enemies = [regen, bystander];
  bystander.applyBuff("freeze", POWERUP_TYPES.freeze.duration, POWERUP_TYPES.freeze.amount);
  const highLifeToPreventDeath = 1e9;
  bystander.life = highLifeToPreventDeath;

  regen.applyBuff("regeneration", POWERUP_TYPES.regeneration.duration, POWERUP_TYPES.regeneration.amount);
  const halfLife = regen.maxLife / 2;
  regen.life = halfLife;
  const initialLifeBeforeRegen = regen.life;

  const updateFrames = 20;
  for (let i = 0; i < updateFrames; i++) {
    game.entityManager.update(TICK_MS);
  }

  assert.ok(regen.life > initialLifeBeforeRegen, `regeneration must heal (${initialLifeBeforeRegen} -> ${regen.life})`);
  assert.ok(regen.life <= regen.maxLife, "regeneration does not exceed the max");
});

test("confusion: disorients without fleeing and keeps the aim in the canvas", () => {
  const { game } = setupEffectsContext();
  const confused = game.enemies.find(e => e.team !== "rocks" && !e.dead);
  assert.ok(confused, "there must be a living enemy to test confusion");

  confused.applyBuff("confusion", POWERUP_TYPES.confusion.duration, POWERUP_TYPES.confusion.amount);

  game.entityManager.update(TICK_MS);

  assert.ok(confused.isBuffActive("confusion"));
  assert.equal(confused.fleeing, false, "confused must not flee");
  const canvasWidth = game.canvasAdapter.getWidth();
  const canvasHeight = game.canvasAdapter.getHeight();
  assert.ok(confused.aimX >= 0 && confused.aimX <= canvasWidth, "confused aimX inside the canvas");
  assert.ok(confused.aimY >= 0 && confused.aimY <= canvasHeight, "confused aimY inside the canvas");
});

test("gold: minimum 5 and maximum 25 credits based on Math.random", () => {
  const { game } = setupEffectsContext();
  let goldGot = null;
  game.progressManager.awardCredits = v => {
    goldGot = v;
  };

  try {
    Random.setMock(() => 0);
    const gold = new PowerUpBuilder()
      .withGame(game)
      .withType("gold")
      .build();
    gold.applyToTeam("rocks");
    assert.equal(goldGot, MIN_GOLD_CREDITS, `gold minimum (got ${goldGot})`);

    Random.setMock(() => 0.9999);
    const gold2 = new PowerUpBuilder()
      .withGame(game)
      .withType("gold")
      .build();
    goldGot = null;
    gold2.applyToTeam("rocks");
    assert.equal(goldGot, MAX_GOLD_CREDITS, `gold maximum (got ${goldGot})`);
  } finally {
    Random.restore();
  }
});

test("gold: a team other than the player's gets no credits", () => {
  const { game } = setupEffectsContext();
  game.progressManager.selectTeam("rocks");
  let goldGot = null;
  game.progressManager.awardCredits = v => {
    goldGot = v;
  };

  const gold = new PowerUpBuilder()
    .withGame(game)
    .withType("gold")
    .build();

  gold.applyToTeam("scissors");

  assert.equal(goldGot, null, "gold picked up by another team must not award credits to the player");
});

test("vampire: heals when dealing damage", () => {
  const { game } = setupEffectsContext();
  const attacker = game.enemies.find(e => e.team === "rocks");
  const prey = game.enemies.find(e => e.team === "scissors");

  game.enemies = [attacker, prey];
  const combatPositionX = 200;
  const combatPositionY = 200;
  attacker.x = combatPositionX;
  attacker.y = combatPositionY;
  prey.x = combatPositionX;
  prey.y = combatPositionY;
  prey.applyBuff("freeze", POWERUP_TYPES.freeze.duration, POWERUP_TYPES.freeze.amount);
  const highLifeToPreventDeath = 1e9;
  prey.life = highLifeToPreventDeath;

  attacker.applyBuff("vampire", POWERUP_TYPES.vampire.duration, POWERUP_TYPES.vampire.amount);
  const halfLife = attacker.maxLife * 0.5;
  attacker.life = halfLife;
  const initialLifeBeforeVampire = attacker.life;

  const updateFrames = 40;
  for (let i = 0; i < updateFrames; i++) {
    game.entityManager.update(TICK_MS);
  }

  assert.ok(attacker.life > initialLifeBeforeVampire, `vampire must heal (${initialLifeBeforeVampire} -> ${attacker.life})`);
});
