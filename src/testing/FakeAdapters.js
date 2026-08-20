import { Random } from "../core/index.js";

export class FakeCanvasAdapter {
  constructor(displayConfig = {
    minWidth: 640,
    minHeight: 384,
    maxWidth: 1280 * 4,
    maxHeight: 768 * 4
  }) {
    this.displayConfig = displayConfig;
    this.width = displayConfig?.minWidth || 640;
    this.height = displayConfig?.minHeight || 384;
    this.context = new Proxy({}, {
      get: () => () => undefined
    });
    this.virtualRect = null;
    this.canvas = {
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => {
        return this.virtualRect || {
          top: 0,
          left: 0,
          width: this.width,
          height: this.height
        };
      }
    };
  }

  clear() {}

  getContext() {
    return this.context;
  }

  getCanvas() {
    return this.canvas;
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  getSize() {
    return {
      width: this.width,
      height: this.height
    };
  }

  getCenter() {
    return {
      x: this.width / 2,
      y: this.height / 2
    };
  }

  getScale() {
    return this.width / this.displayConfig.maxWidth;
  }

  getFontSize(divisor = 50) {
    return this.height / divisor;
  }

  getRandomSpawnPoint() {
    const margin = this.width / 6;
    const x = Random.next() * (this.width - margin * 2) + margin;
    const y = Random.next() * (this.height - margin * 2) + margin;

    return { x, y };
  }

  resize(level, factor = 0.003) {
    const lvl = level ?? 0;
    const newWidth = this.displayConfig.minWidth + this.displayConfig.maxWidth * factor * lvl;
    const newHeight = this.displayConfig.minHeight + this.displayConfig.maxHeight * factor * lvl;

    this.width = Math.min(newWidth, this.displayConfig.maxWidth);
    this.height = Math.min(newHeight, this.displayConfig.maxHeight);

    return this.getSize();
  }

  clampPosition(pos) {
    return {
      x: Math.max(0, Math.min(pos.x, this.width - pos.width)),
      y: Math.max(0, Math.min(pos.y, this.height - pos.height))
    };
  }

  clientToCanvasCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();

    if (!rect || !rect.width || !rect.height) {
      return null;
    }

    return {
      x: ((clientX - rect.left) * this.width) / rect.width,
      y: ((clientY - rect.top) * this.height) / rect.height
    };
  }
}

export class FakeLocalStorageAdapter {
  constructor(key = "game-options-v2") {
    this.defaultKey = key;
    this.store = new Map();
  }

  save(data, key = this.defaultKey) {
    this.store.set(key, JSON.stringify(data));
  }

  load(key = this.defaultKey) {
    const data = this.store.get(key);

    return data ? JSON.parse(data) : null;
  }

  clear(key = this.defaultKey) {
    this.store.delete(key);
  }
}

export class FakeInputHandler {
  constructor({ onToggle = null } = {}) {
    this.keys = { b: false, d: false, s: false, x: false };
    this.onToggle = onToggle;
  }

  setupEventListeners() {}

  handleKeyDown(_event) {}

  handleKeyUp(_event) {}

  getKeys() {
    return this.keys;
  }

  isKeyPressed(key) {
    const k = key.toLowerCase();

    return this.keys[k] || false;
  }

  setKeyState(key, value) {
    const k = key.toLowerCase();

    if (k in this.keys) {
      const oldValue = this.keys[k];
      this.keys[k] = value;

      if (oldValue !== value && this.onToggle) {
        this.onToggle(k, value);
      }
    }
  }

  destroy() {}
}

export function createFakeAdapters(displayConfig) {
  return {
    canvasAdapter: new FakeCanvasAdapter(displayConfig),
    storageAdapter: new FakeLocalStorageAdapter(),
    inputHandler: new FakeInputHandler()
  };
}
