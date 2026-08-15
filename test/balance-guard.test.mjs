/**
 * balance-guard.test.mjs - Balance guard included in `npm test`.
 * Runs 6 seeded headless campaigns of 50 levels with the real engine and
 * applies a chi-square goodness-of-fit test: the observed win distribution
 * across the 5 races must be consistent with perfect balance (20% each).
 *
 * Deterministic: each seed pins Math.random, so the result is fully
 * reproducible (0% flaky). The fixed ±7pp threshold was removed because with
 * only ~100 matches the max deviation crossed it ~27% of the time by pure
 * sampling noise.
 *
 * df = 4, critical value 9.488 (alpha = 0.05). With n = 300 matches this
 * tolerates the current config yet flips on a ~+10pp regression.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { runCampaign, aggregateRuns, TEAMS } from "../src/testing/balanceRunner.js";

const EXPECTED = 20;
const SEEDS = [7, 42, 123, 2024, 31337, 65536];
const LEVELS = 50;
const DF = TEAMS.length - 1;
const CRITICAL_95 = 9.488;

test("balance: win distribution matches 20% each (chi-square, df=4)", async () => {
  const runs = [];
  for (const seed of SEEDS) {
    runs.push(await runCampaign({ maxLevel: LEVELS, deltaTime: 16, seed }));
  }
  const aggregate = aggregateRuns(runs);
  const total = aggregate.totalMatches;
  const expectedWins = total / TEAMS.length;

  let chi2 = 0;
  const lines = [];
  for (const team of TEAMS) {
    const wins = aggregate.teams[team].wins;
    const rate = (wins / total) * 100;
    const deviation = rate - EXPECTED;
    chi2 += ((wins - expectedWins) ** 2) / expectedWins;
    lines.push(`${team} ${rate.toFixed(1)}% (${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}pp)`);
  }
  console.log(
    `[balance-guard] ${SEEDS.length}x${LEVELS} levels | chi2=${chi2.toFixed(2)} (df=${DF}, crit=${CRITICAL_95}) | ${lines.join(" | ")}`
  );

  assert.ok(
    chi2 <= CRITICAL_95,
    `chi2=${chi2.toFixed(2)} > ${CRITICAL_95} (df=${DF}, alpha=0.05): win distribution deviates from 20% per race`
  );
});
