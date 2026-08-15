import { BloodParticles } from "./BloodParticles.js";
import { PowerUpBurst } from "./PowerUpEffects.js";
import { FloatingText } from "./FloatingText.js";

export class ParticleSystem {
  constructor({ game }) {
    this.game = game;
    this.context = this.game.canvasAdapter.getContext();
    this.particles = [];
  }

  addParticle(particle) {
    this.particles.push(particle);
  }

  collision(x, y) {
    for (let i = 0; i < 10; i++) {
      this.game.options.effects.blood &&
        this.addParticle(
          new BloodParticles({
            context: this.context,
            x,
            y,
            game: this.game,
            life: this.game.options.effects.snuff ? 3000 : 1000
          })
        );
    }
  }

  powerUpBurst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.addParticle(new PowerUpBurst({ context: this.context, x, y, color }));
    }
  }

  showFloatingText(x, y, text, color) {
    this.addParticle(new FloatingText({ context: this.context, x, y, text, color }));
  }

  update(deltaTime) {
    for (const particle of this.particles) {
      particle.update(deltaTime);
    }
    this.particles = this.particles.filter(particle => !particle.dead);
  }

  draw() {
    for (const particle of this.particles) {
      particle.draw();
    }
  }
}
