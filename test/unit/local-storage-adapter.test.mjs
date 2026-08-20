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
  const adapter = new LocalStorageAdapter("test-key");
  const testData = { credits: 100, team: "rocks" };
  adapter.save(testData);

  const loaded = adapter.load();

  delete globalThis.localStorage;
  assert.deepEqual(loaded, testData);
});

test("LocalStorageAdapter: load returns null when key does not exist", () => {
  const mockStore = new Map();
  globalThis.localStorage = {
    getItem: (key) => mockStore.get(key) ?? null
  };
  const adapter = new LocalStorageAdapter("nonexistent-key");

  const loaded = adapter.load();

  delete globalThis.localStorage;
  assert.equal(loaded, null);
});

test("LocalStorageAdapter: clear removes the specified key", () => {
  const mockStore = new Map();
  mockStore.set("test-key", JSON.stringify({ a: 1 }));
  globalThis.localStorage = {
    getItem: (key) => mockStore.get(key) ?? null,
    removeItem: (key) => mockStore.delete(key)
  };
  const adapter = new LocalStorageAdapter("test-key");

  adapter.clear();

  const loaded = adapter.load();
  delete globalThis.localStorage;
  assert.equal(loaded, null);
});

test("LocalStorageAdapter: handles setItem exceptions gracefully", () => {
  const originalWarn = console.warn;
  let warnLogged = false;
  console.warn = () => { warnLogged = true; };
  globalThis.localStorage = {
    setItem: () => {
      throw new Error("QuotaExceededError");
    }
  };
  const adapter = new LocalStorageAdapter("test-key");

  adapter.save({ credits: 50 });

  console.warn = originalWarn;
  delete globalThis.localStorage;
  assert.ok(warnLogged);
});

test("LocalStorageAdapter: handles getItem exceptions gracefully", () => {
  const originalWarn = console.warn;
  let warnLogged = false;
  console.warn = () => { warnLogged = true; };
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    }
  };
  const adapter = new LocalStorageAdapter("test-key");

  const loaded = adapter.load();

  console.warn = originalWarn;
  delete globalThis.localStorage;
  assert.equal(loaded, null);
  assert.ok(warnLogged);
});

test("LocalStorageAdapter: handles removeItem exceptions gracefully", () => {
  const originalWarn = console.warn;
  let warnLogged = false;
  console.warn = () => { warnLogged = true; };
  globalThis.localStorage = {
    removeItem: () => {
      throw new Error("SecurityError");
    }
  };
  const adapter = new LocalStorageAdapter("test-key");

  adapter.clear();

  console.warn = originalWarn;
  delete globalThis.localStorage;
  assert.ok(warnLogged);
});
