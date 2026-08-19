import assert from "node:assert/strict";
import { test } from "node:test";

import { UPGRADES } from "../../src/config/gameConfig.js";
import { ProgressManager } from "../../src/meta/ProgressManager.js";
import { FakeEventBus } from "../doubles/FakeEventBus.mjs";

function makeProgress() {
  const progressManager = new ProgressManager({ eventBus: new FakeEventBus() });

  progressManager.reset();
  progressManager.selectTeam("rocks");

  return progressManager;
}

test("progress: initial state returns default values", () => {
  const progressManager = makeProgress();
  const initialCredits = 0;

  assert.equal(progressManager.credits, initialCredits);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.teamChosen, true);
});

test("progress: private state is not exposed as own properties", () => {
  const progressManager = makeProgress();

  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "credits"), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "selectedTeam"), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "teamChosen"), undefined);
});

test("progress: credits getter is read-only", () => {
  const progressManager = makeProgress();
  const targetCreditsValue = 999;

  assert.throws(() => {
    progressManager.credits = targetCreditsValue;
  });
});

test("awardCredits: negative credits awards are ignored", () => {
  const progressManager = makeProgress();
  const beforeCredits = progressManager.credits;
  const negativeCredits = -5;

  progressManager.awardCredits(negativeCredits);

  assert.equal(progressManager.credits, beforeCredits);
});

test("awardCredits: NaN credits awards are ignored", () => {
  const progressManager = makeProgress();
  const beforeCredits = progressManager.credits;

  progressManager.awardCredits(NaN);

  assert.equal(progressManager.credits, beforeCredits);
});

test("awardCredits: Infinity credits awards are ignored", () => {
  const progressManager = makeProgress();
  const beforeCredits = progressManager.credits;

  progressManager.awardCredits(Infinity);

  assert.equal(progressManager.credits, beforeCredits);
});

test("awardCredits: string credits awards are ignored", () => {
  const progressManager = makeProgress();
  const beforeCredits = progressManager.credits;
  const stringCredits = "100";

  progressManager.awardCredits(stringCredits);

  assert.equal(progressManager.credits, beforeCredits);
});

test("spendCredits: negative credits spending is rejected", () => {
  const progressManager = makeProgress();
  const negativeCreditsToSpend = -1;

  const result = progressManager.spendCredits(negativeCreditsToSpend);

  assert.equal(result, false);
});

test("spendCredits: NaN credits spending is rejected", () => {
  const progressManager = makeProgress();

  const result = progressManager.spendCredits(NaN);

  assert.equal(result, false);
});

test("spendCredits: Infinity credits spending is rejected", () => {
  const progressManager = makeProgress();

  const result = progressManager.spendCredits(Infinity);

  assert.equal(result, false);
});

test("spendCredits: zero credits spending is allowed and does not deduct credits", () => {
  const progressManager = makeProgress();
  const zeroCreditsToSpend = 0;

  const result = progressManager.spendCredits(zeroCreditsToSpend);

  assert.equal(result, true);
  assert.equal(progressManager.credits, zeroCreditsToSpend);
});

test("economy: kill by the selected team awards credits", () => {
  const progressManager = makeProgress();
  const creditsPerKill = 2;

  progressManager.eventBus.emit("kill", { killerTeam: "rocks" });

  assert.equal(progressManager.credits, creditsPerKill);
});

test("economy: kill by an opposing team awards no credits", () => {
  const progressManager = makeProgress();
  const initialCredits = progressManager.credits;

  progressManager.eventBus.emit("kill", { killerTeam: "lizards" });

  assert.equal(progressManager.credits, initialCredits);
});

test("economy: match-win by the selected team awards base credits plus match number", () => {
  const progressManager = makeProgress();
  const baseWinCredits = 10;
  const matchNumber = 4;

  progressManager.eventBus.emit("match-win", { team: "rocks", match: matchNumber, mvp: false });

  const expectedCredits = baseWinCredits + matchNumber;
  assert.equal(progressManager.credits, expectedCredits);
});

test("economy: match-win with MVP awards an additional bonus", () => {
  const progressManager = makeProgress();
  const baseWinCredits = 10;
  const mvpBonusCredits = 5;
  const matchNumber = 3;

  progressManager.eventBus.emit("match-win", { team: "rocks", match: matchNumber, mvp: true });

  const expectedCredits = baseWinCredits + matchNumber + mvpBonusCredits;
  assert.equal(progressManager.credits, expectedCredits);
});

test("progress: buying an upgrade deducts cost and increases stat level", () => {
  const progressManager = makeProgress();
  const initialCredits = 500;
  const luckIncrementPerLevel = 0.05;
  const defaultLuckMultiplier = 1;
  const expectedLuckLevel1 = defaultLuckMultiplier + luckIncrementPerLevel;
  const upgradeCost = UPGRADES.powerupLuck.baseCost;

  progressManager.awardCredits(initialCredits);
  progressManager.buyUpgrade("powerupLuck");

  const expectedCreditsAfterPurchase = initialCredits - upgradeCost;
  assert.equal(progressManager.credits, expectedCreditsAfterPurchase);
  assert.equal(progressManager.getPowerupLuck(), expectedLuckLevel1);
});

test("progress: reset clears all credits, upgrades, and team selection", () => {
  const progressManager = makeProgress();
  const initialCredits = 500;

  progressManager.awardCredits(initialCredits);
  progressManager.buyUpgrade("powerupLuck");
  progressManager.reset();

  const resetCredits = 0;
  const defaultLuckMultiplier = 1;
  assert.equal(progressManager.credits, resetCredits);
  assert.equal(progressManager.teamChosen, false);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.getPowerupLuck(), defaultLuckMultiplier);
});
