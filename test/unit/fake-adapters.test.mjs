import assert from "node:assert/strict";
import { test } from "node:test";

import { FakeCanvasAdapter, FakeInputHandler, FakeLocalStorageAdapter } from "../../src/testing/FakeAdapters.js";

test("FakeCanvasAdapter: default dimensions and resize logic", () => {
  const adapter = new FakeCanvasAdapter();

  assert.strictEqual(adapter.getWidth(), 640);
  assert.strictEqual(adapter.getHeight(), 384);

  const factor = 0.003;
  const level = 10;
  const expectedWidth = Math.min(640 + 1280 * 4 * factor * level, 1280 * 4);
  const expectedHeight = Math.min(384 + 768 * 4 * factor * level, 768 * 4);

  const size = adapter.resize(level, factor);

  assert.strictEqual(adapter.getWidth(), expectedWidth);
  assert.strictEqual(adapter.getHeight(), expectedHeight);
  assert.strictEqual(size.width, expectedWidth);
  assert.strictEqual(size.height, expectedHeight);
});

test("FakeCanvasAdapter: clampPosition clamps negative coordinates to zero", () => {
  const adapter = new FakeCanvasAdapter();
  const positionOutsideNegative = { x: -50, y: -50, width: 20, height: 20 };
  
  const clamped = adapter.clampPosition(positionOutsideNegative);
  
  assert.strictEqual(clamped.x, 0);
  assert.strictEqual(clamped.y, 0);
});

test("FakeCanvasAdapter: clampPosition clamps coordinates exceeding canvas boundaries", () => {
  const adapter = new FakeCanvasAdapter();
  const positionExceedingBoundaries = { x: 700, y: 500, width: 30, height: 40 };
  
  const clamped = adapter.clampPosition(positionExceedingBoundaries);
  const expectedMaxX = adapter.getWidth() - positionExceedingBoundaries.width;
  const expectedMaxY = adapter.getHeight() - positionExceedingBoundaries.height;
  
  assert.strictEqual(clamped.x, expectedMaxX);
  assert.strictEqual(clamped.y, expectedMaxY);
});

test("FakeCanvasAdapter: getRandomSpawnPoint respects margins", () => {
  const adapter = new FakeCanvasAdapter();
  const width = adapter.getWidth();
  const height = adapter.getHeight();
  const margin = width / 6;

  for (let i = 0; i < 50; i++) {
    const point = adapter.getRandomSpawnPoint();
    assert.ok(point.x >= margin, `x coordinate ${point.x} is less than margin ${margin}`);
    assert.ok(point.x <= width - margin, `x coordinate ${point.x} is greater than limit ${width - margin}`);
    assert.ok(point.y >= margin, `y coordinate ${point.y} is less than margin ${margin}`);
    assert.ok(point.y <= height - margin, `y coordinate ${point.y} is greater than limit ${height - margin}`);
  }
});

test("FakeLocalStorageAdapter: load returns null for nonexistent keys", () => {
  const storage = new FakeLocalStorageAdapter();
  
  assert.strictEqual(storage.load(), null);
});

test("FakeLocalStorageAdapter: saves and loads data with default key", () => {
  const storage = new FakeLocalStorageAdapter();
  const testData = { foo: "bar", value: 42 };

  storage.save(testData);
  const loaded = storage.load();
  
  assert.deepEqual(loaded, testData);
});

test("FakeLocalStorageAdapter: saves and loads data with custom key", () => {
  const storage = new FakeLocalStorageAdapter();
  const customKey = "custom-key";
  const customData = { hello: "world" };

  storage.save(customData, customKey);
  const loaded = storage.load(customKey);
  
  assert.deepEqual(loaded, customData);
});

test("FakeLocalStorageAdapter: clear removes default key but preserves custom keys", () => {
  const storage = new FakeLocalStorageAdapter();
  const defaultData = { foo: "bar" };
  const customKey = "custom-key";
  const customData = { hello: "world" };

  storage.save(defaultData);
  storage.save(customData, customKey);

  storage.clear();

  assert.strictEqual(storage.load(), null);
  assert.deepEqual(storage.load(customKey), customData);
});

test("FakeLocalStorageAdapter: clear with key removes specific custom key", () => {
  const storage = new FakeLocalStorageAdapter();
  const customKey = "custom-key";
  const customData = { hello: "world" };

  storage.save(customData, customKey);
  storage.clear(customKey);

  assert.strictEqual(storage.load(customKey), null);
});

test("FakeLocalStorageAdapter: ensure getItem, setItem, and removeItem are not exposed", () => {
  const storage = new FakeLocalStorageAdapter();

  assert.strictEqual(storage.getItem, undefined);
  assert.strictEqual(storage.setItem, undefined);
  assert.strictEqual(storage.removeItem, undefined);
});

test("FakeInputHandler: all keys have initial false state", () => {
  const input = new FakeInputHandler();

  assert.deepEqual(input.getKeys(), { b: false, d: false, s: false, x: false });
  assert.strictEqual(input.isKeyPressed("b"), false);
  assert.strictEqual(input.isKeyPressed("B"), false);
});

test("FakeInputHandler: querying non-existing keys returns false", () => {
  const input = new FakeInputHandler();

  assert.strictEqual(input.isKeyPressed("z"), false);
});

test("FakeInputHandler: updating key state updates keys and query status case-insensitively", () => {
  const input = new FakeInputHandler();

  input.setKeyState("b", true);

  assert.strictEqual(input.isKeyPressed("b"), true);
  assert.strictEqual(input.isKeyPressed("B"), true);
  assert.strictEqual(input.getKeys().b, true);
});

test("FakeInputHandler: setting state of a non-existing key is ignored", () => {
  const input = new FakeInputHandler();

  input.setKeyState("z", true);

  assert.strictEqual(input.isKeyPressed("z"), false);
});

test("FakeInputHandler: changing key state triggers onToggle callback", () => {
  let toggleCount = 0;
  let toggledKey = null;
  let toggledValue = null;

  const input = new FakeInputHandler({
    onToggle: (key, value) => {
      toggleCount++;
      toggledKey = key;
      toggledValue = value;
    }
  });

  input.setKeyState("d", true);

  assert.strictEqual(toggleCount, 1);
  assert.strictEqual(toggledKey, "d");
  assert.strictEqual(toggledValue, true);
});

test("FakeInputHandler: setting the same key state does not trigger callback", () => {
  let toggleCount = 0;

  const input = new FakeInputHandler({
    onToggle: () => {
      toggleCount++;
    }
  });

  input.setKeyState("d", true);
  input.setKeyState("d", true);

  assert.strictEqual(toggleCount, 1);
});

test("FakeInputHandler: reverting key state triggers callback again", () => {
  let toggleCount = 0;
  let toggledKey = null;
  let toggledValue = null;

  const input = new FakeInputHandler({
    onToggle: (key, value) => {
      toggleCount++;
      toggledKey = key;
      toggledValue = value;
    }
  });

  input.setKeyState("d", true);
  input.setKeyState("d", false);

  assert.strictEqual(toggleCount, 2);
  assert.strictEqual(toggledKey, "d");
  assert.strictEqual(toggledValue, false);
});

test("FakeInputHandler: updating non-existent key does not trigger callback", () => {
  let toggleCount = 0;

  const input = new FakeInputHandler({
    onToggle: () => {
      toggleCount++;
    }
  });

  input.setKeyState("z", true);

  assert.strictEqual(toggleCount, 0);
});

test("FakeCanvasAdapter: getFontSize calculates size dynamically using height and default divisor", () => {
  const adapter = new FakeCanvasAdapter();
  const defaultDivisor = 50;
  const expectedFontSize = adapter.getHeight() / defaultDivisor;

  assert.strictEqual(adapter.getFontSize(), expectedFontSize);
});

test("FakeCanvasAdapter: getFontSize calculates size dynamically using height and custom divisor", () => {
  const adapter = new FakeCanvasAdapter();
  const customDivisor = 24;
  const expectedFontSize = adapter.getHeight() / customDivisor;

  assert.strictEqual(adapter.getFontSize(customDivisor), expectedFontSize);
});

test("FakeCanvasAdapter: clientToCanvasCoordinates falls back to 1:1 scaling when virtualRect is null", () => {
  const adapter = new FakeCanvasAdapter();
  const clientX = 100;
  const clientY = 150;

  const coordinates = adapter.clientToCanvasCoordinates(clientX, clientY);

  assert.deepEqual(coordinates, { x: clientX, y: clientY });
});

test("FakeCanvasAdapter: clientToCanvasCoordinates scales and offsets coordinates with custom virtualRect", () => {
  const adapter = new FakeCanvasAdapter();
  
  adapter.virtualRect = {
    top: 10,
    left: 20,
    width: 320,
    height: 192
  };

  const clientX = 180;
  const clientY = 106;

  const expectedX = (clientX - adapter.virtualRect.left) * (adapter.getWidth() / adapter.virtualRect.width);
  const expectedY = (clientY - adapter.virtualRect.top) * (adapter.getHeight() / adapter.virtualRect.height);

  const coordinates = adapter.clientToCanvasCoordinates(clientX, clientY);

  assert.deepEqual(coordinates, { x: expectedX, y: expectedY });
});

test("FakeCanvasAdapter: clientToCanvasCoordinates returns null if virtualRect has zero dimension", () => {
  const adapter = new FakeCanvasAdapter();
  
  adapter.virtualRect = { top: 0, left: 0, width: 0, height: 100 };

  const coordinates = adapter.clientToCanvasCoordinates(100, 100);

  assert.strictEqual(coordinates, null);
});
