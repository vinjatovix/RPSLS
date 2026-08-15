/**
 * progress-validation.test.mjs - Verifies the ProgressManager anti-hack
 * barrier:
 *   - exposed getters, #private fields not modifiable from outside
 *   - awardCredits/spendCredits reject invalid input
 *   - the economy DOES NOT change: kill = 2 credits, match-win = 10+match+(mvp?5:0)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { Game } from "../src/index.js";

function makeProgress() {
  const progressManager = new Game({ startLevel: 0 }).progressManager;
  progressManager.reset();
  progressManager.selectTeam("rocks");
  return progressManager;
}

test("exposed getters and #private fields are not own properties", () => {
  const progressManager = makeProgress();
  assert.equal(progressManager.credits, 0);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.teamChosen, true);
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "credits"), undefined, "credits is not an own property");
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "selectedTeam"), undefined, "selectedTeam is not an own property");
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "teamChosen"), undefined, "teamChosen is not an own property");
  assert.throws(() => {
    progressManager.credits = 999;
  }, "writing credits from outside throws (getter-only)");
});

test("awardCredits rejects invalid input", () => {
  const progressManager = makeProgress();
  const before = progressManager.credits;
  progressManager.awardCredits(-5);
  assert.equal(progressManager.credits, before, "awardCredits(-5) ignored");
  progressManager.awardCredits(NaN);
  assert.equal(progressManager.credits, before, "awardCredits(NaN) ignored");
  progressManager.awardCredits(Infinity);
  assert.equal(progressManager.credits, before, "awardCredits(Infinity) ignored");
  progressManager.awardCredits("100");
  assert.equal(progressManager.credits, before, "awardCredits('100') ignored");
});

test("spendCredits rejects invalid input", () => {
  const progressManager = makeProgress();
  assert.equal(progressManager.spendCredits(-1), false, "spendCredits(-1) rejected");
  assert.equal(progressManager.spendCredits(NaN), false, "spendCredits(NaN) rejected");
  assert.equal(progressManager.spendCredits(Infinity), false, "spendCredits(Infinity) rejected");
  assert.equal(progressManager.spendCredits(0), true, "spendCredits(0) allowed");
  assert.equal(progressManager.credits, 0, "spendCredits(0) does not deduct");
});

test("economy unchanged: kill and match-win", () => {
  const progressManager = makeProgress();
  progressManager.eventBus.emit("kill", { killerTeam: "rocks" });
  assert.equal(progressManager.credits, 2, "kill by the player's team gives 2 credits");
  progressManager.eventBus.emit("kill", { killerTeam: "lizards" });
  assert.equal(progressManager.credits, 2, "kill by another team gives no credits");

  progressManager.eventBus.emit("match-win", { team: "rocks", match: 3, mvp: true });
  assert.equal(progressManager.credits, 2 + 10 + 3 + 5, "match-win = 10+match+(mvp?5:0)");
  progressManager.eventBus.emit("match-win", { team: "rocks", match: 4, mvp: false });
  assert.equal(progressManager.credits, 2 + 10 + 3 + 5 + 10 + 4, "match-win without mvp adds 10+match");
});

test("reset() returns to the initial state and clears upgrades", () => {
  const progressManager = makeProgress();
  progressManager.awardCredits(500);
  progressManager.buyUpgrade("powerupLuck");
  assert.equal(progressManager.credits, 500 - 30, "buying deducts the base cost");
  assert.equal(progressManager.getPowerupLuck(), 1.05);
  progressManager.reset();
  assert.equal(progressManager.credits, 0);
  assert.equal(progressManager.teamChosen, false);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.getPowerupLuck(), 1);
});
