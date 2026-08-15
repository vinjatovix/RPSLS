export class EventBus {
  constructor() {
    this.events = {};
  }

  subscribe(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);

    return () => {
      this.unsubscribe(eventName, callback);
    };
  }

  unsubscribe(eventName, callback) {
    if (!this.events[eventName]) return;

    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);

    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
  }

  emit(eventName, data = null) {
    if (!this.events[eventName]) return;

    this.events[eventName].forEach(callback => {
      callback(data);
    });
  }

  clear() {
    this.events = {};
  }
}
