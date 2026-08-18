import { Random } from "../core/index.js";

export class CanvasAdapter {
  constructor({ canvasId = "canvas1", displayConfig }) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas with id "${canvasId}" not found`);
    }

    this.context = this.canvas.getContext("2d");
    this.displayConfig = displayConfig;
    this.canvas.width = displayConfig.minWidth;
    this.canvas.height = displayConfig.minHeight;
  }

  clear(persist = false) {
    if (!persist) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  getContext() {
    return this.context;
  }

  getCanvas() {
    return this.canvas;
  }

  getWidth() {
    return this.canvas.width;
  }

  getHeight() {
    return this.canvas.height;
  }

  getSize() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  getCenter() {
    return {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2
    };
  }

  getScale() {
    return this.canvas.width / this.displayConfig.maxWidth;
  }

  getFontSize(divisor = 50) {
    return this.canvas.height / divisor;
  }

  getRandomSpawnPoint() {
    const margin = this.canvas.width / 6;
    const x = Random.next() * (this.canvas.width - margin * 2) + margin;
    const y = Random.next() * (this.canvas.height - margin * 2) + margin;
    return { x, y };
  }

  resize(level, factor = 0.003) {
    const newWidth = this.displayConfig.minWidth + this.displayConfig.maxWidth * factor * level;
    const newHeight = this.displayConfig.minHeight + this.displayConfig.maxHeight * factor * level;

    this.canvas.width = Math.min(newWidth, this.displayConfig.maxWidth);
    this.canvas.height = Math.min(newHeight, this.displayConfig.maxHeight);

    return this.getSize();
  }

  // limitCanvas is obsolete in the real game (outDies handles the boundary) but 
  // may evolve for toroidal arenas or other mechanics. 
  // It is still used in the headless sim (matchupSim, flee-ai) to keep enemies 
  // inside the arena instead of dying off-screen.
  clampPosition(position) {
    return {
      x: Math.max(0, Math.min(position.x, this.canvas.width - position.width)),
      y: Math.max(0, Math.min(position.y, this.canvas.height - position.height))
    };
  }
}
