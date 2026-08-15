export class DebugDrawer {
  constructor({ canvasAdapter, clock, options }) {
    this.canvasAdapter = canvasAdapter;
    this.clock = clock;
    this.options = options;
    this.context = this.canvasAdapter.getContext();
    this.fontSize = this.canvasAdapter.getFontSize();
    this.position = this.canvasAdapter.getWidth() - 8 * this.fontSize;
  }

  #setupContext() {
    this.context.font = `${this.fontSize}px Arial`;
    this.context.fillStyle = "white";
  }

  draw() {
    this.fontSize = this.canvasAdapter.getFontSize();
    this.position = this.canvasAdapter.getWidth() - 8 * this.fontSize;
    if (!this.options.effects.debug) return;
    this.context.save();
    this.#setupContext();
    this.context.fillText(`${Math.round(this.clock.calculateFPS())} FPS`, this.position, this.fontSize);
    this.context.fillText(`${this.clock.deltaTime} ms`, this.position, 2 * this.fontSize);
    this.context.fillText(
      `${this.canvasAdapter.getWidth()}x${this.canvasAdapter.getHeight()}`,
      this.position,
      3 * this.fontSize
    );
    this.context.fillText(`Timeless: ${this.options.mechanics.timeless}`, this.position, 4 * this.fontSize);
    this.context.fillText(`Capture: ${this.options.mechanics.capture}`, this.position, 5 * this.fontSize);
    this.context.fillText(`Blood: ${this.options.effects.blood}`, this.position, 6 * this.fontSize);
    this.context.fillText(`Snuff: ${this.options.effects.snuff}`, this.position, 7 * this.fontSize);
    this.context.restore();
  }
}
