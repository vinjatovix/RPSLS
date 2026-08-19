import { CollisionDetector } from "../../src/canvas/index.js";
import { ScoreManager } from "../../src/scoring/ScoreManager.js";
import { FakeEventBus } from "./FakeEventBus.mjs";

export class FakeGame {
  constructor({ width = 600, height = 400 } = {}) {
    this.eventBus = new FakeEventBus();
    this.activeTeams = new Set();
    this.width = width;
    this.height = height;
    this.modeKey = "infinite-death";
    this.mode = { kind: "infinite-death", capture: true, isLeague: false };
    this.leagueLength = 50;
    this.lastWin = null;

    this.options = {
      display: { minWidth: 600, minHeight: 400, maxWidth: 1200, maxHeight: 800, persist: false },
      mechanics: { capture: true, outDies: true },
      effects: { debug: false, collider: false, blood: true, snuff: false },
      setMechanic: (key, value) => { this.options.mechanics[key] = value; },
      update: () => {}
    };

    const mockContext = new Proxy({}, {
      get(target, prop) {
        if (typeof prop === "symbol") return undefined;
        if (!(prop in target)) target[prop] = () => undefined;
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    });

    this.canvasAdapter = {
      getContext: () => mockContext,
      getRandomSpawnPoint: () => ({ x: 100, y: 100, angle: 0 }),
      getSize: () => ({ width: this.width, height: this.height }),
      getWidth: () => this.width,
      getHeight: () => this.height,
      getScale: () => 1,
      getFontSize: (divisor = 50) => this.height / divisor,
      getCenter: () => ({ x: this.width / 2, y: this.height / 2 }),
      clampPosition: (pos) => ({
        x: Math.max(0, Math.min(pos.x, this.width - (pos.width || 0))),
        y: Math.max(0, Math.min(pos.y, this.height - (pos.height || 0)))
      }),
      resize: (level) => {
        this.width = Math.min(1200, 600 + level * 10);
        this.height = Math.min(800, 400 + level * 10);
        return { width: this.width, height: this.height };
      },
      clientToCanvasCoordinates: (clientX, clientY) => {
        const canvas = this.canvasAdapter.getCanvas();
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return null;
        }

        return {
          x: ((clientX - rect.left) * canvas.width) / rect.width,
          y: ((clientY - rect.top) * canvas.height) / rect.height
        };
      }
    };

    this.matchManager = {
      gameTime: 0,
      update: () => {},
      match: 1
    };

    this.scoreManager = new ScoreManager({ eventBus: this.eventBus });

    this.particles = {
      particles: [],
      powerUpBurst: () => {},
      showFloatingText: (x, y, text, color) => {
        this.particles.particles.push({ text, x, y, color });
      }
    };

    this.spatialGrid = {
      clear: () => {},
      insert: () => {},
      query: () => this.enemies
    };

    this.enemies = [];
    this.powerups = [];

    this.listeners = {};
    this.canvasAdapter.getCanvas = () => ({
      width: this.width,
      height: this.height,
      getBoundingClientRect: () => ({ width: this.width, height: this.height, left: 0, top: 0 }),
      addEventListener: (type, fn) => {
        (this.listeners[type] ||= []).push(fn);
      },
      removeEventListener: () => {}
    });

    this.canvasAdapter.getCanvas().addEventListener("pointerdown", event => this.handlePointerDown(event));
  }

  handlePointerDown(event) {
    if (this.matchManager.paused || !this.progressManager?.isTeamChosen()) {
      return;
    }

    const coords = this.canvasAdapter.clientToCanvasCoordinates(event.clientX, event.clientY);
    if (!coords) {
      return;
    }

    const clicked = this.powerups.find(p => this._isPowerupClicked(p, coords.x, coords.y));
    clicked?.applyForClick(this.progressManager.selectedTeam);
  }

  _isPowerupClicked(powerup, pointerX, pointerY) {
    if (powerup.dead || powerup.isExpired()) {
      return false;
    }

    const centerX = powerup.x + powerup.width / 2;
    const centerY = powerup.y + powerup.height / 2;
    const radius = powerup.width * (this.progressManager?.getCollectRadiusMultiplier?.() || 1);

    return CollisionDetector.isPointInsideCircle(pointerX, pointerY, centerX, centerY, radius);
  }

  _get(prop, fallback) {
    return (this.entityManager ? this.entityManager[prop] : this[`_${prop}`]) ?? fallback;
  }

  _set(prop, val) {
    if (this.entityManager) {
      this.entityManager[prop] = val;
    } else {
      this[`_${prop}`] = val;
    }
  }

  get powerupTimer() { return this._get("powerupTimer", 0); }
  set powerupTimer(val) { this._set("powerupTimer", val); }

  get enemies() { return this._get("enemies", []); }
  set enemies(val) { this._set("enemies", val); }

  get powerups() { return this._get("powerups", []); }
  set powerups(val) { this._set("powerups", val); }

  destroy() {
    this.destroyed = true;
  }

  update(deltaTime) {
    const activeEnemies = [...this.enemies];
    for (const enemy of this.enemies) {
      enemy.update?.(deltaTime, activeEnemies);
    }
    for (const powerup of this.powerups) {
      powerup.update?.(deltaTime);
    }
  }
}
