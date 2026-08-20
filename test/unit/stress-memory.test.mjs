import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import { setupSimulationContext, TICK_MS } from "../doubles/setupSimulationContext.mjs";
import { EnemyBuilder } from "../builders/EnemyBuilder.mjs";
import { PowerUpBuilder } from "../builders/PowerUpBuilder.mjs";
import { RACE_STATS, UPGRADES } from "../../src/config/gameConfig.js";
import { EventBus } from "../../src/core/EventBus.js";
import { InfoPanel, MetaPanel, ScorePanel } from "../../src/ui/index.js";

const STRESS_ENEMIES_COUNT = 500;
const STRESS_POWERUPS_COUNT = 100;
const STRESS_CYCLES = 100;
const MAX_STRESS_DURATION_MS = 2500;

test("Stress: handles high entity density efficiently", () => {
  const { entityManager } = setupSimulationContext();
  const columnsEnemies = 20;
  const paddingEnemies = 10;
  const offsetEnemiesX = 100;
  const offsetEnemiesY = 100;
  entityManager.enemies = Array.from({ length: STRESS_ENEMIES_COUNT }, (_, i) => {
    const posX = offsetEnemiesX + (i % columnsEnemies) * paddingEnemies;
    const posY = offsetEnemiesY + Math.floor(i / columnsEnemies) * paddingEnemies;
    return new EnemyBuilder()
      .withGame(entityManager.game)
      .withTeam(i % 5 === 0 ? "rocks" : "scissors")
      .withPosition(posX, posY)
      .build();
  });
  const columnsPowerups = 10;
  const paddingPowerups = 15;
  const offsetPowerupsX = 150;
  const offsetPowerupsY = 150;
  entityManager.powerups = Array.from({ length: STRESS_POWERUPS_COUNT }, (_, i) => {
    const posX = offsetPowerupsX + (i % columnsPowerups) * paddingPowerups;
    const posY = offsetPowerupsY + Math.floor(i / columnsPowerups) * paddingPowerups;
    return new PowerUpBuilder()
      .withGame(entityManager.game)
      .withType("heal")
      .withPosition(posX, posY)
      .build();
  });
  const startTime = Date.now();

  for (let i = 0; i < STRESS_CYCLES; i++) {
    entityManager.update(TICK_MS);
  }

  const duration = Date.now() - startTime;
  entityManager.game.destroy();
  assert.ok(duration < MAX_STRESS_DURATION_MS);
});

test("Memory Life-cycle: completely prunes dead and expired entities from active collections", () => {
  const { entityManager } = setupSimulationContext();
  const attacker = new EnemyBuilder().withGame(entityManager.game).withTeam("rocks").build();
  const prey = new EnemyBuilder().withGame(entityManager.game).withTeam("scissors").build();
  entityManager.enemies = [attacker, prey];
  const powerup = new PowerUpBuilder().withGame(entityManager.game).withType("heal").build();
  entityManager.powerups = [powerup];
  attacker.dead = true;
  powerup.dead = true;

  entityManager.update(TICK_MS);

  assert.equal(entityManager.enemies.length, 1);
  assert.equal(entityManager.enemies[0], prey);
  assert.equal(entityManager.powerups.length, 0);
  entityManager.game.destroy();
});

test("Memory Leak: UI Panels cleanly unsubscribe from the EventBus upon destroy", () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='round-info'></div><div id='credits'></div><div id='shop-list'></div></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const eventBus = new EventBus();
  const mockProgress = {
    credits: 0,
    selectedTeam: "rocks",
    getPowerupLuck: () => 1,
    getUpgradeLevel: () => 0,
    getUpgradeCost: () => 0,
    eventBus
  };
  const mockScoreManager = {
    eventBus,
    getRanking: () => []
  };
  const getSubscribersCount = (event) => {
    return eventBus.events[event] ? eventBus.events[event].length : 0;
  };
  assert.equal(getSubscribersCount("tick"), 0);
  assert.equal(getSubscribersCount("score:update"), 0);
  const infoPanel = new InfoPanel({ scoreManager: mockScoreManager, progressManager: mockProgress, eventBus });
  const scorePanel = new ScorePanel({ scoreManager: mockScoreManager, eventBus });
  const metaPanel = new MetaPanel({ progressManager: mockProgress, eventBus, raceStats: RACE_STATS, upgrades: UPGRADES });
  assert.ok(getSubscribersCount("tick") > 0);
  assert.ok(getSubscribersCount("score:update") > 0);
  assert.ok(getSubscribersCount("progress:update") > 0);

  infoPanel.destroy();
  scorePanel.destroy();
  metaPanel.destroy();

  assert.equal(getSubscribersCount("tick"), 0);
  assert.equal(getSubscribersCount("score:update"), 0);
  assert.equal(getSubscribersCount("progress:update"), 0);
  delete globalThis.window;
  delete globalThis.document;
});
