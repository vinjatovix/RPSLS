/**
 * check-combo.mjs - Tests config combinations in a single process.
 *   node test/check-combo.mjs <runs> <levels> \
 *     '{"team": {"health": {"max": N}, "damage": {"amount": N}, "movement": {...}}}' ...
 * Each JSON arg is a combo; it is applied to the base config, run, and restored.
 */

import "./dom-stub.js";
import { runCampaign, aggregateRuns } from "../src/testing/balanceRunner.js";
import { RACE_STATS } from "../src/config/gameConfig.js";

const runs = +process.argv[2] || 15;
const levels = +process.argv[3] || 100;
const combos = process.argv.slice(4).map(c => JSON.parse(c));

const TEAMS = Object.keys(RACE_STATS);
const saved = JSON.parse(JSON.stringify(RACE_STATS));

async function run() {
  const results = [];
  for (let i = 0; i < runs; i++) results.push(await runCampaign({ maxLevel: levels, deltaTime: 16 }));
  return aggregateRuns(results);
}

function deepApply(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) deepApply(target[key], value);
    else target[key] = value;
  }
}

function restore() {
  for (const team of TEAMS) deepApply(RACE_STATS[team], JSON.parse(JSON.stringify(saved[team])));
}

console.log(`Combo        rocks  papers scissors lizards  spocks`);
for (const combo of combos) {
  for (const [team, patch] of Object.entries(combo)) deepApply(RACE_STATS[team], patch);
  const aggregate = await run();
  const label = Object.entries(combo)
    .map(([team, patch]) => {
      const bits = [];
      if (patch.health) bits.push(`hp${patch.health.max}`);
      if (patch.damage) bits.push(`dmg${patch.damage.amount}`);
      for (const [key, value] of Object.entries(patch.movement ?? {})) bits.push(`${key.slice(0, 4)}${value}`);
      return `${team}[${bits.join(",")}]`;
    })
    .join(" + ");
  console.log(
    `${label.padEnd(32)} ` +
      TEAMS.map(t => `${String(aggregate.teams[t].winRate.toFixed(1)).padStart(5)}%`).join("  ")
  );
  restore();
}
