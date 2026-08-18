import { Random } from "../core/Random.js";

export class Particle {
  constructor({ context, x, y, game }) {
    this.context = context;
    this.x = x;
    this.y = y;
    this.game = game;
    this.dead = false;
    this.velocityX = Random.cosmeticNext() * 0.5 - 0.25;
    this.velocityY = Random.cosmeticNext() * 0.5 - 0.25;
    this.life = 1000;
    this.opacity = 1;
    this.size = Random.cosmeticNext() * 5 + 5;
    this.color = `hsl(${Random.cosmeticNext() * 360}, 100%, 50%)`;
  }

  update(deltaTime) {
    this.x += this.velocityX * deltaTime;
    this.y += this.velocityY * deltaTime;
    this.life -= deltaTime;
    this.opacity = this.life / 1000;
    if (this.life <= 0 || this.x < 0 || this.x > this.game.width || this.y < 0 || this.y > this.game.height) {
      this.dead = true;
    }
  }

  draw() {
    this.context.save();
    this.context.globalAlpha = this.opacity;
    this.context.translate(this.x, this.y);
    this.context.fillStyle = this.color;
    this.context.beginPath();
    this.context.arc(0, 0, this.size, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();
  }
}
