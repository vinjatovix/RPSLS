export class Clock {
  constructor() {
    this.lastTime = Date.now();
    this.deltaTime = 0;
  }

  calculateFPS() {
    return 1000 / this.deltaTime;
  }

  update() {
    const now = Date.now();
    this.deltaTime = now - this.lastTime;
    this.lastTime = now;
    return this.deltaTime;
  }

  /**
   * Restart the clock from scratch (avoids giant deltas after
   * returning focus to the browser).
   */
  reset() {
    this.lastTime = Date.now();
    this.deltaTime = 0;
  }
}
