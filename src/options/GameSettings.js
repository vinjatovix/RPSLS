import { clone } from "../core/index.js";

export class GameSettings {
  constructor({ inputHandler, storageAdapter, gameConfig }) {
    this.inputHandler = inputHandler;
    this.storageAdapter = storageAdapter;

    // Copy initial config (avoid mutating the frozen config)
    this.display = clone(gameConfig.display);
    this.mechanics = clone(gameConfig.mechanics);
    this.effects = clone(gameConfig.effects);

    this.inputHandler.onToggle = () => this.saveToStorage();

    this.loadFromStorage();

    this.syncKeysFromOptions();
  }

  update() {
    const keys = this.inputHandler.getKeys();

    this.display.persist = keys.x;
    this.effects.debug = keys.d;
    this.effects.collider = keys.d;
    this.effects.blood = keys.b;
    this.effects.snuff = keys.s;
  }

  setMechanic(key, value) {
    if (key in this.mechanics) {
      this.mechanics[key] = value;
    }
  }

  saveToStorage() {
    this.storageAdapter.save({
      effects: this.effects,
      mechanics: this.mechanics,
      display: this.display
    });
  }

  loadFromStorage() {
    const saved = this.storageAdapter.load();
    if (saved) {
      if (saved.effects) {
        Object.assign(this.effects, saved.effects);
      }
      if (saved.mechanics) {
        Object.assign(this.mechanics, saved.mechanics);
      }
      if (saved.display) {
        Object.assign(this.display, saved.display);
      }
    }
  }

  syncKeysFromOptions() {
    this.inputHandler.setKeyState("x", this.display.persist);
    this.inputHandler.setKeyState("d", this.effects.debug);
    this.inputHandler.setKeyState("b", this.effects.blood);
    this.inputHandler.setKeyState("s", this.effects.snuff);
  }
}
