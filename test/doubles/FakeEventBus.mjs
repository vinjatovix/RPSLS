import { EventBus } from "../../src/core/EventBus.js";

export class FakeEventBus extends EventBus {
  constructor() {
    super();
    this.emitted = [];
  }

  emit(eventName, data = null) {
    this.emitted.push({ eventName, data });
    super.emit(eventName, data);
  }

  clear() {
    super.clear();
    this.emitted = [];
  }

  getEmitted(eventName) {
    return this.emitted.filter(e => e.eventName === eventName);
  }
}
