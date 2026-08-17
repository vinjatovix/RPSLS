/**
 * powerup-click.test.mjs - Verifies the click flow: pointerdown on a
 * power-up collects it; positives affect the player's team and traps
 * (negatives) affect all other teams. Covers ALL types.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";

const listeners = {};
const canvas = {
  style: {},
  width: 640,
  height: 384,
  listeners,
  addEventListener(type, fn) {
    (listeners[type] ||= []).push(fn);
  },
  removeEventListener() {},
  getContext() {
    return { canvas, fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, translate() {}, scale() {}, fillText() {}, strokeText() {}, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalAlpha(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {} };
  },
  getBoundingClientRect() {
    return { width: 640, height: 384, left: 0, top: 0 };
  }
};

const prevGetElementById = document.getElementById;
document.getElementById = id => (id === "canvas1" ? canvas : prevGetElementById(id));

const { Game } = await import("../src/index.js");
const { PowerUp } = await import("../src/entities/PowerUp.js");
const { POWERUP_TYPES } = await import("../src/config/gameConfig.js");

test("click on power-up: collects per team, positives to MY team and traps to OTHERS", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  let goldGot = null;
  game.progressManager.awardCredits = v => {
    goldGot = v;
  };
  game.matchManager.match = 0;
  game.onTeamChanged();
  game.powerupTimer = Infinity;

  const rect = canvas.getBoundingClientRect();
  const clickAt = p => {
    const clientX = (p.x + p.width / 2) * (rect.width / canvas.width) + rect.left;
    const clientY = (p.y + p.height / 2) * (rect.height / canvas.height) + rect.top;
    listeners.pointerdown[0]({ clientX, clientY });
  };

  assert.ok(listeners.pointerdown?.length > 0, "there must be a pointerdown listener on the canvas");

  const types = Object.entries(POWERUP_TYPES);
  let idx = 0;
  for (const [key, config] of types) {
    const p = new PowerUp({ game });
    p.type = key;
    p.x = 80 + (idx % 10) * 45;
    p.y = 120 + Math.floor(idx / 10) * 45;
    p.velocityX = 0;
    p.velocityY = 0;
    game.powerups = [p];

    game.enemies.forEach(e => {
      e.buffs = {};
    });
    const rocks = game.enemies.filter(e => e.team === "rocks");
    rocks.forEach(r => {
      r.life = Math.floor(r.maxLife / 2);
    });
    const rocksBefore = rocks.map(r => r.life);
    const othersBefore = game.enemies.filter(e => e.team !== "rocks").map(e => e.life);
    const tlBefore = game.matchManager.timeLeft;
    goldGot = null;

    clickAt(p);

    assert.ok(p.dead, `${key}: click must consume the power-up`);
    assert.ok(
      game.particles.particles.some(part => part.text === config.label),
      `${key}: click must show floating text "${config.label}"`
    );

    if (config.trap) {
      assert.ok(
        rocks.every((r, i) => !r.isBuffActive(key) && r.life === rocksBefore[i]),
        `${key}: the trap must NOT affect MY team`
      );
      const othersNow = game.enemies.filter(e => e.team !== "rocks").map(e => e.life);
      if (key === "zap") {
        assert.ok(
          othersNow.some((life, i) => life < othersBefore[i]),
          "zap: the trap must reduce life of OTHER teams"
        );
      } else {
        assert.ok(
          game.enemies.some(e => e.team !== "rocks" && !e.dead && e.isBuffActive(key)),
          `${key}: the trap must affect OTHER teams`
        );
      }
    } else {
      switch (key) {
        case "heal":
          assert.ok(
            rocks.every(r => r.life === r.maxLife),
            `heal: must always heal to 100% (${rocks.map(r => `${r.life}/${r.maxLife}`).join(", ")})`
          );
          break;
        case "time":
          assert.equal(game.matchManager.timeLeft, tlBefore + config.amount, "time: must add time to the match");
          break;
        case "gold":
          assert.ok(goldGot !== null && goldGot >= 5 && goldGot <= 25, `gold: must give 5-25 credits (got ${goldGot})`);
          break;
        default:
          assert.ok(
            rocks.some(r => r.isBuffActive(key)),
            `${key}: the positive must apply a buff to MY team`
          );
      }
    }
    idx++;
  }

  const far = new PowerUp({ game });
  far.x = 600;
  far.y = 340;
  far.velocityX = 0;
  far.velocityY = 0;
  game.powerups = [far];
  const farX = 100 * (rect.width / canvas.width) + rect.left;
  const farY = 100 * (rect.height / canvas.height) + rect.top;
  listeners.pointerdown[0]({ clientX: farX, clientY: farY });
  assert.ok(!far.dead, "click far from the power-up must NOT collect it");

  game.destroy();
});
