/**
 * FloatingText - Texto que asciende y se desvanece.
 * Se usa al recoger un powerup para mostrar su nombre.
 */

export class FloatingText {
  constructor({ ctx, x, y, text, color }) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 900;
    this.maxLife = 900;
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
    const alpha = 1 - progress * progress;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.font = "bold 14px Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.strokeStyle = "rgba(0,0,0,0.7)";
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(this.text, this.x, this.y - progress * 30);
    this.ctx.fillStyle = this.color;
    this.ctx.fillText(this.text, this.x, this.y - progress * 30);
    this.ctx.restore();
  }
}
