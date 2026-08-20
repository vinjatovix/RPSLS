import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

import { EventBus } from "../../src/core/EventBus.js";
import { DebugDrawer } from "../../src/ui/DebugDrawer.js";

const subscriptions = [];
const originalSubscribe = EventBus.prototype.subscribe;
EventBus.prototype.subscribe = function(event, callback) {
  subscriptions.push(event);

  return originalSubscribe.call(this, event, callback);
};

let capturedGame = null;
const originalDraw = DebugDrawer.prototype.draw;
DebugDrawer.prototype.draw = function() {
  capturedGame = this.game;

  return originalDraw.apply(this, arguments);
};

function setupDOM() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <canvas id="canvas1"></canvas>
    <div id="score-list"></div>
    <div id="round-info"></div>
    <div id="credits"></div>
    <div id="shop-list"></div>
    <div id="menu-overlay" hidden></div>
    <div id="menu-title"></div>
    <div id="menu-body"></div>
    <div id="menu-actions"></div>
  </body></html>`);

  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;

  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.window.requestAnimationFrame = global.requestAnimationFrame;
  global.window.cancelAnimationFrame = global.cancelAnimationFrame;

  const mockContext = new Proxy({}, {
    get: () => () => undefined
  });
  global.window.HTMLCanvasElement.prototype.getContext = () => mockContext;
  global.window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    left: 0,
    top: 0
  });

  return { dom, window };
}

test("Bootstrap integration tests for src/main.js", async (t) => {
  const { window } = setupDOM();

  t.after(() => {
    EventBus.prototype.subscribe = originalSubscribe;
    DebugDrawer.prototype.draw = originalDraw;

    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Node;
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;

    if (window && typeof window.close === "function") {
      window.close();
    }
  });

  window.__NO_AUTOSTART__ = true;

  await import("../../src/main.js");

  window.__NO_AUTOSTART__ = false;
  const domEvent = new window.Event("DOMContentLoaded");
  window.document.dispatchEvent(domEvent);

  await new Promise((resolve) => setTimeout(resolve, 50));

  await t.test("Verify panels are registered on the eventBus", () => {
    assert.ok(subscriptions.includes("game:match-start"), "InfoPanel should be bound to eventBus");
    assert.ok(subscriptions.includes("tick"), "InfoPanel should be bound to tick events");
    assert.ok(subscriptions.includes("score:update"), "ScorePanel should be bound to score:update");
    assert.ok(subscriptions.includes("progress:update"), "MetaPanel should be bound to progress:update");
  });

  await t.test("Simulate keydown Escape key and check menu visibility", () => {
    const overlay = window.document.getElementById("menu-overlay");
    assert.strictEqual(overlay.hidden, false, "Menu overlay should be visible initially because no team is chosen");

    const escapeEvent = new window.KeyboardEvent("keydown", { key: "Escape" });
    window.dispatchEvent(escapeEvent);

    assert.strictEqual(overlay.hidden, true, "Menu overlay should close on Escape keydown");

    window.dispatchEvent(escapeEvent);
    assert.strictEqual(overlay.hidden, false, "Menu overlay should reopen on duplicate Escape");
  });

  await t.test("Simulate visibilitychange and check game pause/resume behavior", () => {
    assert.ok(capturedGame, "Should have successfully captured the Game instance");

    const overlay = window.document.getElementById("menu-overlay");
    if (!overlay.hidden) {
      const escapeEvent = new window.KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(escapeEvent);
    }
    assert.strictEqual(overlay.hidden, true, "Menu should be closed before testing visibilitychange");

    capturedGame.progressManager.selectTeam("rocks");
    capturedGame.matchManager.paused = false;

    Object.defineProperty(window.document, "hidden", { value: true, configurable: true });
    window.document.dispatchEvent(new window.Event("visibilitychange"));

    assert.strictEqual(capturedGame.matchManager.paused, true, "Game should be paused when document is hidden");

    Object.defineProperty(window.document, "hidden", { value: false, configurable: true });
    window.document.dispatchEvent(new window.Event("visibilitychange"));

    assert.strictEqual(capturedGame.matchManager.paused, false, "Game should resume when document is visible and menu is closed");
  });

  if (capturedGame) {
    capturedGame.destroy();
  }
});
