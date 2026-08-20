import assert from "node:assert/strict";
import { test } from "node:test";

import { GAME_CONFIG, RACE_STATS } from "../../src/config/gameConfig.js";
import { deepFreeze, clone } from "../../src/core/index.js";
import { Game } from "../../src/index.js";
import { createFakeAdapters } from "../doubles/FakeAdapters.mjs";

test("deepFreeze freezes deeply", () => {
  const config = { a: { b: { c: 1 } }, arr: [1, 2] };
  deepFreeze(config);
  assert.ok(Object.isFrozen(config), "level 1 frozen");
  assert.ok(Object.isFrozen(config.a), "level 2 frozen");
  assert.ok(Object.isFrozen(config.a.b), "level 3 frozen");
  assert.ok(Object.isFrozen(config.arr), "arrays frozen");
  assert.throws(() => {
    config.a.b.c = 2;
  }, "writing to a frozen node throws in strict mode");
});

test("deepFreeze works even if the root object is already shallow-frozen", () => {
  const config = Object.freeze({ team: { damage: { amount: 10 } } });
  deepFreeze(config);
  assert.ok(Object.isFrozen(config.team), "child frozen despite frozen root");
  assert.ok(Object.isFrozen(config.team.damage), "grandchild frozen");
  assert.throws(() => {
    config.team.damage.amount = 999;
  });
});

test("deepFreeze tolerates cycles", () => {
  const a = {};
  const b = { a };
  a.b = b;
  deepFreeze(a);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(b));
});

test("real configs are frozen deeply by default in Node", () => {
  assert.ok(Object.isFrozen(RACE_STATS), "RACE_STATS is frozen at root");
  assert.ok(Object.isFrozen(RACE_STATS.rocks), "RACE_STATS nested items are frozen");
  assert.ok(Object.isFrozen(RACE_STATS.rocks.damage), "RACE_STATS deeply nested items are frozen");
  assert.throws(() => {
    RACE_STATS.rocks.damage.amount = 999;
  }, TypeError, "mutations to RACE_STATS should throw a TypeError");

  assert.ok(Object.isFrozen(GAME_CONFIG), "GAME_CONFIG is frozen at root");
  assert.ok(Object.isFrozen(GAME_CONFIG.meta), "GAME_CONFIG nested items are frozen");
  assert.throws(() => {
    GAME_CONFIG.meta.enemiesPerLevel = 999;
  }, TypeError, "mutations to GAME_CONFIG should throw a TypeError");
});

test("Game successfully runs using custom injected configurations", () => {
  const customConfig = clone(GAME_CONFIG);
  customConfig.meta.enemiesPerLevel = 5;

  const customRaceStats = clone(RACE_STATS);
  customRaceStats.rocks.health.max = 1234;

  const game = new Game({
    config: customConfig,
    raceStats: customRaceStats,
    team: "rocks",
    adapters: createFakeAdapters()
  });

  try {
    assert.equal(game.config.meta.enemiesPerLevel, 5, "Injected config is used");
    assert.equal(game.raceStats.rocks.health.max, 1234, "Injected race stats are used");

    game.clock.reset();
    game.run();

    game.entityManager.spawnMatch(1);
    const enemy = game.entityManager.enemies[0];
    assert.equal(enemy.maxLife, 1234, "Enemy uses the custom max health from injected race stats");
  } finally {
    game.destroy();
  }
});
