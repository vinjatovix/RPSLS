import "./dom-stub.js";
import { RACE_STATS } from "../src/config/gameConfig.js";
import { runCampaign, aggregateRuns } from "../src/testing/balanceRunner.js";
import { TICK_MS } from "./doubles/setupSimulationContext.mjs";

const LABEL_COLUMN_WIDTH = 35;
const TEAM_COLUMN_WIDTH = 10;

const TEAM_NAMES = Object.keys(RACE_STATS);
const baseRaceStatsBackup = JSON.parse(JSON.stringify(RACE_STATS));

function parseArguments() {
  const runsArg = process.argv[2];
  const levelsArg = process.argv[3];
  const comboArgs = process.argv.slice(4);

  if (!runsArg || !levelsArg || comboArgs.length === 0) {
    console.error("\nUsage: node test/check-combo.mjs <runs> <levels> '<json_patch>' ['<json_patch>' ...]");
    console.error("\nExample:");
    console.error("  node test/check-combo.mjs 15 100 '{\"rocks\": {\"health\": {\"max\": 600}}}'\n");
    process.exit(1);
  }

  const runs = parseInt(runsArg, 10);
  const levels = parseInt(levelsArg, 10);

  if (isNaN(runs) || runs <= 0) {
    console.error(`Error: Invalid number of runs: "${runsArg}". Must be a positive integer.`);
    process.exit(1);
  }
  if (isNaN(levels) || levels <= 0) {
    console.error(`Error: Invalid number of levels: "${levelsArg}". Must be a positive integer.`);
    process.exit(1);
  }

  const parsedCombos = comboArgs.map((comboStr, index) => {
    try {
      return JSON.parse(comboStr);
    } catch (err) {
      console.error(`Error: Failed to parse JSON for combination argument #${index + 1}: "${comboStr}"`);
      console.error(`Details: ${err.message}`);
      process.exit(1);
    }
  });

  return { runs, levels, combos: parsedCombos };
}

function applyConfigurationPatch(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    const isNestedObject = value && typeof value === "object" && !Array.isArray(value);
    if (isNestedObject) {
      if (!target[key]) {
        target[key] = {};
      }
      applyConfigurationPatch(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function restoreBaseConfiguration() {
  for (const teamName of TEAM_NAMES) {
    const originalTeamStats = JSON.parse(JSON.stringify(baseRaceStatsBackup[teamName]));
    applyConfigurationPatch(RACE_STATS[teamName], originalTeamStats);
  }
}

async function simulateCampaignBatch(campaignCount, maxLevel) {
 // WARNING: runCampaign synchronously mutates the global 'Random' Singleton.
 // Campaigns must be executed in strictly SEQUENTIAL order.
 // Do NOT use Promise.all or Node threading parallelism at this level.
  const campaignResults = [];
  for (let i = 0; i < campaignCount; i++) {
    const runResult = await runCampaign({ maxLevel, deltaTime: TICK_MS });
    campaignResults.push(runResult);
  }

  return aggregateRuns(campaignResults);
}

function buildComboLabel(comboPatch) {
  return Object.entries(comboPatch)
    .map(([teamName, teamPatch]) => {
      const patchDescriptions = [];

      if (teamPatch.health && teamPatch.health.max !== undefined) {
        patchDescriptions.push(`hp${teamPatch.health.max}`);
      }

      if (teamPatch.damage && teamPatch.damage.amount !== undefined) {
        patchDescriptions.push(`dmg${teamPatch.damage.amount}`);
      }

      if (teamPatch.movement) {
        for (const [key, value] of Object.entries(teamPatch.movement)) {
          const shortKey = key.slice(0, 4);
          patchDescriptions.push(`${shortKey}${value}`);
        }
      }

      const joinedDescriptions = patchDescriptions.join(",");
      return `${teamName}[${joinedDescriptions}]`;
    })
    .join(" + ");
}

async function executeComboSuite() {
  const { runs, levels, combos } = parseArguments();

  const teamHeaders = TEAM_NAMES.map(name => name.padStart(TEAM_COLUMN_WIDTH)).join("");
  console.log(`\n${"Tuning Combination".padEnd(LABEL_COLUMN_WIDTH)} ${teamHeaders}`);
  console.log("-".repeat(LABEL_COLUMN_WIDTH + 1 + TEAM_NAMES.length * TEAM_COLUMN_WIDTH));

  for (const comboPatch of combos) {
    for (const [teamName, teamPatch] of Object.entries(comboPatch)) {
      if (!TEAM_NAMES.includes(teamName)) {
        console.error(`Error: Invalid team name "${teamName}" in configuration patch.`);
        console.error(`Allowed team names are: ${TEAM_NAMES.join(", ")}`);
        process.exit(1);
      }
      applyConfigurationPatch(RACE_STATS[teamName], teamPatch);
    }

    const aggregatedResults = await simulateCampaignBatch(runs, levels);

    const label = buildComboLabel(comboPatch);
    const winRateColumns = TEAM_NAMES.map(teamName => {
      const winRate = aggregatedResults.teams[teamName].winRate;
      const winRateStr = `${winRate.toFixed(1)}%`;
      return winRateStr.padStart(TEAM_COLUMN_WIDTH);
    }).join("");

    console.log(`${label.padEnd(LABEL_COLUMN_WIDTH)} ${winRateColumns}`);

    restoreBaseConfiguration();
  }
  console.log("");
}

await executeComboSuite();
