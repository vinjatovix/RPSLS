export class LocalStorageAdapter {
  constructor(key = "game-options-v2") {
    this.defaultKey = key;
  }

  save(data, key = this.defaultKey) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn("Error saving to localStorage:", error);
    }
  }

  load(key = this.defaultKey) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn("Error loading from localStorage:", error);
      return null;
    }
  }

  clear(key = this.defaultKey) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Error clearing localStorage:", error);
    }
  }
}
