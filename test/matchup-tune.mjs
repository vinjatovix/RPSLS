/**
 * matchup-tune.mjs - Barrido del multiplicador de rotationAcceleration
 * sobre el matchup 1v1 (catch-rate + TTK). Diagnóstico de calibración.
 *   node test/matchup-tune.mjs [seeds=8] [mult1 mult2 ...]
 */

import "./dom-stub.js";
import { RACE_STATS } from "../src/config/gameConfig.js";
import { runMatchupSim } from "../src/testing/matchupSim.js";

const seeds = +process.argv[2] || 8;
const mults = process.argv.slice(3).map(Number);
const list = mults.length ? mults : [1, 2, 4, 8, 16];
const teams = Object.keys(RACE_STATS);

function summary(res) {
  let totalTrials = 0;
  let chaserWins = 0;
  const ttk = [];
  let minRate = 101;
  const perPair = {};
  for (const [key, p] of Object.entries(res.pairs)) {
    totalTrials += p.trials;
    chaserWins += p.chaserWins;
    minRate = Math.min(minRate, p.killRate);
    perPair[key] = { rate: p.killRate, ttk: p.avgKillMs };
    if (p.avgKillMs != null) ttk.push(p.avgKillMs);
  }
  const avg = ttk.length ? ttk.reduce((a, b) => a + b, 0) / ttk.length : null;
  return {
    minRate,
    avgRate: (chaserWins / totalTrials) * 100,
    avgTtk: avg ? (avg / 1000).toFixed(1) + "s" : "?",
    minRatePairs: Object.entries(perPair)
      .filter(([, p]) => p.rate <= 90)
      .map(([k, p]) => `${k}:${p.rate.toFixed(0)}%`)
      .join(" ")
  };
}

const originals = {};
for (const team of teams) originals[team] = RACE_STATS[team].movement.rotationAcceleration;

console.log(`Matchup-tune rotationAcceleration (${seeds} seeds) | base: ${JSON.stringify(originals)}`);
console.log("mult | minRate avgRate avgTtk | pares con <=90%");
for (const m of list) {
  for (const team of teams) {
    RACE_STATS[team].movement.rotationAcceleration = originals[team] * m;
  }
  const res = runMatchupSim({ seeds });
  const s = summary(res);
  console.log(
    ` ${String(m).padStart(4)} |  ${String(s.minRate.toFixed(0)).padStart(4)}%  ${String(s.avgRate.toFixed(1)).padStart(5)}%  ${s.avgTtk.padStart(6)} | ${s.minRatePairs}`
  );
}
for (const team of teams) RACE_STATS[team].movement.rotationAcceleration = originals[team];
