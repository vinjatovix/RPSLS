/**
 * InputHandler - Gestión de entrada de teclado
 * Responsabilidad única: capturar y exponer estado de teclas
 * 
 * Principio de Inversión de Dependencias:
 * - InputHandler NO modifica opciones directamente
 * - Emite eventos que otros pueden escuchar
 */

export class InputHandler {
  /**
   * @param {Object} options
   * @param {Function} [options.onToggle] - Callback llamado cuando se togglea una tecla
   */
  constructor({ onToggle = null } = {}) {
    this.keys = {};
    this.pressKeys = [];
    this.toggleKeys = ["a", "b", "c", "d", "l", "s", "o", "t", "x"];
    this.onToggle = onToggle;

    // Inicializar todas las teclas
    [...this.pressKeys, ...this.toggleKeys].forEach(key => {
      this.keys[key] = false;
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.boundKeyDown = e => this.handleKeyDown(e);
    this.boundKeyUp = e => this.handleKeyUp(e);
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  /**
   * Eliminar listeners de window para liberar el grafo de objetos
   */
  destroy() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();

    // Teclas de presión (press-and-hold)
    if (this.pressKeys.includes(key)) {
      this.keys[key] = true;
    }

    // Teclas de toggle (encender/apagar)
    if (this.toggleKeys.includes(key)) {
      this.keys[key] = !this.keys[key];
      this.onToggle && this.onToggle(key, this.keys[key]);
    }
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();

    // Solo afecta a teclas de presión
    if (this.pressKeys.includes(key)) {
      this.keys[key] = false;
    }
  }

  /**
   * Obtener estado actual de todas las teclas
   */
  getKeys() {
    return { ...this.keys };
  }

  /**
   * Obtener estado de una tecla específica
   */
  isKeyPressed(key) {
    return this.keys[key.toLowerCase()] || false;
  }

  /**
   * Establecer estado de una tecla (usado para sembrar keys desde config)
   */
  setKeyState(key, value) {
    if (key in this.keys) {
      this.keys[key] = value;
    }
  }
}
