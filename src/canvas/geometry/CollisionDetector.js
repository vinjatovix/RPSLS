/**
 * CollisionDetector - Detección de colisiones
 * Responsabilidad única: detectar colisiones entre objetos
 */

export class CollisionDetector {
  /**
   * Verificar si dos rectángulos se solapan
   * @param {Object} a - Objeto con x, y, width, height
   * @param {Object} b - Objeto con x, y, width, height
   * @returns {boolean}
   */
  static checkOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Verificar si un objeto está visible en el canvas
   * @param {number} x - Posición X
   * @param {number} y - Posición Y
   * @param {number} width - Ancho
   * @param {number} height - Alto
   * @param {Object} canvasSize - { width, height } del canvas
   * @returns {boolean}
   */
  static isVisible(x, y, width, height, canvasSize) {
    return (
      x > 1 &&
      x < canvasSize.width - width &&
      y > 1 &&
      y < canvasSize.height - height
    );
  }
}
