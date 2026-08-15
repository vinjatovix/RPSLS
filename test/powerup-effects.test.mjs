/**
 * powerup-effects.test.mjs - Verifies the power-up effects:
 * heal to full, zap to half, armor nullifies, damage x2, speed x2,
 * turn x2, slow x0.6, freeze stops, haste x2 accel, regen heals,
 * vampire heals on attack, confusion disorients, gold 5-25 credits
 * and the configured durations.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { PowerUp } from "../src/entities/PowerUp.js";
import { POWERUP_TYPES } from "../src/config/gameConfig.js";

function makeGame() {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.progressManager.awardCredits = () => {};
  game.match = 0;
  game.onTeamChanged();
  game.powerupTimer = Infinity;
  return game;
}

test("Config: POWERUP_TYPES includes the expected types and durations", () => {
  const config = POWERUP_TYPES;
  ["haste", "gold", "freeze", "vampire", "confusion", "regeneration"].forEach(key =>
    assert.ok(config[key], `POWERUP_TYPES must include ${key}`)
  );
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
  const game = makeGame();
  const rock = game.enemies.find(e => e.team === "rocks");
  const heal = new PowerUp({ game });
  heal.type = "heal";
  rock.life = rock.maxLife / 2;
  heal.applyToTeam("rocks");
  assert.equal(rock.life, rock.maxLife, `left at ${rock.life}/${rock.maxLife}`);
  game.destroy();
});

test("zap: reduces the CURRENT life to half (base, not total)", () => {
  const game = makeGame();
  const rock = game.enemies.find(e => e.team === "rocks");
  const zap = new PowerUp({ game });
  zap.type = "zap";
  rock.life = 200;
  const zBefore = rock.life;
  zap.applyToTeam("rocks");
  assert.equal(rock.life, Math.max(1, Math.floor(zBefore * 0.5)), `${zBefore} -> ${rock.life}`);
  assert.notEqual(rock.life, Math.floor(rock.maxLife * 0.5), "must not use the total as base");
  assert.ok(!rock.dead, "zap no longer kills");
  game.destroy();
});

test("multiplicative buffers: armor/damage/speed/slow/freeze/haste/turn", () => {
  const game = makeGame();
  const rock = game.enemies.find(e => e.team === "rocks");

  rock.applyBuff("armor", 10000, 0);
  assert.equal(rock.getIncomingDamageMultiplier(), 0, "armor nullifies damage (x0)");

  rock.applyBuff("damage", 15000, 2);
  assert.equal(rock.getDamage(), rock.baseDamage * rock.damageMultiplier * 2, "damage x2 multiplicative");

  rock.applyBuff("speed", 15000, 2);
  assert.equal(rock.getSpeedMultiplier(), 2, "speed x2");
  rock.applyBuff("slow", 15000, 0.6);
  assert.equal(rock.getSpeedMultiplier(), 1.2, "speed+slow = 2*0.6");
  rock.applyBuff("freeze", 5000, 0);
  assert.equal(rock.getSpeedMultiplier(), 0, "freeze stops (x0)");

  rock.applyBuff("haste", 15000, 2);
  assert.equal(rock.getAccelMultiplier(), 2, "haste x2 acceleration/braking");

  rock.applyBuff("turn", 15000, 2);
  assert.equal(rock.getTurnMultiplier(), 2, "turn x2");

  game.destroy();
});

test("regeneration: heals over time without exceeding the max", () => {
  const game = makeGame();
  const regen = game.enemies.find(e => e.team !== "rocks" && !e.dead);
  assert.ok(regen, "there must be a living enemy to test regeneration");
  const bystander = game.enemies.find(e => e.team === "rocks");
  game.enemies = [regen, bystander];
  bystander.applyBuff("freeze", 100000, 0);
  bystander.life = 1e9;
  regen.applyBuff("regeneration", 100000, 40);
  regen.life = regen.maxLife / 2;
  const rBefore = regen.life;
  for (let i = 0; i < 20; i++) game.update(16);
  assert.ok(regen.life > rBefore, `regeneration must heal (${rBefore} -> ${regen.life})`);
  assert.ok(regen.life <= regen.maxLife, "regeneration does not exceed the max");
  game.destroy();
});

test("confusion: disorients without fleeing and keeps the aim in the canvas", () => {
  const game = makeGame();
  const confused = game.enemies.find(e => e.team !== "rocks" && !e.dead);
  assert.ok(confused, "there must be a living enemy to test confusion");
  confused.applyBuff("confusion", 100000, 0);
  game.update(16);
  assert.ok(confused.isBuffActive("confusion"));
  assert.equal(confused.fleeing, false, "confused must not flee");
  const w = game.canvasAdapter.getWidth();
  const h = game.canvasAdapter.getHeight();
  assert.ok(confused.aimX >= 0 && confused.aimX <= w, "confused aimX inside the canvas");
  assert.ok(confused.aimY >= 0 && confused.aimY <= h, "confused aimY inside the canvas");
  game.destroy();
});

test("gold: minimum 5 and maximum 25 credits based on Math.random", () => {
  const game = makeGame();
  const realRandom = Math.random;
  try {
    let goldGot = null;
    game.progressManager.awardCredits = v => {
      goldGot = v;
    };

    Math.random = () => 0;
    const gold = new PowerUp({ game });
    gold.type = "gold";
    gold.applyToTeam("rocks");
    assert.equal(goldGot, 5, `gold minimum (got ${goldGot})`);

    Math.random = () => 0.9999;
    const gold2 = new PowerUp({ game });
    gold2.type = "gold";
    goldGot = null;
    gold2.applyToTeam("rocks");
    assert.equal(goldGot, 25, `gold maximum (got ${goldGot})`);
  } finally {
    Math.random = realRandom;
  }
  game.destroy();
});

test("gold: a team other than the player's gets no credits", () => {
  const game = makeGame();
  game.progressManager.selectTeam("rocks");
  let goldGot = null;
  game.progressManager.awardCredits = v => {
    goldGot = v;
  };

  const gold = new PowerUp({ game });
  gold.type = "gold";
  gold.applyToTeam("scissors");
  assert.equal(goldGot, null, "gold picked up by another team must not award credits to the player");
  game.destroy();
});

test("vampire: heals when dealing damage", () => {
  const game = makeGame();
  const attacker = game.enemies.find(e => e.team === "rocks");
  const prey = game.enemies.find(e => e.team === "scissors");
  game.enemies = [attacker, prey];
  attacker.x = 200;
  attacker.y = 200;
  prey.x = 200;
  prey.y = 200;
  prey.applyBuff("freeze", 100000, 0);
  prey.life = 1e9;
  attacker.applyBuff("vampire", 100000, 0.5);
  attacker.life = attacker.maxLife * 0.5;
  const vBefore = attacker.life;
  for (let i = 0; i < 40; i++) game.update(16);
  assert.ok(attacker.life > vBefore, `vampire must heal (${vBefore} -> ${attacker.life})`);
  game.destroy();
});
