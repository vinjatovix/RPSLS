import assert from "node:assert/strict";
import { test } from "node:test";

import { CanvasAdapter } from "../../src/canvas/CanvasAdapter.js";
import { InputHandler } from "../../src/input/InputHandler.js";
import { LocalStorageAdapter } from "../../src/storage/LocalStorageAdapter.js";
import { FakeCanvasAdapter, FakeInputHandler, FakeLocalStorageAdapter } from "../../src/testing/FakeAdapters.js";

function getPublicMethods(Class) {
  const methods = Object.getOwnPropertyNames(Class.prototype)
    .filter(name => name !== "constructor" && !name.startsWith("#"));

  return methods;
}

test("API Contract Alignment: FakeCanvasAdapter must align with CanvasAdapter", () => {
  const realMethods = getPublicMethods(CanvasAdapter);
  const fakeMethods = getPublicMethods(FakeCanvasAdapter);

  for (const method of realMethods) {
    assert.ok(
      fakeMethods.includes(method),
      `API Desaligned: FakeCanvasAdapter is missing public method ${method} implemented in CanvasAdapter`
    );

    assert.strictEqual(
      FakeCanvasAdapter.prototype[method].length,
      CanvasAdapter.prototype[method].length,
      `API Desaligned: FakeCanvasAdapter.${method} has different argument count (${FakeCanvasAdapter.prototype[method].length}) than CanvasAdapter.${method} (${CanvasAdapter.prototype[method].length})`
    );
  }
});

test("API Contract Alignment: FakeLocalStorageAdapter must align with LocalStorageAdapter", () => {
  const realMethods = getPublicMethods(LocalStorageAdapter);
  const fakeMethods = getPublicMethods(FakeLocalStorageAdapter);

  for (const method of realMethods) {
    assert.ok(
      fakeMethods.includes(method),
      `API Desaligned: FakeLocalStorageAdapter is missing public method ${method} implemented in LocalStorageAdapter`
    );

    assert.strictEqual(
      FakeLocalStorageAdapter.prototype[method].length,
      LocalStorageAdapter.prototype[method].length,
      `API Desaligned: FakeLocalStorageAdapter.${method} has different argument count (${FakeLocalStorageAdapter.prototype[method].length}) than LocalStorageAdapter.${method} (${LocalStorageAdapter.prototype[method].length})`
    );
  }
});

test("API Contract Alignment: FakeInputHandler must align with InputHandler", () => {
  const realMethods = getPublicMethods(InputHandler);
  const fakeMethods = getPublicMethods(FakeInputHandler);

  for (const method of realMethods) {
    assert.ok(
      fakeMethods.includes(method),
      `API Desaligned: FakeInputHandler is missing public method ${method} implemented in InputHandler`
    );

    assert.strictEqual(
      FakeInputHandler.prototype[method].length,
      InputHandler.prototype[method].length,
      `API Desaligned: FakeInputHandler.${method} has different argument count (${FakeInputHandler.prototype[method].length}) than InputHandler.${method} (${InputHandler.prototype[method].length})`
    );
  }
});
