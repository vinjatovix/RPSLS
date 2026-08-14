/**
 * LocalStorageAdapter - Adaptador de persistencia
 * Responsabilidad única: interactuar con localStorage
 * Principio de Inversión de Dependencias: abstrae localStorage
 */

export class LocalStorageAdapter {
  constructor(key = "gameOptions-v2") {
    this.defaultKey = key;
  }

  /**
   * Guardar datos en localStorage
   * @param {Object} data - Datos a guardar
   * @param {string} [key] - Clave (por defecto usa la del constructor)
   */
  save(data, key = this.defaultKey) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn("Error saving to localStorage:", error);
    }
  }

  /**
   * Cargar datos desde localStorage
   * @param {string} [key] - Clave (por defecto usa la del constructor)
   */
  load(key = this.defaultKey) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn("Error loading from localStorage:", error);
      return null;
    }
  }

  /**
   * Limpiar localStorage
   * @param {string} [key] - Clave (por defecto usa la del constructor)
   */
  clear(key = this.defaultKey) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Error clearing localStorage:", error);
    }
  }
}
