import { SpatialGrid } from "../canvas/index.js";

export class DebugDrawer {
  constructor({ game, canvasAdapter, clock, options }) {
    this.game = game;
    this.canvasAdapter = canvasAdapter;
    this.clock = clock;
    this.options = options;
    this.context = this.canvasAdapter.getContext();
    this.fontSize = this.canvasAdapter.getFontSize();
    this.position = this.canvasAdapter.getWidth() - 8 * this.fontSize;
    this.queryResults = [];
  }

  #setupContext() {
    this.context.font = `${this.fontSize}px Arial`;
    this.context.fillStyle = "white";
  }

  #drawGrid() {
    const grid = this.game?.spatialGrid;
    if (!grid) return;

    const canvasWidth = this.canvasAdapter.getWidth();
    const canvasHeight = this.canvasAdapter.getHeight();
    const cellWidth = grid.cellWidth;
    const cellHeight = grid.cellHeight;

    this.context.save();

    const gridBorderColor = "rgba(255, 255, 255, 0.12)";
    this.context.strokeStyle = gridBorderColor;
    this.context.lineWidth = 1;

    this.context.beginPath();
    for (let x = cellWidth; x < canvasWidth; x += cellWidth) {
      this.context.moveTo(x, 0);
      this.context.lineTo(x, canvasHeight);
    }
    for (let y = cellHeight; y < canvasHeight; y += cellHeight) {
      this.context.moveTo(0, y);
      this.context.lineTo(canvasWidth, y);
    }
    this.context.stroke();

    const occupancyTextColor = "rgba(0, 255, 0, 0.5)";
    this.context.font = "10px Arial";
    this.context.fillStyle = occupancyTextColor;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";

    for (const [key, activeCellEntities] of grid.cells.entries()) {
      if (activeCellEntities.length > 0) {
        const { cellX, cellY } = SpatialGrid.decodeCellKey(key);
        const labelCenterX = cellX * cellWidth + cellWidth / 2;
        const labelCenterY = cellY * cellHeight + cellHeight / 2;
        this.context.fillText(`${activeCellEntities.length}`, labelCenterX, labelCenterY);
      }
    }

    this.context.restore();
  }

  #drawQueryVisualization() {
    const grid = this.game?.spatialGrid;
    const allEnemies = this.game?.entityManager?.getEnemies();
    if (!grid || !allEnemies || allEnemies.length === 0) return;

    const trackedEntity = allEnemies[0];
    const searchRadius = this.options.mechanics.ai.dangerRadius || 200;
    const cellWidth = grid.cellWidth;
    const cellHeight = grid.cellHeight;

    const cx = trackedEntity.x + (trackedEntity.width || 20) / 2;
    const cy = trackedEntity.y + (trackedEntity.height || 20) / 2;

    this.context.save();

    const startGridColumn = Math.floor((cx - searchRadius) / cellWidth);
    const endGridColumn = Math.floor((cx + searchRadius) / cellWidth);
    const startGridRow = Math.floor((cy - searchRadius) / cellHeight);
    const endGridRow = Math.floor((cy + searchRadius) / cellHeight);

    const boundingBoxFillColor = "rgba(255, 165, 0, 0.12)";
    this.context.fillStyle = boundingBoxFillColor;
    for (let currentColumn = startGridColumn; currentColumn <= endGridColumn; currentColumn++) {
      for (let currentRow = startGridRow; currentRow <= endGridRow; currentRow++) {
        this.context.fillRect(currentColumn * cellWidth, currentRow * cellHeight, cellWidth, cellHeight);
      }
    }

    const searchCircleStrokeColor = "rgba(255, 165, 0, 0.6)";
    this.context.beginPath();
    this.context.arc(cx, cy, searchRadius, 0, Math.PI * 2);
    this.context.strokeStyle = searchCircleStrokeColor;
    this.context.lineWidth = 1.5;
    this.context.stroke();

    const matchingCandidates = grid.query(cx, cy, searchRadius, this.queryResults);
    const candidateLineColor = "rgba(0, 255, 255, 0.7)";
    this.context.strokeStyle = candidateLineColor;
    this.context.lineWidth = 1;
    this.context.beginPath();
    for (const entity of matchingCandidates) {
      if (entity === trackedEntity) continue;
      const ecx = entity.x + (entity.width || 20) / 2;
      const ecy = entity.y + (entity.height || 20) / 2;
      const dx = ecx - cx;
      const dy = ecy - cy;
      if (dx * dx + dy * dy < searchRadius * searchRadius) {
        this.context.moveTo(cx, cy);
        this.context.lineTo(ecx, ecy);
      }
    }
    this.context.stroke();

    this.context.restore();
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

    this.#drawGrid();
    this.#drawQueryVisualization();
  }
}
