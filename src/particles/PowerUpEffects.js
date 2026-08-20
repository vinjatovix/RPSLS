export class PowerUpBurst {
  constructor(options) {
    if (options) {
      this.init(options);
    }
  }

  init({ context, x, y, color }) {
    this.context = context;
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
    this.context.save();
    this.context.globalAlpha = this.life / this.maxLife;
    this.context.strokeStyle = this.color;
    this.context.lineWidth = 2;
    this.context.beginPath();
    this.context.arc(this.x, this.y, 8 + progress * 24, 0, Math.PI * 2);
    this.context.stroke();
    this.context.restore();
  }
}
