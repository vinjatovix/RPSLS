import { Game } from "../src/index.js";

export class GameScenario {
  constructor() {
    this.game = new Game({ startLevel: 0 });
    this.game.progressManager.reset();
  }

  withPlayerTeam(team) {
    this.game.progressManager.selectTeam(team);
    return this;
  }

  withSpawnedMatch(groupCount = 1) {
    this.game.entityManager.spawnMatch(groupCount);
    return this;
  }

  withEnemyMarkedDead(team) {
    const enemy = this.game.entityManager.getEnemies().find(e => e.team === team);
    if (enemy) {
      enemy.dead = true;
    }
    return this;
  }

  withFirstEnemyMarkedDead() {
    const enemies = this.game.entityManager.getEnemies();
    if (enemies.length > 0) {
      enemies[0].dead = true;
    }
    return this;
  }

  withInjectedPowerup(mockPowerup) {
    this.game.entityManager.getPowerups().push(mockPowerup);
    return this;
  }

  updateEntities(deltaTime = 16) {
    this.game.entityManager.update(deltaTime);
    return this;
  }

  updateGame(deltaTime = 16) {
    this.game.update(deltaTime);
    return this;
  }

  get entityManager() {
    return this.game.entityManager;
  }

  get enemies() {
    return this.game.entityManager.getEnemies();
  }

  get powerups() {
    return this.game.entityManager.getPowerups();
  }

  get activeTeams() {
    return this.game.activeTeams;
  }

  get scoreManager() {
    return this.game.scoreManager;
  }

  destroy() {
    this.game.destroy();
  }
}
