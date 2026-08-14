/**
 * OptionsManager - Gestión centralizada de opciones del juego
 * Responsabilidades:
 * - Mantener estado de opciones (display, mechanics, effects)
 * - Sincronizar input con opciones (observer pattern)
 * - Persistir opciones en storage
 * 
 * Inversión de dependencias:
 * - Recibe InputHandler inyectado (no lo crea)
 * - Recibe Storage inyectado (no accede directamente a localStorage)
 */

export class OptionsManager {
  constructor({ inputHandler, storageAdapter, gameConfig }) {
    this.inputHandler = inputHandler;
    this.storageAdapter = storageAdapter;

    // Copiar config inicial (evitar mutación de config frozen)
    this.display = JSON.parse(JSON.stringify(gameConfig.display));
    this.mechanics = JSON.parse(JSON.stringify(gameConfig.mechanics));
    this.effects = JSON.parse(JSON.stringify(gameConfig.effects));

    // Persistir opciones cuando se togglea una tecla
    this.inputHandler.onToggle = () => this.saveToStorage();

    // Cargar opciones guardadas
    this.loadFromStorage();

    // Sincronizar keys con opciones (evita que update() pise defaults)
    this.syncKeysFromOptions();
  }

  /**
   * Actualizar opciones basado en input
   * Se llama cada frame
   */
  update() {
    const keys = this.inputHandler.getKeys();

    // Mapear teclas a opciones
    this.display.persist = keys.x;
    this.effects.debug = keys.d;
    this.effects.collider = keys.d;
    this.effects.dot = keys.a;
    this.effects.blood = keys.b;
    this.effects.snuff = keys.s;

    this.mechanics.limitCanvas = keys.l;
    this.mechanics.outDies = keys.o;
    this.mechanics.capture = keys.c;
    // this.mechanics.timeless = keys.t; // Comentado en original
  }

  /**
   * Modificar una opción de mecánica
   */
  setMechanic(key, value) {
    if (key in this.mechanics) {
      this.mechanics[key] = value;
    }
  }

  /**
   * Modificar un efecto
   */
  setEffect(key, value) {
    if (key in this.effects) {
      this.effects[key] = value;
    }
  }

  /**
   * Modificar opción de display
   */
  setDisplay(key, value) {
    if (key in this.display) {
      this.display[key] = value;
    }
  }

  /**
   * Guardar opciones en storage
   */
  saveToStorage() {
    this.storageAdapter.save({
      effects: this.effects,
      mechanics: this.mechanics,
      display: this.display
    });
  }

  /**
   * Cargar opciones desde storage
   */
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

  /**
   * Sembrar keys del input desde opciones actuales
   * Mapeo inverso de update(): keys → opciones
   */
  syncKeysFromOptions() {
    this.inputHandler.setKeyState("x", this.display.persist);
    this.inputHandler.setKeyState("d", this.effects.debug);
    this.inputHandler.setKeyState("a", this.effects.dot);
    this.inputHandler.setKeyState("b", this.effects.blood);
    this.inputHandler.setKeyState("s", this.effects.snuff);
    this.inputHandler.setKeyState("l", this.mechanics.limitCanvas);
    this.inputHandler.setKeyState("o", this.mechanics.outDies);
    this.inputHandler.setKeyState("c", this.mechanics.capture);
  }
}
