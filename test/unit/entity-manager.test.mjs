import { test } from "node:test";
import assert from "node:assert/strict";

import { EntityManager } from "../../src/entities/index.js";
import { setupSimulationContext, TICK_MS } from "../doubles/setupSimulationContext.mjs";

test("EntityManager: initial state has correct structure", () => {
  const context = setupSimulationContext();

  const { manager } = context;

  assert.ok(manager instanceof EntityManager);
  assert.ok(Array.isArray(manager.enemies));
  assert.ok(Array.isArray(manager.powerups));
});

test("EntityManager: spawnMatch creates correct number of enemies", () => {
  const { manager } = setupSimulationContext();

  manager.spawnMatch(2);

  const expectedEnemyCount = 10;
  const expectedPowerupCount = 0;
  assert.equal(manager.enemies.length, expectedEnemyCount);
  assert.equal(manager.powerups.length, expectedPowerupCount);
});

test("EntityManager: update prunes dead enemies", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const initialEnemyCount = manager.enemies.length;
  const firstEnemy = manager.enemies[0];
  firstEnemy.dead = true;

  manager.update(TICK_MS);

  const expectedEnemyCountAfterPrune = initialEnemyCount - 1;
  assert.ok(initialEnemyCount > 0);
  assert.equal(manager.enemies.length, expectedEnemyCountAfterPrune);
});

test("EntityManager: update prunes dead powerups", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const mockPowerup = {
    x: 100,
    y: 100,
    width: 22,
    height: 22,
    dead: false,
    update: () => {},
    draw: () => {}
  };
  manager.powerups.push(mockPowerup);
  const initialPowerupCount = manager.powerups.length;
  mockPowerup.dead = true;

  manager.update(TICK_MS);

  const expectedPowerupCountAfterPrune = 0;
  assert.equal(initialPowerupCount, 1);
  assert.equal(manager.powerups.length, expectedPowerupCountAfterPrune);
});

test("EntityManager: integration with game loop update", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const initialPositions = manager.enemies.map(e => ({ x: e.x, y: e.y }));

  manager.update(TICK_MS * 2);

  const currentPositions = manager.enemies.map(e => ({ x: e.x, y: e.y }));
  const anyMoved = initialPositions.some((pos, i) => pos.x !== currentPositions[i].x || pos.y !== currentPositions[i].y);
  assert.ok(anyMoved);
});

test("EntityManager: activeTeams tracking state-synchronization", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const initialActiveTeamsCount = game.activeTeams.size;
  const initialHasRocks = game.activeTeams.has("rocks");
  const initialHasPapers = game.activeTeams.has("papers");
  manager.enemies.forEach(enemy => {
    if (enemy.team === "papers") {
      enemy.dead = true;
    }
  });

  manager.update(TICK_MS);

  const expectedActiveTeamsCountAfterPapersEliminated = 4;
  assert.equal(initialActiveTeamsCount, 5);
  assert.ok(initialHasRocks);
  assert.ok(initialHasPapers);
  assert.equal(game.activeTeams.size, expectedActiveTeamsCountAfterPapersEliminated);
  assert.ok(!game.activeTeams.has("papers"));
});

test("EntityManager: captures and converts defeated enemies when capture mechanic is enabled", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);
  game.options.mechanics.capture = true;
  const initialEnemyCount = manager.enemies.length;
  const victim = manager.enemies[0];
  victim.dead = true;
  victim.killedBy = game.progressManager.selectedTeam;

  manager.update(TICK_MS);

  const playerTeamCount = manager.enemies.filter(e => e.team === game.progressManager.selectedTeam).length;
  assert.equal(manager.enemies.length, initialEnemyCount);
  assert.ok(playerTeamCount > 0);
});

test("EntityManager: does not capture defeated enemies when capture mechanic is disabled", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);
  game.options.mechanics.capture = false;
  const initialEnemyCount = manager.enemies.length;
  const victim = manager.enemies[0];
  victim.dead = true;
  victim.killedBy = game.progressManager.selectedTeam;

  manager.update(TICK_MS);

  assert.equal(manager.enemies.length, initialEnemyCount - 1);
});

test("EntityManager: spawns powerups over time based on luck modifiers and respects concurrent limit", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  manager.powerups = [];
  const initialTimer = manager.powerupTimer;

  manager.update(initialTimer + 1);

  assert.equal(manager.powerups.length, 1);
  assert.ok(manager.powerupTimer > 0);
});

test("EntityManager: applying powerup to overlapping enemy", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const enemy = manager.enemies[0];
  enemy.dead = false;
  let appliedToEnemy = null;
  const mockPowerup = {
    x: enemy.x,
    y: enemy.y,
    width: enemy.width,
    height: enemy.height,
    dead: false,
    update() {},
    applyTo(target) {
      appliedToEnemy = target;
      this.dead = true;
    }
  };
  manager.powerups.push(mockPowerup);

  manager.update(TICK_MS);

  assert.equal(appliedToEnemy, enemy);
  assert.equal(manager.powerups.length, 0);
});
