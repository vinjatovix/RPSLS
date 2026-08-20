import { Particle } from "./Particle.js";

export class BloodParticles extends Particle {
  constructor(options) {
    super(options);
  }

  init(options = {}) {
    const { context, x, y, game, life = 650, size = 2, color = "red" } = options;

    super.init({
      context,
      x,
      y,
      game,
      life,
      maxLife: life,
      size,
      color
    });
  }
}
