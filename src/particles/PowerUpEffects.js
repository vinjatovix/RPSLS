/**
 * PowerUpBurst - Partícula de explosión al recoger un powerup
 * Anillo expansivo con el color del powerup
 */

export class PowerUpBurst {
  constructor({ ctx, x, y, color }) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 400;
    this.maxLife = 400;
    this.dead = false;
  }

  update(deltaTime) {
    this.life -= deltaTime;
    if (this.life <= 0) {
      this.dead = true;
    }
  }

  draw() {
    const progress = 1 - this.life / this.maxLife;
    this.ctx.save();
    this.ctx.globalAlpha = this.life / this.maxLife;
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, 8 + progress * 24, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }
}
