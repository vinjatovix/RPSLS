import { test } from "node:test";
import assert from "node:assert/strict";

import { GAME_CONFIG } from "../../src/config/gameConfig.js";
import { MatchManager } from "../../src/entities/index.js";
import { FakeGame } from "../doubles/FakeGame.mjs";
import { EnemyMother } from "../mothers/EnemyMother.mjs";

function setupMatchManager(startLevel = 0) {
  const game = new FakeGame();
  const manager = new MatchManager({
    game,
    eventBus: game.eventBus,
    options: game.options,
    startLevel
  });
  game.matchManager = manager;
  return { game, manager };
}

test("MatchManager: initializes with default values", () => {
  const { manager } = setupMatchManager();

  assert.equal(manager.match, 0);
  assert.equal(manager.timeLeft, GAME_CONFIG.meta.initialTimeLeftMs);
  assert.equal(manager.gameTime, 0);
  assert.equal(manager.paused, false);
  assert.equal(manager.timeSinceLastAction, 0);
});

test("MatchManager: updates timers and triggers countdown tick", () => {
  const { game, manager } = setupMatchManager();
  manager.match = 1;
  manager.timeLeft = 5000;
  manager.lastTickSecond = 5;
  manager.options.setMechanic("timeless", false);
  let tickEmitted = false;
  game.eventBus.subscribe("tick", () => {
    tickEmitted = true;
  });

  manager.update(1001, []);

  assert.equal(manager.gameTime, 1001);
  assert.equal(manager.timeLeft, 3999);
  assert.ok(tickEmitted, "Should emit tick event on second boundary transition");
});

test("MatchManager: remains timeless with 4+ active teams", () => {
  const { game, manager } = setupMatchManager();
  manager.match = 1;
  manager.timeLeft = 5000;
  manager.options.setMechanic("timeless", true);
  const enemies = [
    EnemyMother.rock(game),
    EnemyMother.paper(game),
    EnemyMother.scissors(game),
    EnemyMother.lizard(game)
  ];

  manager.update(100, enemies);

  assert.equal(game.options.mechanics.timeless, true, "Should remain timeless with 4 active teams");
});

test("MatchManager: does not decrement timeLeft in timeless mode", () => {
  const { game, manager } = setupMatchManager();
  manager.match = 1;
  manager.timeLeft = 5000;
  manager.options.setMechanic("timeless", true);
  const enemies = [
    EnemyMother.rock(game),
    EnemyMother.paper(game),
    EnemyMother.scissors(game),
    EnemyMother.lizard(game)
  ];
  const beforeTime = manager.timeLeft;

  manager.update(100, enemies);

  assert.equal(manager.timeLeft, beforeTime, "Should not decrement timeLeft in timeless mode");
});

test("MatchManager: transitions from timeless to timed with 3 active teams", () => {
  const { game, manager } = setupMatchManager();
  manager.match = 1;
  manager.timeLeft = 5000;
  manager.options.setMechanic("timeless", true);
  const enemies = [
    EnemyMother.rock(game),
    EnemyMother.paper(game),
    EnemyMother.scissors(game)
  ];

  manager.update(100, enemies);

  assert.equal(game.options.mechanics.timeless, false, "Should transition from timeless to timed with 3 active teams");
  assert.equal(manager.timeLeft, 4900, "Should decrement timeLeft by the update deltaTime once timed");
});

test("MatchManager: sole survivor identification", () => {
  const { game, manager } = setupMatchManager();
  manager.match = 1;
  const enemies = [EnemyMother.rock(game)];
  let winnerIdentified = null;
  game.eventBus.subscribe("match-win", ({ team }) => {
    winnerIdentified = team;
  });

  manager.update(100, enemies);

  assert.equal(winnerIdentified, "rocks", "Rocks should win when it is the sole survivor");
  assert.equal(game.lastWin, "rocks");
});

test("MatchManager: timeout winner evaluation with 2 teams", () => {
  const { game, manager } = setupMatchManager();
  manager.match = 1;
  manager.timeLeft = 50;
  manager.options.setMechanic("timeless", false);
  const enemies = [EnemyMother.rock(game), EnemyMother.scissors(game)];
  let winner = null;
  game.eventBus.subscribe("match-win", ({ team }) => {
    winner = team;
  });

  manager.update(100, enemies);

  assert.equal(winner, "scissors", "Scissors should win because it survived as the prey of Rocks");
  assert.equal(game.lastWin, "scissors");
});

test("MatchManager: respects customized matchTimeBaseMs and growth values injected via config", () => {
  const customConfig = {
    meta: {
      initialTimeLeftMs: 5000,
      enemiesPerLevel: 5
    },
    mechanics: {
      matchTimeBaseMs: 15000,
      matchTimeGrowthMs: 500,
      matchTimeMaxMs: 30000
    }
  };
  const game = new FakeGame();
  game.config = customConfig;
  game.mode.kind = "level";
  const manager = new MatchManager({
    game,
    eventBus: game.eventBus,
    options: game.options,
    startLevel: 2
  });
  game.matchManager = manager;
  manager.match = 2;

  manager.startMatch();

  const baseTime = customConfig.mechanics.matchTimeBaseMs;
  const growthPerMatch = customConfig.mechanics.matchTimeGrowthMs;
  const matchesPlayed = manager.match;
  const expectedTimeLeft = baseTime + matchesPlayed * growthPerMatch;
  assert.equal(manager.timeLeft, expectedTimeLeft);
});
