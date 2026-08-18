export class SpatialGrid {
  static COORDINATE_OFFSET = 1000;
  static KEY_MASK = 0xFFFF;
  static MAX_POOL_SIZE = 500;

  constructor(cellWidth, cellHeight, options = {}) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.cells = new Map();
    this.arrayPool = [];
    this.isToroidal = options.isToroidal || false;
    this.width = options.width || 0;
    this.height = options.height || 0;
    this.queryResults = [];
  }

  static decodeCellKey(key) {
    const cellX = (key >> 16) - SpatialGrid.COORDINATE_OFFSET;
    const cellY = (key & SpatialGrid.KEY_MASK) - SpatialGrid.COORDINATE_OFFSET;
    return { cellX, cellY };
  }

  #poolCellArray(arr) {
    arr.length = 0;
    if (this.arrayPool.length < SpatialGrid.MAX_POOL_SIZE) {
      this.arrayPool.push(arr);
    }
  }

  #getCellKey(cellX, cellY) {
    const unsignedCellX = cellX + SpatialGrid.COORDINATE_OFFSET;
    const unsignedCellY = cellY + SpatialGrid.COORDINATE_OFFSET;
    return (unsignedCellX << 16) | (unsignedCellY & SpatialGrid.KEY_MASK);
  }

  clear() {
    this.cells.forEach(arr => this.#poolCellArray(arr));
    this.cells.clear();
  }
  
  insert(entity) {
    const cx = entity.x + (entity.width || 0) / 2;
    const cy = entity.y + (entity.height || 0) / 2;
    
    let x = cx;
    let y = cy;

    // Mathematical coordinate wrapping for out-of-bounds positions when toroidal is enabled
    if (this.isToroidal && this.width > 0 && this.height > 0) {
      x = ((cx % this.width) + this.width) % this.width;
      y = ((cy % this.height) + this.height) % this.height;
    }

    const cellX = Math.floor(x / this.cellWidth);
    const cellY = Math.floor(y / this.cellHeight);
    const cellKey = this.#getCellKey(cellX, cellY);

    let cell = this.cells.get(cellKey);
    if (!cell) {
      cell = this.arrayPool.pop() || [];
      this.cells.set(cellKey, cell);
    }
    cell.push(entity);
  }

  /**
   * Retrieves all entities in cells intersecting the given bounding circle.
   * 
   * PERFORMANCE NOTE (Object Pooling & Mutation):
   * In a 60 FPS loop with 200 entities, returning a new array would create ~24,000 arrays/sec,
   * triggering massive Garbage Collection thrashing and micro-stuttering.
   * Instead, we apply zero-allocation Object Pooling by mutating and reusing a shared array buffer.
   * Setting `candidates.length = 0` instantly empties the array without destroying the memory reference.
   * 
   * @param {number} x - Center X coordinate of the query.
   * @param {number} y - Center Y coordinate of the query.
   * @param {number} radius - Search radius.
   * @param {Array} [outCandidates=null] - Optional caller-provided array to inject results into. 
   * If omitted, the grid's internal shared buffer (`this.queryResults`) is reused for extreme performance.
   */
  query(x, y, radius, outCandidates = null) {
    const candidates = outCandidates || this.queryResults;
    candidates.length = 0;
    if (this.isToroidal && this.width > 0 && this.height > 0) {
      this.#queryToroidal(x, y, radius, candidates);
    } else {
      this.#queryStandard(x, y, radius, candidates);
    }
    return candidates;
  }

  #queryToroidal(x, y, radius, outCandidates) {
    const cols = Math.ceil(this.width / this.cellWidth);
    const rows = Math.ceil(this.height / this.cellHeight);

    const xWrapped = ((x % this.width) + this.width) % this.width;
    const yWrapped = ((y % this.height) + this.height) % this.height;

    const cxCenter = Math.floor(xWrapped / this.cellWidth);
    const cyCenter = Math.floor(yWrapped / this.cellHeight);

    const spanX = Math.ceil(radius / this.cellWidth);
    const spanY = Math.ceil(radius / this.cellHeight);

    const fullCols = (spanX * 2 + 1 >= cols);
    const fullRows = (spanY * 2 + 1 >= rows);

    const minDx = fullCols ? 0 : -spanX;
    const maxDx = fullCols ? cols - 1 : spanX;

    const minDy = fullRows ? 0 : -spanY;
    const maxDy = fullRows ? rows - 1 : spanY;

    for (let dx = minDx; dx <= maxDx; dx++) {
      const cxWrapped = fullCols ? dx : (((cxCenter + dx) % cols) + cols) % cols;

      for (let dy = minDy; dy <= maxDy; dy++) {
        const cyWrapped = fullRows ? dy : (((cyCenter + dy) % rows) + rows) % rows;

        const cellKey = this.#getCellKey(cxWrapped, cyWrapped);
        this.#addCellCandidates(cellKey, outCandidates);
      }
    }
  }

  #queryStandard(x, y, radius, outCandidates) {
    const minCellX = Math.floor((x - radius) / this.cellWidth);
    const maxCellX = Math.floor((x + radius) / this.cellWidth);
    const minCellY = Math.floor((y - radius) / this.cellHeight);
    const maxCellY = Math.floor((y + radius) / this.cellHeight);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellKey = this.#getCellKey(cx, cy);
        this.#addCellCandidates(cellKey, outCandidates);
      }
    }
  }

  #addCellCandidates(cellKey, outCandidates) {
    const cell = this.cells.get(cellKey);
    if (cell) {
      for (let i = 0; i < cell.length; i++) {
        outCandidates.push(cell[i]);
      }
    }
  }
}
