export class CollisionDetector {
  static checkOverlap(first, second) {
    return (
      first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y
    );
  }

  static isVisible(x, y, width, height, canvasSize) {
    return (
      x > 1 &&
      x < canvasSize.width - width &&
      y > 1 &&
      y < canvasSize.height - height
    );
  }
}
