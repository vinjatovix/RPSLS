import { FakeGame } from "./FakeGame.mjs";
import { ProgressManager } from "../../src/meta/ProgressManager.js";
import { EntityManager } from "../../src/entities/EntityManager.js";

export const TICK_MS = 16;

export function setupSimulationContext(selectedTeam = "rocks") {
  const game = new FakeGame();
  const progressManager = new ProgressManager({ eventBus: game.eventBus });
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
