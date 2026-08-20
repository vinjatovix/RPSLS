import assert from "node:assert/strict";
import { test } from "node:test";

import { POWERUP_TYPES } from "../../src/config/gameConfig.js";
import { PowerUpBuilder } from "../builders/PowerUpBuilder.mjs";
import { setupSimulationContext } from "../doubles/setupSimulationContext.mjs";
import { EnemyMother } from "../mothers/EnemyMother.mjs";

function createTestContext(selectedTeam = "rocks") {
  const { game, progressManager } = setupSimulationContext(selectedTeam);

  let goldAwarded = null;
  progressManager.awardCredits = (credits) => {
    goldAwarded = credits;
  };

  game.enemies = [
    EnemyMother.rock(game),
    EnemyMother.paper(game),
    EnemyMother.scissors(game)
  ];

  const rect = { width: game.width, height: game.height, left: 0, top: 0 };
  const canvasWidth = game.width;
  const canvasHeight = game.height;

  const clickPowerUp = (powerup) => {
    const clientX = (powerup.x + powerup.width / 2) * (rect.width / canvasWidth) + rect.left;
    const clientY = (powerup.y + powerup.height / 2) * (rect.height / canvasHeight) + rect.top;

    game.listeners.pointerdown[0]({ clientX, clientY });
  };

  return {
    game,
    progressManager,
    goldAwarded: () => goldAwarded,
    resetGoldAwarded: () => {
      goldAwarded = null;
    },
    clickPowerUp
  };
}

test("Pointer event registration: canvas must have a pointerdown listener", () => {
  const { game } = createTestContext();

  assert.ok(
    game.listeners.pointerdown && game.listeners.pointerdown.length > 0,
    "there must be a pointerdown listener on the canvas"
  );
});

test("Power-up click: consumes the power-up and provides floating visual feedback", () => {
  const { game, clickPowerUp } = createTestContext();
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .build();
  game.powerups = [powerUp];

  clickPowerUp(powerUp);

  assert.ok(powerUp.dead, "the power-up must be consumed (dead = true) after clicking");
  assert.ok(
    game.particles.particles.some(particle => particle.text === POWERUP_TYPES.heal.label),
    "clicking must display floating text with the power-up label"
  );
});

test("Power-up click: clicking far away from a power-up must not collect it", () => {
  const { game } = createTestContext();
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withPosition(600, 340)
    .build();
  game.powerups = [powerUp];
  const canvas = game.canvasAdapter.getCanvas();
  const rect = canvas.getBoundingClientRect();
  const farX = 100 * (rect.width / game.width) + rect.left;
  const farY = 100 * (rect.height / game.height) + rect.top;

  game.listeners.pointerdown[0]({ clientX: farX, clientY: farY });

  assert.ok(!powerUp.dead, "power-up must remain active when clicked far away");
});

test("Positive buff power-ups: apply buffs to clicking team but ignore other teams", () => {
  const positiveBuffKeys = Object.entries(POWERUP_TYPES)
    .filter(([_, config]) => !config.trap && config.duration > 0)
    .map(([key]) => key);
  for (const key of positiveBuffKeys) {
    const { game, clickPowerUp } = createTestContext("rocks");
    const powerUp = new PowerUpBuilder()
      .withGame(game)
      .withType(key)
      .build();
    game.powerups = [powerUp];
    game.enemies.forEach(e => {
      e.buffs = {};
    });

    clickPowerUp(powerUp);

    const rocks = game.enemies.filter(e => e.team === "rocks");
    const others = game.enemies.filter(e => e.team !== "rocks");
    assert.ok(
      rocks.some(r => r.isBuffActive(key)),
      `${key} must apply a buff to clicking team (rocks)`
    );
    assert.ok(
      others.every(o => !o.isBuffActive(key)),
      `${key} must not apply a buff to other teams`
    );
  }
});

test("Trap power-ups: apply debuffs to opposing teams but spare clicking team", () => {
  const trapKeys = Object.entries(POWERUP_TYPES)
    .filter(([_, config]) => config.trap && config.duration > 0)
    .map(([key]) => key);
  for (const key of trapKeys) {
    const { game, clickPowerUp } = createTestContext("rocks");
    const powerUp = new PowerUpBuilder()
      .withGame(game)
      .withType(key)
      .build();
    game.powerups = [powerUp];
    game.enemies.forEach(e => {
      e.buffs = {};
    });

    clickPowerUp(powerUp);

    const rocks = game.enemies.filter(e => e.team === "rocks");
    const others = game.enemies.filter(e => e.team !== "rocks");
    assert.ok(
      rocks.every(r => !r.isBuffActive(key)),
      `trap ${key} must not affect clicking team (rocks)`
    );
    assert.ok(
      others.some(o => o.isBuffActive(key)),
      `trap ${key} must affect other teams`
    );
  }
});

test("Zap trap: reduces life of opposing teams but spares clicking team", () => {
  const { game, clickPowerUp } = createTestContext("rocks");
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withType("zap")
    .build();
  game.powerups = [powerUp];
  const rocks = game.enemies.filter(e => e.team === "rocks");
  const others = game.enemies.filter(e => e.team !== "rocks");
  const rocksBefore = rocks.map(r => r.life);
  const othersBefore = others.map(o => o.life);

  clickPowerUp(powerUp);

  const rocksAfter = rocks.map(r => r.life);
  const othersAfter = others.map(o => o.life);
  assert.deepEqual(rocksAfter, rocksBefore, "Zap must not reduce life of clicking team");
  assert.ok(
    othersAfter.some((life, i) => life < othersBefore[i]),
    "Zap must reduce life of opposing teams"
  );
});

test("Heal power-up: fully restores health of clicking team but ignores others", () => {
  const { game, clickPowerUp } = createTestContext("rocks");
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .build();
  game.powerups = [powerUp];
  const rocks = game.enemies.filter(e => e.team === "rocks");
  const others = game.enemies.filter(e => e.team !== "rocks");
  rocks.forEach(r => {
    r.life = Math.floor(r.maxLife / 2);
  });
  others.forEach(o => {
    o.life = Math.floor(o.maxLife / 2);
  });
  const othersBefore = others.map(o => o.life);

  clickPowerUp(powerUp);

  assert.ok(
    rocks.every(r => r.life === r.maxLife),
    "Heal must restore clicking team members to full health"
  );
  const othersAfter = others.map(o => o.life);
  assert.deepEqual(othersAfter, othersBefore, "Heal must not affect health of opposing teams");
});

test("Time power-up: adds extra duration to the current match", () => {
  const { game, clickPowerUp } = createTestContext("rocks");
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withType("time")
    .build();
  game.powerups = [powerUp];
  const initialTimeLeft = game.matchManager.timeLeft;
  const config = POWERUP_TYPES.time;

  clickPowerUp(powerUp);

  assert.equal(
    game.matchManager.timeLeft,
    initialTimeLeft + config.amount,
    "Time power-up must increase current match's time left by configured amount"
  );
});

test("Gold power-up: awards credits between 5 and 25 to progress manager", () => {
  const { game, clickPowerUp, goldAwarded } = createTestContext("rocks");
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withType("gold")
    .build();
  game.powerups = [powerUp];

  clickPowerUp(powerUp);

  const awarded = goldAwarded();
  assert.ok(
    awarded !== null && awarded >= 5 && awarded <= 25,
    `Gold power-up must award between 5 and 25 credits, got ${awarded}`
  );
});

test("Power-up click: clicking when match is paused must not collect the power-up", () => {
  const { game, clickPowerUp } = createTestContext("rocks");
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .build();
  game.powerups = [powerUp];
  game.matchManager.paused = true;

  clickPowerUp(powerUp);

  assert.ok(!powerUp.dead, "paused match must ignore clicks and not consume power-ups");
});

test("Power-up click: clicking when no team is chosen must not collect the power-up", () => {
  const { game, clickPowerUp, progressManager } = createTestContext("rocks");
  const powerUp = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .build();
  game.powerups = [powerUp];
  progressManager.isTeamChosen = () => false;

  clickPowerUp(powerUp);

  assert.ok(!powerUp.dead, "unselected team state must ignore clicks and not consume power-ups");
});
