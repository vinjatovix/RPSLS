/**
 * LocalStorageAdapter - Adaptador de persistencia
 * Responsabilidad única: interactuar con localStorage
 * Principio de Inversión de Dependencias: abstrae localStorage
 */

export class LocalStorageAdapter {
  constructor(key = "gameOptions-v2") {
    this.key = key;
  }

  /**
   * Guardar opciones en localStorage
   */
  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      console.warn("Error saving to localStorage:", error);
    }
  }

  /**
   * Cargar opciones desde localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn("Error loading from localStorage:", error);
      return null;
    }
  }

  /**
   * Limpiar localStorage
   */
  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.warn("Error clearing localStorage:", error);
    }
  }
}
