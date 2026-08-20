import assert from "node:assert/strict";
import { test } from "node:test";

import { RACE_STATS, UPGRADES } from "../../src/config/gameConfig.js";
import { ProgressManager } from "../../src/meta/ProgressManager.js";
import { FakeLocalStorageAdapter } from "../../src/testing/FakeAdapters.js";
import { FakeEventBus } from "../doubles/FakeEventBus.mjs";

function createProgressManager({
  eventBus = new FakeEventBus(),
  upgrades = UPGRADES,
  storageAdapter = new FakeLocalStorageAdapter(),
  selectTeam = "rocks",
  reset = true,
  logger
} = {}) {
  const progressManager = new ProgressManager({
    eventBus,
    raceStats: RACE_STATS,
    upgrades,
    storageAdapter,
    logger
  });

  if (reset) {
    progressManager.reset();
  }
  if (selectTeam) {
    progressManager.selectTeam(selectTeam);
  }

  return progressManager;
}

const CUSTOM_LUCK_UPGRADES = {
  customLuck: {
    label: "Custom Luck",
    emoji: "🍀",
    description: "Increase powerup luck custom",
    baseCost: 10,
    costGrowth: 1.5,
    perRace: false
  }
};

const CUSTOM_SPEED_UPGRADES = {
  customSpeed: {
    label: "Custom Speed Upgrade",
    emoji: "⚡",
    description: "Increase team speed custom",
    baseCost: 25,
    costGrowth: 2.0,
    perRace: true
  }
};

test("progress: initial state returns default values", () => {
  const progressManager = createProgressManager();
  const initialCredits = 0;

  assert.equal(progressManager.credits, initialCredits);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.teamChosen, true);
});

test("progress: private state is not exposed as own properties", () => {
  const progressManager = createProgressManager();

  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "credits"), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "selectedTeam"), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(progressManager, "teamChosen"), undefined);
});

test("progress: credits getter is read-only", () => {
  const progressManager = createProgressManager();
  const targetCreditsValue = 999;

  assert.throws(() => {
    progressManager.credits = targetCreditsValue;
  });
});

test("awardCredits: negative credits awards are ignored", () => {
  const progressManager = createProgressManager();
  const beforeCredits = progressManager.credits;
  const negativeCredits = -5;

  progressManager.awardCredits(negativeCredits);

  assert.equal(progressManager.credits, beforeCredits);
});

test("awardCredits: NaN credits awards are ignored", () => {
  const progressManager = createProgressManager();
  const beforeCredits = progressManager.credits;

  progressManager.awardCredits(NaN);

  assert.equal(progressManager.credits, beforeCredits);
});

test("awardCredits: Infinity credits awards are ignored", () => {
  const progressManager = createProgressManager();
  const beforeCredits = progressManager.credits;

  progressManager.awardCredits(Infinity);

  assert.equal(progressManager.credits, beforeCredits);
});

test("awardCredits: string credits awards are ignored", () => {
  const progressManager = createProgressManager();
  const beforeCredits = progressManager.credits;
  const stringCredits = "100";

  progressManager.awardCredits(stringCredits);

  assert.equal(progressManager.credits, beforeCredits);
});

test("spendCredits: negative credits spending is rejected", () => {
  const progressManager = createProgressManager();
  const negativeCreditsToSpend = -1;

  const result = progressManager.spendCredits(negativeCreditsToSpend);

  assert.equal(result, false);
});

test("spendCredits: NaN credits spending is rejected", () => {
  const progressManager = createProgressManager();

  const result = progressManager.spendCredits(NaN);

  assert.equal(result, false);
});

test("spendCredits: Infinity credits spending is rejected", () => {
  const progressManager = createProgressManager();

  const result = progressManager.spendCredits(Infinity);

  assert.equal(result, false);
});

test("spendCredits: zero credits spending is allowed and does not deduct credits", () => {
  const progressManager = createProgressManager();
  const zeroCreditsToSpend = 0;

  const result = progressManager.spendCredits(zeroCreditsToSpend);

  assert.equal(result, true);
  assert.equal(progressManager.credits, zeroCreditsToSpend);
});

test("economy: kill by the selected team awards credits", () => {
  const progressManager = createProgressManager();
  const creditsPerKill = 2;

  progressManager.eventBus.emit("kill", { killerTeam: "rocks" });

  assert.equal(progressManager.credits, creditsPerKill);
});

test("economy: kill by an opposing team awards no credits", () => {
  const progressManager = createProgressManager();
  const initialCredits = progressManager.credits;

  progressManager.eventBus.emit("kill", { killerTeam: "lizards" });

  assert.equal(progressManager.credits, initialCredits);
});

test("economy: match-win by the selected team awards base credits plus match number", () => {
  const progressManager = createProgressManager();
  const baseWinCredits = 10;
  const matchNumber = 4;

  progressManager.eventBus.emit("match-win", { team: "rocks", match: matchNumber, mvp: false });

  const expectedCredits = baseWinCredits + matchNumber;
  assert.equal(progressManager.credits, expectedCredits);
});

test("economy: match-win with MVP awards an additional bonus", () => {
  const progressManager = createProgressManager();
  const baseWinCredits = 10;
  const mvpBonusCredits = 5;
  const matchNumber = 3;

  progressManager.eventBus.emit("match-win", { team: "rocks", match: matchNumber, mvp: true });

  const expectedCredits = baseWinCredits + matchNumber + mvpBonusCredits;
  assert.equal(progressManager.credits, expectedCredits);
});

test("progress: buying an upgrade deducts cost and increases stat level", () => {
  const progressManager = createProgressManager();
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
  const progressManager = createProgressManager();
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

test("progress: custom global upgrades start at level zero with base cost", () => {
  const progressManager = createProgressManager({ upgrades: CUSTOM_LUCK_UPGRADES, reset: false });

  assert.equal(progressManager.getUpgradeLevel("customLuck"), 0);
  assert.equal(progressManager.getUpgradeCost("customLuck"), 10);
});

test("progress: buying custom global upgrade increases level, grows cost, and deducts credits", () => {
  const eventBus = new FakeEventBus();
  const progressManager = createProgressManager({
    eventBus,
    upgrades: CUSTOM_LUCK_UPGRADES,
    reset: false
  });
  progressManager.awardCredits(100);

  const purchaseSuccess = progressManager.buyUpgrade("customLuck");

  assert.ok(purchaseSuccess);
  assert.equal(progressManager.getUpgradeLevel("customLuck"), 1);
  assert.equal(progressManager.getUpgradeCost("customLuck"), 15);
  assert.equal(progressManager.credits, 100 - 10);
});

test("progress: custom per-race upgrades start at level zero with base cost", () => {
  const progressManager = createProgressManager({ upgrades: CUSTOM_SPEED_UPGRADES, reset: false });

  assert.equal(progressManager.getUpgradeLevel("customSpeed", "rocks"), 0);
  assert.equal(progressManager.getUpgradeCost("customSpeed", "rocks"), 25);
});

test("progress: buying custom per-race upgrade increases level, grows cost, and deducts credits", () => {
  const progressManager = createProgressManager({ upgrades: CUSTOM_SPEED_UPGRADES, reset: false });
  progressManager.awardCredits(100);

  const purchaseSuccess = progressManager.buyUpgrade("customSpeed", "rocks");

  assert.ok(purchaseSuccess);
  assert.equal(progressManager.getUpgradeLevel("customSpeed", "rocks"), 1);
  assert.equal(progressManager.getUpgradeCost("customSpeed", "rocks"), 50);
  assert.equal(progressManager.credits, 100 - 25);
});

test("progress: selectTeam saves selected team and sets teamChosen flag in storageAdapter", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  progressManager.selectTeam("papers");

  const savedData = storageAdapter.load("game-progress");
  assert.equal(savedData.selectedTeam, "papers");
  assert.equal(savedData.teamChosen, true);
});

test("progress: awardCredits saves updated credits to storageAdapter when match is inactive", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  progressManager.awardCredits(100);

  const savedData = storageAdapter.load("game-progress");
  assert.equal(savedData.credits, 100);
});

test("progress: buyUpgrade saves upgrades and remaining credits to storageAdapter", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });
  progressManager.awardCredits(100);

  progressManager.buyUpgrade("powerupLuck");

  const savedData = storageAdapter.load("game-progress");
  assert.equal(savedData.upgrades.powerupLuck, 1);
  assert.equal(savedData.credits, 100 - UPGRADES.powerupLuck.baseCost);
});

test("progress: loadProgress restores valid state on initialization", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const testData = {
    credits: 150,
    selectedTeam: "lizards",
    teamChosen: true,
    upgrades: {
      powerupLuck: 3
    },
    raceUpgrades: {
      lizards: {
        health: 2
      }
    }
  };

  storageAdapter.save(testData, "game-progress");

  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  assert.equal(progressManager.credits, 150);
  assert.equal(progressManager.selectedTeam, "lizards");
  assert.equal(progressManager.teamChosen, true);
  assert.equal(progressManager.getUpgradeLevel("powerupLuck"), 3);
  assert.equal(progressManager.getUpgradeLevel("health", "lizards"), 2);
});

test("progress: loadProgress falls back to defaults on corrupted schema values", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const corruptedData = {
    credits: "one hundred",
    selectedTeam: "nonexistent-team",
    teamChosen: "yes",
    upgrades: [1, 2, 3],
    raceUpgrades: "all upgraded"
  };

  storageAdapter.save(corruptedData, "game-progress");

  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  assert.equal(progressManager.credits, 0);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.teamChosen, false);
  assert.equal(progressManager.getUpgradeLevel("powerupLuck"), 0);
});

test("progress: loadProgress catches exceptions, clears storage, and falls back gracefully", () => {
  const eventBus = new FakeEventBus();
  let clearCalled = false;
  let saveCalled = false;
  const storageAdapter = {
    load() {
      throw new Error("Disk read error");
    },
    clear(key) {
      if (key === "game-progress") {
        clearCalled = true;
      }
    },
    save(data, key) {
      if (key === "game-progress") {
        saveCalled = true;
      }
    }
  };

  const silentLogger = {
    warn() {}
  };

  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    logger: silentLogger,
    selectTeam: null,
    reset: false
  });

  assert.equal(clearCalled, true);
  assert.equal(saveCalled, true);
  assert.equal(progressManager.credits, 0);
  assert.equal(progressManager.selectedTeam, "rocks");
  assert.equal(progressManager.teamChosen, false);
});

test("progress: awardCredits during active match does not save to storageAdapter", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  storageAdapter.clear("game-progress");
  eventBus.emit("game:match-start", { matchNumber: 1, mode: { isLeague: false } });
  progressManager.awardCredits(50);

  const saved = storageAdapter.load("game-progress");
  assert.equal(saved, null);
});

test("progress: buyUpgrade during active match does not save to storageAdapter", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  storageAdapter.clear("game-progress");
  progressManager.awardCredits(100);
  storageAdapter.clear("game-progress");
  
  eventBus.emit("game:match-start", { matchNumber: 1, mode: { isLeague: false } });
  progressManager.buyUpgrade("powerupLuck");

  const saved = storageAdapter.load("game-progress");
  assert.equal(saved, null);
});

test("progress: saveProgress at end of active match persists final states successfully", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  storageAdapter.clear("game-progress");
  eventBus.emit("game:match-start", { matchNumber: 1, mode: { isLeague: false } });
  progressManager.awardCredits(50);
  progressManager.buyUpgrade("powerupLuck");
  
  eventBus.emit("game:match-end", { match: 1 });
  progressManager.saveProgress();

  const saved = storageAdapter.load("game-progress");
  assert.ok(saved);
  assert.equal(saved.credits, 50 - UPGRADES.powerupLuck.baseCost);
  assert.equal(saved.upgrades.powerupLuck, 1);
});

test("progress: buyUpgrade emits exactly one progress:update event and saves once", () => {
  const eventBus = new FakeEventBus();
  const storageAdapter = new FakeLocalStorageAdapter();
  const progressManager = createProgressManager({
    eventBus,
    storageAdapter,
    selectTeam: null,
    reset: false
  });

  progressManager.awardCredits(200);

  let eventEmitCount = 0;
  eventBus.emit = (event, _data) => {
    if (event === "progress:update") {
      eventEmitCount++;
    }
  };

  let saveCount = 0;
  const originalSave = storageAdapter.save;
  storageAdapter.save = (data, key) => {
    saveCount++;
    originalSave.call(storageAdapter, data, key);
  };

  const success = progressManager.buyUpgrade("powerupLuck");
  assert.ok(success);
  assert.equal(eventEmitCount, 1, "Should emit progress:update exactly once");
  assert.equal(saveCount, 1, "Should save to storageAdapter exactly once");
});

test("progress: getUpgradeLevel and getUpgradeCost handle invalid upgrade keys gracefully", () => {
  const progressManager = createProgressManager();

  assert.equal(progressManager.getUpgradeLevel("invalidKey"), 0);
  assert.equal(progressManager.getUpgradeCost("invalidKey"), 0);
});
