export class EnemyRenderer {
  constructor(entity, context, canvasAdapter, options) {
    this.entity = entity;
    this.context = context;
    this.canvasAdapter = canvasAdapter;
    this.options = options;
  }

  drawRectangle() {
    this.context.fillStyle = this.entity.color;
    this.context.fillRect(this.entity.x, this.entity.y, this.entity.width, this.entity.height);
  }

  drawLineToAim() {
    // Skip line when aiming at center (no target, idle state)
    const center = this.canvasAdapter.getCenter();
    if (this.entity.aimX === center.x && this.entity.aimY === center.y) {
      return;
    }

    this.context.strokeStyle = this.entity.color;
    this.context.beginPath();
    this.context.moveTo(this.entity.x + this.entity.width / 2, this.entity.y + this.entity.height / 2);
    this.context.lineTo(this.entity.aimX + this.entity.width / 2, this.entity.aimY + this.entity.height / 2);
    this.context.stroke();
  }

  drawHealthBar() {
    const healthFraction = Math.max(0, Math.min(1, this.entity.life / this.entity.maxLife));
    const x = this.entity.x;
    const y = this.entity.y - 10;
    const barWidth = this.entity.width;
    const barHeight = 6;
    this.context.save();
    this.context.fillStyle = "rgba(30,30,30,0.9)";
    this.context.fillRect(x, y, barWidth, barHeight);
    this.context.fillStyle = `hsl(${healthFraction * 120}, 85%, 50%)`;
    this.context.fillRect(x, y, barWidth * healthFraction, barHeight);
    this.context.strokeStyle = "rgba(255,255,255,0.25)";
    this.context.strokeRect(x - 0.5, y - 0.5, barWidth + 1, barHeight + 1);
    this.context.restore();
  }

  drawEmoji() {
    this.context.save();
    this.context.translate(this.entity.x + this.entity.width / 2, this.entity.y + this.entity.height / 2);
    this.context.rotate(this.entity.angle + Math.PI / 2 + this.entity.rotationOffset);
    this.context.translate(-(this.entity.x + this.entity.width / 2), -(this.entity.y + this.entity.height / 2));
    this.context.fillText(this.entity.emoji, this.entity.x - 2.5, this.entity.y + 16);
    this.context.restore();
  }

  draw() {
    this.drawHealthBar();
    this.options.effects.collider && this.drawRectangle();
    this.options.effects.debug && this.drawLineToAim();
    this.context.font = "20px Arial";
    this.drawEmoji();
  }
}
