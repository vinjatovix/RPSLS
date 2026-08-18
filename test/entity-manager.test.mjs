import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { GAME_CONFIG } from "../src/config/gameConfig.js";
import { EntityManager } from "../src/entities/index.js";

test("EntityManager: initial state and spawnMatch", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  const manager = game.entityManager;

  assert.ok(manager instanceof EntityManager, "entityManager should be instantiated");
  assert.ok(Array.isArray(manager.getEnemies()), "enemies should be an array");
  assert.ok(Array.isArray(manager.getPowerups()), "powerups should be an array");

  // Reset to spawnMatch
  manager.spawnMatch(2);
  const enemies = manager.getEnemies();
  // 5 races * 2 count = 10 enemies
  assert.equal(enemies.length, 10, "Should spawn 10 enemies (5 races * group count 2)");
  assert.equal(manager.getPowerups().length, 0, "Powerups should be empty on spawnMatch");

  game.destroy();
});

test("EntityManager: updates and prunes dead entities", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  const manager = game.entityManager;

  manager.spawnMatch(1);
  const initialCount = manager.getEnemies().length;
  assert.ok(initialCount > 0, "Should have spawned enemies");

  // Force one enemy to be dead
  const enemies = manager.getEnemies();
  enemies[0].dead = true;

  // Run update to prune dead
  manager.update(16);

  assert.equal(manager.getEnemies().length, initialCount - 1, "Dead enemy should be pruned during update");

  // Test powerup pruning
  const mockPowerup = {
    x: 100,
    y: 100,
    width: 22,
    height: 22,
    dead: false,
    update: () => {},
    draw: () => {}
  };
  manager.getPowerups().push(mockPowerup);
  assert.equal(manager.getPowerups().length, 1, "Should have 1 powerup");

  // Mark powerup dead and update
  mockPowerup.dead = true;
  manager.update(16);
  assert.equal(manager.getPowerups().length, 0, "Dead powerup should be pruned during update");

  game.destroy();
});

test("EntityManager: integration with game loop update", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");

  const manager = game.entityManager;
  manager.spawnMatch(1);

  const initialPositions = manager.getEnemies().map(e => ({ x: e.x, y: e.y }));

  // Run game loop update
  game.update(32);

  const currentPositions = manager.getEnemies().map(e => ({ x: e.x, y: e.y }));

  // Assert that at least some enemies moved or their positions were updated via the game loop
  let anyMoved = false;
  for (let i = 0; i < initialPositions.length; i++) {
    if (initialPositions[i].x !== currentPositions[i].x || initialPositions[i].y !== currentPositions[i].y) {
      anyMoved = true;
      break;
    }
  }

  assert.ok(anyMoved, "Game loop update should successfully update entity positions through EntityManager");

  game.destroy();
});
