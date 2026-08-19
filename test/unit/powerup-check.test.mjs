import assert from "node:assert/strict";
import { test } from "node:test";

import { POWERUP_TYPES } from "../../src/config/gameConfig.js";
import { PowerUpBuilder } from "../builders/PowerUpBuilder.mjs";
import { setupSimulationContext, TICK_MS } from "../doubles/setupSimulationContext.mjs";
import { EnemyMother } from "../mothers/EnemyMother.mjs";

test("power-ups: move without dying when updated", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const p = new PowerUpBuilder()
    .withGame(game)
    .withPosition(100, 100)
    .withVelocity(2, 1)
    .build();
  game.powerups = [p];
  const startX = p.x;
  const startY = p.y;

  for (let i = 0; i < 30; i++) {
    p.update(TICK_MS);
  }

  assert.ok(p.x !== startX || p.y !== startY, `power-up must move (${startX},${startY}) -> (${p.x},${p.y})`);
  assert.ok(!p.dead, "power-up must not die from movement");
});

test("power-ups: expires when lifetime is exceeded", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const p = new PowerUpBuilder()
    .withGame(game)
    .build();
  game.matchManager.gameTime = p.bornAt + p.lifetime + 1;

  p.update(TICK_MS);

  assert.ok(p.dead, "power-up must be dead after lifetime is exceeded");
});

test("power-ups: bounces off left wall", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const p = new PowerUpBuilder()
    .withGame(game)
    .withPosition(29, 100)
    .withVelocity(-2, 0)
    .build();

  p.update(30);

  assert.equal(p.x, 30, "coordinate must be clamped to margin");
  assert.ok(p.velocityX > 0, "velocity must be inverted to positive");
});

test("power-ups: bounces off right wall", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const p = new PowerUpBuilder()
    .withGame(game)
    .withPosition(547, 100)
    .withVelocity(2, 0)
    .build();

  p.update(30);

  assert.equal(p.x, 548, "coordinate must be clamped to dimension - width - margin");
  assert.ok(p.velocityX < 0, "velocity must be inverted to negative");
});

test("power-ups: bounces off top wall", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const p = new PowerUpBuilder()
    .withGame(game)
    .withPosition(100, 29)
    .withVelocity(0, -2)
    .build();

  p.update(30);

  assert.equal(p.y, 30, "coordinate must be clamped to margin");
  assert.ok(p.velocityY > 0, "velocity must be inverted to positive");
});

test("power-ups: bounces off bottom wall", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const p = new PowerUpBuilder()
    .withGame(game)
    .withPosition(100, 347)
    .withVelocity(0, 2)
    .build();

  p.update(30);

  assert.equal(p.y, 348, "coordinate must be clamped to dimension - height - margin");
  assert.ok(p.velocityY < 0, "velocity must be inverted to negative");
});

test("power-ups: heal type heals the team and is consumed", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const rocks = EnemyMother.rock(game);
  game.enemies = [rocks];
  const heal = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .withPosition(300, 200)
    .build();
  rocks.life = rocks.maxLife / 2;
  const before = rocks.life;

  heal.applyToTeam("rocks");

  assert.ok(heal.dead, "applyToTeam must consume the power-up");
  assert.ok(rocks.life > before, `heal must heal the team (${before} -> ${rocks.life})`);
});

test("power-ups: zap type damages the team and is consumed", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const rocks = EnemyMother.rock(game);
  game.enemies = [rocks];
  const zap = new PowerUpBuilder()
    .withGame(game)
    .withType("zap")
    .withPosition(300, 200)
    .build();
  const before = rocks.life;

  zap.applyToTeam("rocks");

  assert.ok(zap.dead, "applyToTeam must consume the power-up");
  assert.ok(rocks.life < before, `zap must damage the team (${before} -> ${rocks.life})`);
});

test("power-ups: applyTo delegates to applyToTeam", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const rocks = EnemyMother.rock(game);
  game.enemies = [rocks];
  const heal = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .build();
  rocks.life = rocks.maxLife / 2;

  heal.applyTo(rocks);

  assert.ok(heal.dead, "power-up must be consumed");
  assert.equal(rocks.life, rocks.maxLife, "team must be healed");
});

test("power-ups: applyToOthers applies effect to other teams but not specified team", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const rocks = EnemyMother.rock(game);
  const papers = EnemyMother.paper(game);
  const scissors = EnemyMother.scissors(game);
  game.enemies = [rocks, papers, scissors];
  rocks.life = 100;
  papers.life = 100;
  scissors.life = 100;
  const zap = new PowerUpBuilder()
    .withGame(game)
    .withType("zap")
    .build();

  zap.applyToOthers("rocks");

  assert.equal(rocks.life, 100, "rocks (specified team) must not be affected");
  assert.ok(papers.life < 100, "papers (other team) must be affected by zap");
  assert.ok(scissors.life < 100, "scissors (other team) must be affected by zap");
  assert.ok(zap.dead, "power-up must be consumed");
});

test("power-ups: applyForClick applies positive effects to team", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const rocks = EnemyMother.rock(game);
  const papers = EnemyMother.paper(game);
  game.enemies = [rocks, papers];
  rocks.life = rocks.maxLife / 2;
  papers.life = papers.maxLife / 2;
  const heal = new PowerUpBuilder()
    .withGame(game)
    .withType("heal")
    .build();

  heal.applyForClick("rocks");

  assert.equal(rocks.life, rocks.maxLife, "positive power-up must heal own team");
  assert.equal(papers.life, papers.maxLife / 2, "positive power-up must not heal other team");
  assert.ok(heal.dead, "power-up must be consumed");
});

test("power-ups: applyForClick applies traps to other teams", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  const rocks = EnemyMother.rock(game);
  const papers = EnemyMother.paper(game);
  game.enemies = [rocks, papers];
  rocks.life = 100;
  papers.life = 100;
  const zap = new PowerUpBuilder()
    .withGame(game)
    .withType("zap")
    .build();

  zap.applyForClick("rocks");

  assert.equal(rocks.life, 100, "trap power-up must not harm own team");
  assert.ok(papers.life < 100, "trap power-up must harm other teams");
  assert.ok(zap.dead, "power-up must be consumed");
});

test("power-ups: buff duration is multiplied for selected team", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  progressManager.getPowerupDurationMultiplier = () => 1.5;
  const rocks = EnemyMother.rock(game);
  game.enemies = [rocks];
  const speed = new PowerUpBuilder()
    .withGame(game)
    .withType("speed")
    .build();
  const expectedDuration = POWERUP_TYPES.speed.duration * 1.5;

  speed.applyToTeam("rocks");

  assert.ok(speed.dead, "power-up must be consumed");
  assert.ok(rocks.isBuffActive("speed"), "speed buff must be active");
  const until = rocks.buffManager.buffs.speed.until;
  const calculatedDuration = until - game.matchManager.gameTime;
  assert.equal(calculatedDuration, expectedDuration, `duration must be multiplied by 1.5 (expected ${expectedDuration}, got ${calculatedDuration})`);
});

test("power-ups: buff duration is NOT multiplied for non-selected team", () => {
  const { game, progressManager } = setupSimulationContext("rocks");
  progressManager.awardCredits = () => {};
  progressManager.getPowerupDurationMultiplier = () => 1.5;
  const papers = EnemyMother.paper(game);
  game.enemies = [papers];
  const speed = new PowerUpBuilder()
    .withGame(game)
    .withType("speed")
    .build();
  const expectedDuration = POWERUP_TYPES.speed.duration;

  speed.applyToTeam("papers");

  assert.ok(speed.dead, "power-up must be consumed");
  assert.ok(papers.isBuffActive("speed"), "speed buff must be active");
  const until = papers.buffManager.buffs.speed.until;
  const calculatedDuration = until - game.matchManager.gameTime;
  assert.equal(calculatedDuration, expectedDuration, `duration must be exactly the base config duration (expected ${expectedDuration}, got ${calculatedDuration})`);
});
