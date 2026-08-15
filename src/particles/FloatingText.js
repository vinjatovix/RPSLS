export class FloatingText {
  constructor({ context, x, y, text, color }) {
    this.context = context;
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
    this.context.save();
    this.context.globalAlpha = alpha;
    this.context.font = "bold 14px Arial";
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.strokeStyle = "rgba(0,0,0,0.7)";
    this.context.lineWidth = 3;
    this.context.strokeText(this.text, this.x, this.y - progress * 30);
    this.context.fillStyle = this.color;
    this.context.fillText(this.text, this.x, this.y - progress * 30);
    this.context.restore();
  }
}
