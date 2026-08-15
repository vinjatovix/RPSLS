/**
 * training-stats.test.mjs - Verifies the added training stats:
 *   - UPGRADES includes regeneration/armor/vampire/deceleration (per race) and
 *     powerupDuration/powerupLimit/collectRadius (global)
 *   - buyUpgrade/getRaceModifiers of the new stats
 *   - Enemy: regeneration heals per second, armor reduces damage, vampire heals
 *     on damage, deceleration increases braking (acceleration no longer changes it)
 *   - Power-up spawn: base interval 4500ms
 *   - Credits: 2 per kill by the player's team
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { UPGRADES } from "../src/config/gameConfig.js";
import { Enemy } from "../src/entities/Enemy.js";

function makeGame() {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.match = 0;
  game.onTeamChanged();
  game.powerupTimer = Infinity;
  return game;
}

test("Config: new UPGRADES are per-race or global", () => {
  assert.equal(UPGRADES.regeneration?.perRace, true);
  assert.equal(UPGRADES.armor?.perRace, true);
  assert.equal(UPGRADES.vampire?.perRace, true);
  assert.equal(UPGRADES.deceleration?.perRace, true);
  assert.equal(UPGRADES.powerupDuration?.perRace, false);
  assert.equal(UPGRADES.powerupLimit?.perRace, false);
  assert.equal(UPGRADES.collectRadius?.perRace, false);
});

test("Buy + per-race modifiers", () => {
  const game = makeGame();
  game.progressManager.awardCredits(500);
  assert.ok(game.progressManager.buyUpgrade("regeneration", "rocks"), "can buy regeneration");
  assert.ok(game.progressManager.buyUpgrade("armor", "rocks"), "can buy armor");
  assert.ok(game.progressManager.buyUpgrade("vampire", "rocks"), "can buy vampire");
  assert.ok(game.progressManager.buyUpgrade("deceleration", "rocks"), "can buy deceleration");
  const mods = game.progressManager.getRaceModifiers("rocks");
  assert.equal(mods.regeneration, 4, `regeneration Lv.1 = +4 health/s (got ${mods.regeneration})`);
  assert.equal(mods.armor, 0.08, `armor Lv.1 = -8% damage (got ${mods.armor})`);
  assert.equal(mods.vampire, 0.05, `vampire Lv.1 = +5% heal (got ${mods.vampire})`);
  assert.equal(mods.deceleration, 1.1, `deceleration Lv.1 = +10% braking (got ${mods.deceleration})`);
  game.destroy();
});

test("Global upgrades: duration/limit/collectRadius", () => {
  const game = makeGame();
  game.progressManager.awardCredits(500);
  assert.ok(game.progressManager.buyUpgrade("powerupDuration"), "can buy powerupDuration");
  assert.equal(game.progressManager.getPowerupDurationMultiplier(), 1.1, "powerupDuration Lv.1 = ×1.1");
  assert.ok(game.progressManager.buyUpgrade("powerupLimit"), "can buy powerupLimit");
  assert.equal(game.progressManager.getPowerupLimitBonus(), 2, "powerupLimit Lv.1 = +2 cap");
  assert.ok(game.progressManager.buyUpgrade("collectRadius"), "can buy collectRadius");
  assert.equal(game.progressManager.getCollectRadiusMultiplier(), 1.15, "collectRadius Lv.1 = ×1.15");
  game.destroy();
});

test("Enemy: base regeneration heals over time", () => {
  const game = makeGame();
  const regenEnemy = new Enemy({ game: game, x: 100, y: 100, modifiers: { regeneration: 4 } }, "rocks");
  regenEnemy.life = regenEnemy.maxLife / 2;
  const rBefore = regenEnemy.life;
  regenEnemy.update(1000, []);
  assert.ok(regenEnemy.life > rBefore, `base regeneration must heal (${rBefore} -> ${regenEnemy.life})`);
  assert.ok(regenEnemy.life <= regenEnemy.maxLife, "base regeneration does not exceed the max");
  game.destroy();
});

test("Enemy: armor reduces damage and the buff nullifies", () => {
  const game = makeGame();
  const armored = new Enemy({ game: game, x: 100, y: 140, modifiers: { armor: 0.5 } }, "rocks");
  assert.equal(armored.getIncomingDamageMultiplier(), 0.5, `armor 0.5 halves damage`);
  const unarmored = new Enemy({ game: game, x: 100, y: 180 }, "rocks");
  assert.equal(unarmored.getIncomingDamageMultiplier(), 1, "without armor full damage comes in");
  unarmored.applyBuff("armor", 10000, 0);
  assert.equal(unarmored.getIncomingDamageMultiplier(), 0, "armor buff nullifies damage (x0)");
  game.destroy();
});

test("Enemy: deceleration separate from acceleration (both affect braking)", () => {
  const game = makeGame();
  const baseEnemy = new Enemy({ game: game, x: 100, y: 220 }, "rocks");
  const braked = new Enemy({ game: game, x: 100, y: 260, modifiers: { deceleration: 2 } }, "rocks");
  assert.equal(braked.deceleration, baseEnemy.deceleration * 2, `deceleration x2 doubles braking`);
  const accelOnly = new Enemy({ game: game, x: 100, y: 300, modifiers: { acceleration: 2 } }, "rocks");
  assert.equal(accelOnly.deceleration, baseEnemy.deceleration * 2, "acceleration still affects braking");
  assert.equal(accelOnly.acceleration, baseEnemy.acceleration * 2, "acceleration multiplies acceleration");
  const accelDecel = new Enemy({ game: game, x: 100, y: 340, modifiers: { acceleration: 2, deceleration: 2 } }, "rocks");
  assert.equal(accelDecel.deceleration, baseEnemy.deceleration * 4, "deceleration and acceleration accumulate in braking");
  game.destroy();
});

test("Enemy: vampire heals when dealing damage", () => {
  const game = makeGame();
  game.progressManager.awardCredits = () => {};
  const attacker = new Enemy({ game: game, x: 200, y: 200, modifiers: { vampire: 0.5 } }, "rocks");
  const prey = new Enemy({ game: game, x: 200, y: 200 }, "scissors");
  prey.applyBuff("freeze", 100000, 0);
  prey.life = 1e9;
  game.enemies = [attacker, prey];
  attacker.life = attacker.maxLife * 0.5;
  const vBefore = attacker.life;
  for (let i = 0; i < 40; i++) game.update(16);
  assert.ok(attacker.life > vBefore, `base vampire must heal (${vBefore} -> ${attacker.life})`);
  game.destroy();
});

test("Power-up spawn: base interval 4500ms + powerupLuck", () => {
  const sg = new Game({ startLevel: 0 });
  sg.progressManager.reset();
  sg.progressManager.selectTeam("rocks");
  assert.equal(sg.powerupTimer, 4500, `base power-up interval = 4500ms (got ${sg.powerupTimer})`);
  sg.progressManager.awardCredits(500);
  sg.progressManager.buyUpgrade("powerupLuck");
  assert.equal(sg.progressManager.getPowerupLuck(), 1.05, "powerupLuck shortens the interval (+5%)");
  sg.destroy();
});

test("Credits: 2 per kill by the player's team", () => {
  const pm = new Game({ startLevel: 0 }).progressManager;
  pm.reset();
  pm.selectTeam("rocks");
  pm.eventBus.emit("kill", { killerTeam: "rocks" });
  assert.equal(pm.credits, 2, `kill by the player's team gives 2 credits (got ${pm.credits})`);
  pm.eventBus.emit("kill", { killerTeam: "lizards" });
  assert.equal(pm.credits, 2, "kill by another team gives no credits");
});
