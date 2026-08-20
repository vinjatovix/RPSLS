/**
 * matchup-tune.mjs - Sweep of the rotationAcceleration multiplier over the
 * 1v1 matchup (catch-rate + TTK). Calibration diagnostic.
 *   node test/matchup-tune.mjs [seeds=8] [mult1 mult2 ...]
 */

import { RACE_STATS } from "../src/config/gameConfig.js";
import { runMatchupSim } from "../src/testing/matchupSim.js";

const seeds = +process.argv[2] || 8;
const mults = process.argv.slice(3).map(Number);
const list = mults.length ? mults : [1, 2, 4, 8, 16];
const teams = Object.keys(RACE_STATS);

function summary(result) {
  let totalTrials = 0;
  let chaserWins = 0;
  const timeToKill = [];
  let minKillRate = 101;
  const perPair = {};
  for (const [key, pair] of Object.entries(result.pairs)) {
    totalTrials += pair.trials;
    chaserWins += pair.chaserWins;
    minKillRate = Math.min(minKillRate, pair.killRate);
    perPair[key] = { rate: pair.killRate, ttk: pair.avgKillMs };
    if (pair.avgKillMs != null) timeToKill.push(pair.avgKillMs);
  }
  const average = timeToKill.length ? timeToKill.reduce((a, b) => a + b, 0) / timeToKill.length : null;
  return {
    minKillRate,
    averageKillRate: (chaserWins / totalTrials) * 100,
    averageTimeToKill: average ? (average / 1000).toFixed(1) + "s" : "?",
    worstPairs: Object.entries(perPair)
      .filter(([, pair]) => pair.rate <= 90)
      .map(([key, pair]) => `${key}:${pair.rate.toFixed(0)}%`)
      .join(" ")
  };
}

console.log(`Matchup-tune rotationAcceleration (${seeds} seeds)`);
console.log("mult | minRate avgRate avgTtk | pairs with <=90%");
for (const multiplier of list) {
  const clonedRaceStats = JSON.parse(JSON.stringify(RACE_STATS));
  for (const team of teams) {
    clonedRaceStats[team].movement.rotationAcceleration = RACE_STATS[team].movement.rotationAcceleration * multiplier;
  }
  const result = runMatchupSim({ seeds, raceStats: clonedRaceStats });
  const summaryResult = summary(result);
  console.log(
    ` ${String(multiplier).padStart(4)} |  ${String(summaryResult.minKillRate.toFixed(0)).padStart(4)}%  ${String(summaryResult.averageKillRate.toFixed(1)).padStart(5)}%  ${summaryResult.averageTimeToKill.padStart(6)} | ${summaryResult.worstPairs}`
  );
}
