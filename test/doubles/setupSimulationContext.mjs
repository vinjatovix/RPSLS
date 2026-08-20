import { EntityManager } from "../../src/entities/EntityManager.js";
import { ProgressManager } from "../../src/meta/ProgressManager.js";
import { FakeLocalStorageAdapter } from "../../src/testing/FakeAdapters.js";
import { FakeGame } from "./FakeGame.mjs";

export const TICK_MS = 16;

export function setupSimulationContext(selectedTeam = "rocks") {
  const game = new FakeGame();
  const progressManager = new ProgressManager({
    eventBus: game.eventBus,
    raceStats: game.raceStats,
    upgrades: game.upgrades,
    storageAdapter: new FakeLocalStorageAdapter()
  });
  progressManager.selectTeam(selectedTeam);
  game.progressManager = progressManager;

  const entityManager = new EntityManager({
    game,
    eventBus: game.eventBus,
    progressManager
  });
  game.entityManager = entityManager;

  return { game, progressManager, entityManager, manager: entityManager };
}
