import { POWERUP_TYPES } from "../../src/config/gameConfig.js";
import { PowerUp } from "../../src/entities/index.js";
import { FakeGame } from "../doubles/FakeGame.mjs";

export class PowerUpBuilder {
  constructor() {
    this.game = new FakeGame();
    this.type = "heal";
    this.x = 100;
    this.y = 100;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  withGame(game) {
    this.game = game;

    return this;
  }

  withType(type) {
    this.type = type;

    return this;
  }

  withPosition(x, y) {
    this.x = x;
    this.y = y;

    return this;
  }

  withVelocity(vx, vy) {
    this.velocityX = vx;
    this.velocityY = vy;

    return this;
  }

  build() {
    const powerUp = new PowerUp({ game: this.game });
    const config = POWERUP_TYPES[this.type];
    powerUp.type = this.type;
    powerUp.x = this.x;
    powerUp.y = this.y;
    powerUp.velocityX = this.velocityX;
    powerUp.velocityY = this.velocityY;
    if (config) {
      powerUp.emoji = config.emoji;
      powerUp.color = config.color;
    }

    return powerUp;
  }
}
