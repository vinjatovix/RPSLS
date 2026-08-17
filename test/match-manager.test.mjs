import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { GAME_CONFIG } from "../src/config/gameConfig.js";

test("MatchManager: initializes with default values", () => {
  const game = new Game({ startLevel: 0 });
  const manager = game.matchManager;

  assert.equal(manager.match, 0);
  assert.equal(manager.timeLeft, GAME_CONFIG.meta.initialTimeLeftMs); // assert against the canonical initialTimeLeftMs constant
  assert.equal(manager.gameTime, 0);
  assert.equal(manager.paused, false);
  assert.equal(manager.timeSinceLastAction, 0);

  game.destroy();
});

test("MatchManager: updates timers and triggers countdown tick", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  const manager = game.matchManager;

  manager.match = 1;
  manager.timeLeft = 5000;
  manager.lastTickSecond = 5;
  manager.options.setMechanic("timeless", false);

  let tickEmitted = false;
  manager.eventBus.subscribe("tick", () => {
    tickEmitted = true;
  });

  manager.update(1001, []); // Delta exceeding 1 second
  assert.equal(manager.gameTime, 1001);
  assert.equal(manager.timeLeft, 3999);
  assert.ok(tickEmitted, "Should emit tick event on second boundary transition");

  game.destroy();
});

test("MatchManager: handles timeless transition", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  const manager = game.matchManager;

  manager.match = 1;
  manager.timeLeft = 5000;

  // Mock active enemies representing 4 unique teams
  const enemies = [
    { team: "rocks", dead: false },
    { team: "papers", dead: false },
    { team: "scissors", dead: false },
    { team: "lizards", dead: false }
  ];

  manager.update(100, enemies);
  assert.equal(game.options.mechanics.timeless, true, "Should transition to timeless with 4 active teams");

  const beforeTime = manager.timeLeft;
  manager.update(100, enemies);
  assert.equal(manager.timeLeft, beforeTime, "Should not decrement timeLeft in timeless mode");

  game.destroy();
});

test("MatchManager: sole survivor identification", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  const manager = game.matchManager;

  manager.match = 1;
  const enemies = [
    { team: "rocks", dead: false }
  ];

  let winnerIdentified = null;
  game.eventBus.subscribe("match-win", ({ team }) => {
    winnerIdentified = team;
  });

  manager.update(100, enemies);
  assert.equal(winnerIdentified, "rocks", "Rocks should win when it is the sole survivor");
  assert.equal(game.lastWin, "rocks");

  game.destroy();
});

test("MatchManager: timeout winner evaluation with 2 teams", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  const manager = game.matchManager;

  manager.match = 1;
  manager.timeLeft = 50;
  manager.options.setMechanic("timeless", false);

  // Rocks should win because scissors has rocks in its aim
  const rocksEnemy = { team: "rocks", dead: false, aim: ["lizards"] };
  const scissorsEnemy = { team: "scissors", dead: false, aim: ["rocks"] };

  const enemies = [rocksEnemy, scissorsEnemy];

  let winner = null;
  game.eventBus.subscribe("match-win", ({ team }) => {
    winner = team;
  });

  manager.update(100, enemies); // Force timeout (timeLeft <= 0)
  assert.equal(winner, "rocks", "Rocks should win because it has scissors in its aim");
  assert.equal(game.lastWin, "rocks");

  game.destroy();
});
