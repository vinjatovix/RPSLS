import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { EntityManager } from "../src/entities/index.js";
import { GameScenario } from "./GameScenario.mjs";

test("EntityManager: initial state and spawnMatch", () => {
  const scenario = new GameScenario().withPlayerTeam("rocks");
  const manager = scenario.entityManager;

  assert.ok(manager instanceof EntityManager);
  assert.ok(Array.isArray(scenario.enemies));
  assert.ok(Array.isArray(scenario.powerups));

  manager.spawnMatch(2);

  assert.equal(scenario.enemies.length, 10);
  assert.equal(scenario.powerups.length, 0);

  scenario.destroy();
});

test("EntityManager: updates and prunes dead entities", () => {
  const scenario = new GameScenario()
    .withPlayerTeam("rocks")
    .withSpawnedMatch(1);

  const initialCount = scenario.enemies.length;
  assert.ok(initialCount > 0);

  scenario.withFirstEnemyMarkedDead().updateEntities(16);

  assert.equal(scenario.enemies.length, initialCount - 1);

  const mockPowerup = {
    x: 100,
    y: 100,
    width: 22,
    height: 22,
    dead: false,
    update: () => {},
    draw: () => {}
  };
  scenario.withInjectedPowerup(mockPowerup);
  assert.equal(scenario.powerups.length, 1);

  mockPowerup.dead = true;
  scenario.updateEntities(16);
  assert.equal(scenario.powerups.length, 0);

  scenario.destroy();
});

test("EntityManager: integration with game loop update", () => {
  const scenario = new GameScenario()
    .withPlayerTeam("rocks")
    .withSpawnedMatch(1);

  const initialPositions = scenario.enemies.map(e => ({ x: e.x, y: e.y }));

  scenario.updateGame(32);

  const currentPositions = scenario.enemies.map(e => ({ x: e.x, y: e.y }));
  const anyMoved = initialPositions.some((pos, i) => pos.x !== currentPositions[i].x || pos.y !== currentPositions[i].y);

  assert.ok(anyMoved);

  scenario.destroy();
});

test("CombatSystem: prevents double-killing and dead entity collisions", () => {
  const scenario = new GameScenario()
    .withPlayerTeam("rocks")
    .withSpawnedMatch(1);

  const rock = scenario.enemies.find(e => e.team === "rocks");
  const scissors = scenario.enemies.find(e => e.team === "scissors");
  assert.ok(rock && scissors);

  const initialKills = scenario.scoreManager.getTeam("rocks").kills;

  rock.dead = false;
  rock.life = 100;
  scissors.dead = false;
  scissors.life = 10;

  rock.combatSystem.kill(scissors);
  assert.equal(scissors.dead, true);
  assert.equal(scenario.scoreManager.getTeam("rocks").kills, initialKills + 1);

  rock.combatSystem.kill(scissors);
  assert.equal(scenario.scoreManager.getTeam("rocks").kills, initialKills + 1);

  rock.dead = true;
  const paper = scenario.enemies.find(e => e.team === "papers");
  if (paper) {
    paper.dead = false;
    paper.life = 100;
    const initialPaperKills = scenario.scoreManager.getTeam("rocks").kills;
    rock.combatSystem.kill(paper);
    assert.equal(paper.dead, false);
    assert.equal(scenario.scoreManager.getTeam("rocks").kills, initialPaperKills);
  }

  scenario.destroy();
});

test("EntityManager: activeTeams tracking state-synchronization", () => {
  const scenario = new GameScenario()
    .withPlayerTeam("rocks")
    .withSpawnedMatch(1);

  assert.equal(scenario.activeTeams.size, 5);
  assert.ok(scenario.activeTeams.has("rocks"));
  assert.ok(scenario.activeTeams.has("papers"));

  scenario.withEnemyMarkedDead("papers").updateEntities(16);

  assert.equal(scenario.activeTeams.size, 4);
  assert.ok(!scenario.activeTeams.has("papers"));

  scenario.destroy();
});
