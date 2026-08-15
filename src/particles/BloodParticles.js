import { Particle } from "./Particle.js";

export class BloodParticles extends Particle {
  constructor({ context, x, y, game, life = 650, size = 2, color = "red" }) {
    super({ context, x, y, game });
    this.velocityX = Math.random() * 0.5 - 0.25;
    this.velocityY = Math.random() * 0.5 - 0.25;
    this.life = life;
    this.size = size;
    this.color = color;
  }
}
