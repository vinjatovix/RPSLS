/**
 * CanvasManager - Gestión del canvas y contexto 2D
 * Responsabilidades:
 * - Obtener y manipular elemento canvas
 * - Manejo de dimensiones y escala
 * - Limpieza del canvas
 */

export class CanvasManager {
  constructor({ canvasId = "canvas1", displayConfig }) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas with id "${canvasId}" not found`);
    }

    this.ctx = this.canvas.getContext("2d");
    this.displayConfig = displayConfig;

    // Inicializar dimensiones
    this.canvas.width = displayConfig.minWidth;
    this.canvas.height = displayConfig.minHeight;
  }

  /**
   * Limpiar canvas
   * @param {boolean} persist - Si false, limpia; si true, no limpia
   */
  clear(persist = false) {
    if (!persist) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Obtener el contexto 2D del canvas
   */
  getCtx() {
    return this.ctx;
  }

  /**
   * Obtener el elemento canvas
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Obtener ancho del canvas
   */
  getWidth() {
    return this.canvas.width;
  }

  /**
   * Obtener alto del canvas
   */
  getHeight() {
    return this.canvas.height;
  }

  /**
   * Obtener tamaño del canvas
   */
  getSize() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Obtener centro del canvas
   */
  getCenter() {
    return {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2
    };
  }

  /**
   * Obtener escala (basada en relación con maxWidth)
   */
  getScale() {
    return this.canvas.width / this.displayConfig.maxWidth;
  }

  /**
   * Obtener tamaño de fuente basado en altura del canvas
   */
  getFontSize(divisor = 50) {
    return this.canvas.height / divisor;
  }

  /**
   * Obtener punto de spawn aleatorio en el canvas
   * @returns {{ x: number, y: number }}
   */
  getRandomSpawnPoint() {
    const margin = this.canvas.width / 6;
    const x = Math.random() * (this.canvas.width - margin * 2) + margin;
    const y = Math.random() * (this.canvas.height - margin * 2) + margin;
    return { x, y };
  }

  /**
   * Redimensionar canvas
   * @param {number} level - Nivel actual
   * @param {number} factor - Factor de crecimiento
   */
  resize(level, factor = 0.003) {
    const newWidth = this.displayConfig.minWidth + this.displayConfig.maxWidth * factor * level;
    const newHeight = this.displayConfig.minHeight + this.displayConfig.maxHeight * factor * level;

    this.canvas.width = Math.min(newWidth, this.displayConfig.maxWidth);
    this.canvas.height = Math.min(newHeight, this.displayConfig.maxHeight);

    return this.getSize();
  }

  /**
   * Limitar posición dentro del canvas
   * @param {Object} position - { x, y, width, height }
   * @returns {Object} - Posición limitada
   */
  clampPosition(position) {
    return {
      x: Math.max(0, Math.min(position.x, this.canvas.width - position.width)),
      y: Math.max(0, Math.min(position.y, this.canvas.height - position.height))
    };
  }
}
