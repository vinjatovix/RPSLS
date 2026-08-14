/**
 * Clock - Gestión de tiempo y FPS
 * Responsabilidad única: calcular deltaTime y FPS
 */

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
   * Reanudar el reloj desde cero (evita deltas gigantes tras
   * volver el foco al navegador).
   */
  reset() {
    this.lastTime = Date.now();
    this.deltaTime = 0;
  }
}
