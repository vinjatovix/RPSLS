/**
 * EventBus - Sistema de eventos desacoplado
 * Implementa patrón Observer/Pub-Sub
 * Responsabilidad única: notificar eventos a suscriptores
 */

export class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * Suscribir a un evento
   * @param {string} eventName - Nombre del evento
   * @param {Function} callback - Función a ejecutar cuando ocurra el evento
   */
  subscribe(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);

    // Retornar función para desuscribirse
    return () => {
      this.unsubscribe(eventName, callback);
    };
  }

  /**
   * Desuscribir de un evento
   * @param {string} eventName - Nombre del evento
   * @param {Function} callback - Función a remover
   */
  unsubscribe(eventName, callback) {
    if (!this.events[eventName]) return;

    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);

    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
  }

  /**
   * Emitir un evento
   * @param {string} eventName - Nombre del evento
   * @param {*} data - Datos a pasar a los suscriptores
   */
  emit(eventName, data = null) {
    if (!this.events[eventName]) return;

    this.events[eventName].forEach(callback => {
      callback(data);
    });
  }

  /**
   * Limpiar todos los eventos
   */
  clear() {
    this.events = {};
  }
}
