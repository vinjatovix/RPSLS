import assert from "node:assert/strict";
import { test } from "node:test";

import { LocalStorageAdapter } from "../../src/storage/LocalStorageAdapter.js";

test("LocalStorageAdapter: saves and loads objects successfully", () => {
  const mockStore = new Map();
  globalThis.localStorage = {
    setItem: (key, val) => mockStore.set(key, val),
    getItem: (key) => mockStore.get(key) ?? null,
    removeItem: (key) => mockStore.delete(key)
  };
  try {
    const adapter = new LocalStorageAdapter("test-key");
    const testData = { credits: 100, team: "rocks" };
    adapter.save(testData);

    const loaded = adapter.load();

    assert.deepEqual(loaded, testData);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: load returns null when key does not exist", () => {
  const mockStore = new Map();
  globalThis.localStorage = {
    getItem: (key) => mockStore.get(key) ?? null
  };
  try {
    const adapter = new LocalStorageAdapter("nonexistent-key");

    const loaded = adapter.load();

    assert.equal(loaded, null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: clear removes the specified key", () => {
  const mockStore = new Map();
  mockStore.set("test-key", JSON.stringify({ a: 1 }));
  globalThis.localStorage = {
    getItem: (key) => mockStore.get(key) ?? null,
    removeItem: (key) => mockStore.delete(key)
  };
  try {
    const adapter = new LocalStorageAdapter("test-key");

    adapter.clear();

    const loaded = adapter.load();
    assert.equal(loaded, null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: handles setItem exceptions by throwing", () => {
  globalThis.localStorage = {
    setItem: () => {
      throw new Error("QuotaExceededError");
    }
  };
  try {
    const adapter = new LocalStorageAdapter("test-key");

    assert.throws(() => {
      adapter.save({ credits: 50 });
    }, /QuotaExceededError/);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: handles getItem exceptions by throwing", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    }
  };
  try {
    const adapter = new LocalStorageAdapter("test-key");

    assert.throws(() => {
      adapter.load();
    }, /SecurityError/);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: handles removeItem exceptions by throwing", () => {
  globalThis.localStorage = {
    removeItem: () => {
      throw new Error("SecurityError");
    }
  };
  try {
    const adapter = new LocalStorageAdapter("test-key");

    assert.throws(() => {
      adapter.clear();
    }, /SecurityError/);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: prevents casual tampering of saved data", () => {
  const mockStore = new Map();
  globalThis.localStorage = {
    setItem: (key, val) => mockStore.set(key, val),
    getItem: (key) => mockStore.get(key) ?? null,
    removeItem: (key) => mockStore.delete(key)
  };
  try {
    const adapter = new LocalStorageAdapter("test-key");
    const testData = { credits: 42, selectedTeam: "spocks" };
    
    adapter.save(testData);
    const rawSavedValue = mockStore.get("test-key");
    assert.ok(rawSavedValue);
    assert.notEqual(rawSavedValue, JSON.stringify(testData), "Saved value in localStorage must be obfuscated, not raw JSON");

    const loaded = adapter.load();
    assert.deepEqual(loaded, testData);

    const tamperedValue = rawSavedValue.slice(0, -1) + (rawSavedValue.slice(-1) === "A" ? "B" : "A");
    mockStore.set("test-key", tamperedValue);

    assert.throws(() => {
      adapter.load();
    });
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: exports and imports saves correctly", () => {
  const mockStore = new Map();
  globalThis.localStorage = {
    setItem: (key, val) => mockStore.set(key, val),
    getItem: (key) => mockStore.get(key) ?? null,
    removeItem: (key) => mockStore.delete(key)
  };
  try {
    const adapter = new LocalStorageAdapter();
    
    const gameState = { match: 12, modeKey: "infinite-capture" };
    const progressState = { credits: 250, selectedTeam: "lizards" };
    
    adapter.save(gameState, "active-game-state");
    adapter.save(progressState, "game-progress");

    const exportedContent = adapter.exportSave();
    assert.ok(exportedContent);
    assert.equal(typeof exportedContent, "string");

    adapter.clear("active-game-state");
    adapter.clear("game-progress");
    assert.equal(adapter.load("active-game-state"), null);
    assert.equal(adapter.load("game-progress"), null);

    const importSuccess = adapter.importSave(exportedContent);
    assert.ok(importSuccess);

    const restoredGameState = adapter.load("active-game-state");
    const restoredProgressState = adapter.load("game-progress");

    assert.deepEqual(restoredGameState, gameState);
    assert.deepEqual(restoredProgressState, progressState);
  } finally {
    delete globalThis.localStorage;
  }
});

test("LocalStorageAdapter: rejects importing tampered save files", () => {
  const mockStore = new Map();
  globalThis.localStorage = {
    setItem: (key, val) => mockStore.set(key, val),
    getItem: (key) => mockStore.get(key) ?? null,
    removeItem: (key) => mockStore.delete(key)
  };
  try {
    const adapter = new LocalStorageAdapter();
    adapter.save({ match: 5 }, "active-game-state");
    adapter.save({ credits: 10 }, "game-progress");

    const validExport = adapter.exportSave();
    
    const tamperedExport = validExport.slice(0, 10) + "X" + validExport.slice(11);

    adapter.clear("active-game-state");
    adapter.clear("game-progress");

    assert.throws(() => {
      adapter.importSave(tamperedExport);
    });
  } finally {
    delete globalThis.localStorage;
  }
});
