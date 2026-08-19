import { RACE_CLASSES } from "../../src/entities/races.js";
import { FakeGame } from "../doubles/FakeGame.mjs";

export class EnemyBuilder {
  constructor() {
    this.game = new FakeGame();
    this.team = "rocks";
    this.x = 100;
    this.y = 100;
    this.angle = 0;
    this.modifiers = null;
  }

  withGame(game) {
    this.game = game;

    return this;
  }

  withTeam(team) {
    this.team = team;

    return this;
  }

  withPosition(x, y) {
    this.x = x;
    this.y = y;

    return this;
  }

  withAngle(angle) {
    this.angle = angle;

    return this;
  }

  withModifiers(modifiers) {
    this.modifiers = modifiers;
    
    return this;
  }

  build() {
    const ConcreteEnemy = RACE_CLASSES[this.team];
    return new ConcreteEnemy({
      game: this.game,
      x: this.x,
      y: this.y,
      angle: this.angle,
      modifiers: this.modifiers
    });
  }
}
