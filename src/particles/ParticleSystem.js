import { BloodParticles } from "./BloodParticles.js";
import { FloatingText } from "./FloatingText.js";
import { ParticlePool } from "./ParticlePool.js";
import { PowerUpBurst } from "./PowerUpEffects.js";

export class ParticleSystem {
  constructor({ game }) {
    this.game = game;
    this.context = this.game.canvasAdapter.getContext();
    this._particles = [];
    this.pool = new ParticlePool(1000);

    this.pool.preAllocate(BloodParticles, 500, {
      context: this.context,
      game: this.game,
      x: 0,
      y: 0
    });
  }

  get particles() {
    return this._particles;
  }

  addParticle(particle) {
    this._particles.push(particle);
  }

  clear() {
    for (const p of this._particles) {
      this.pool.release(p);
    }

    this._particles = [];
  }

  collision(x, y) {
    if (!this.game.options.effects.blood) {
      return;
    }

    const life = this.game.options.effects.snuff ? 3000 : 1000;
    const options = {
      context: this.context,
      game: this.game,
      life
    };

    for (let i = 0; i < 10; i++) {
      const p = this.pool.acquire(BloodParticles, x, y, options);

      if (p) {
        this.addParticle(p);
      }
    }
  }

  powerUpBurst(x, y, color) {
    const options = {
      context: this.context,
      color
    };

    for (let i = 0; i < 8; i++) {
      const p = this.pool.acquire(PowerUpBurst, x, y, options);

      if (p) {
        this.addParticle(p);
      }
    }
  }

  showFloatingText(x, y, text, color) {
    const p = this.pool.acquire(FloatingText, x, y, {
      context: this.context,
      text,
      color
    });

    if (p) {
      this.addParticle(p);
    }
  }

  update(deltaTime) {
    let writeIndex = 0;
    for (let i = 0; i < this._particles.length; i++) {
      const particle = this._particles[i];
      particle.update(deltaTime);

      if (particle.dead) {
        this.pool.release(particle);
      } else {
        this._particles[writeIndex++] = particle;
      }
    }
    this._particles.length = writeIndex;
  }

  draw() {
    for (const particle of this._particles) {
      particle.draw();
    }
  }
}
