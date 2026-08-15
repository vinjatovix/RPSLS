/**
 * check-combo.mjs - Prueba combinaciones de config en un solo proceso.
 *   node test/check-combo.mjs <runs> <levels> \
 *     '{"team": {"health": {"max": N}, "damage": {"amount": N}, "movement": {...}}}' ...
 * Cada arg JSON es un combo; se aplica sobre el config base, se corre y se restaura.
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
  for (let i = 0; i < runs; i++) results.push(await runCampaign({ maxLevel: levels, dt: 16 }));
  return aggregateRuns(results);
}

function deepApply(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) deepApply(target[k], v);
    else target[k] = v;
  }
}

function restore() {
  for (const team of TEAMS) deepApply(RACE_STATS[team], JSON.parse(JSON.stringify(saved[team])));
}

console.log(`Combo        rocks  papers scissors lizards  spocks`);
for (const combo of combos) {
  for (const [team, patch] of Object.entries(combo)) deepApply(RACE_STATS[team], patch);
  const agg = await run();
  const label = Object.entries(combo)
    .map(([t, p]) => {
      const bits = [];
      if (p.health) bits.push(`hp${p.health.max}`);
      if (p.damage) bits.push(`dmg${p.damage.amount}`);
      for (const [k, v] of Object.entries(p.movement ?? {})) bits.push(`${k.slice(0, 4)}${v}`);
      return `${t}[${bits.join(",")}]`;
    })
    .join(" + ");
  console.log(
    `${label.padEnd(32)} ` +
      TEAMS.map(t => `${String(agg.teams[t].winRate.toFixed(1)).padStart(5)}%`).join("  ")
  );
  restore();
}
