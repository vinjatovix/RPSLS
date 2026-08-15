
export class InputHandler {
  constructor({ onToggle = null } = {}) {
    this.keys = {};
    this.pressKeys = [];
    this.toggleKeys = ["b", "d", "s", "x"];
    this.onToggle = onToggle;

    [...this.pressKeys, ...this.toggleKeys].forEach(key => {
      this.keys[key] = false;
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.boundKeyDown = event => this.handleKeyDown(event);
    this.boundKeyUp = event => this.handleKeyUp(event);
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  destroy() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();

    if (this.pressKeys.includes(key)) {
      this.keys[key] = true;
    }

    if (this.toggleKeys.includes(key)) {
      this.keys[key] = !this.keys[key];
      this.onToggle && this.onToggle(key, this.keys[key]);
    }
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();

    if (this.pressKeys.includes(key)) {
      this.keys[key] = false;
    }
  }

  getKeys() {
    return { ...this.keys };
  }

  isKeyPressed(key) {
    return this.keys[key.toLowerCase()] || false;
  }

  setKeyState(key, value) {
    if (key in this.keys) {
      this.keys[key] = value;
    }
  }
}
