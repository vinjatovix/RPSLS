import assert from "node:assert/strict";
import { test } from "node:test";

import { runCampaign, aggregateRuns, TEAMS } from "../src/testing/balanceRunner.js";
import { TICK_MS } from "./doubles/setupSimulationContext.mjs";

const PERFECT_BALANCE_WIN_RATE_PCT = 100 / TEAMS.length;
const SEEDS = [7, 42, 123, 2024, 31337, 1000];
const LEVELS_PER_CAMPAIGN = 50;
const DEGREES_OF_FREEDOM = TEAMS.length - 1;
const CHI_SQUARE_CRITICAL_VALUE_DF4_ALPHA05 = 9.488;

test("balance: win distribution matches 20% each (chi-square, df=4)", async () => {
  const runs = [];
  for (const seed of SEEDS) {
    runs.push(await runCampaign({ maxLevel: LEVELS_PER_CAMPAIGN, deltaTime: TICK_MS, seed }));
  }
  const aggregate = aggregateRuns(runs);
  const totalMatches = aggregate.totalMatches;
  const expectedWinsPerTeam = totalMatches / TEAMS.length;

  let chiSquareStatistic = 0;
  const teamReports = [];
  for (const team of TEAMS) {
    const wins = aggregate.teams[team].wins;
    const rate = (wins / totalMatches) * 100;
    const deviation = rate - PERFECT_BALANCE_WIN_RATE_PCT;
    chiSquareStatistic += ((wins - expectedWinsPerTeam) ** 2) / expectedWinsPerTeam;
    const deviationSign = deviation >= 0 ? "+" : "";
    teamReports.push(`${team} ${rate.toFixed(1)}% (${deviationSign}${deviation.toFixed(1)}pp)`);
  }
  console.log(
    `[balance-guard] ${SEEDS.length}x${LEVELS_PER_CAMPAIGN} levels | chi2=${chiSquareStatistic.toFixed(2)} (df=${DEGREES_OF_FREEDOM}, crit=${CHI_SQUARE_CRITICAL_VALUE_DF4_ALPHA05}) | ${teamReports.join(" | ")}`
  );

  assert.ok(
    chiSquareStatistic <= CHI_SQUARE_CRITICAL_VALUE_DF4_ALPHA05,
    `Chi-square statistic ${chiSquareStatistic.toFixed(2)} exceeds critical value ${CHI_SQUARE_CRITICAL_VALUE_DF4_ALPHA05} (df=${DEGREES_OF_FREEDOM}, alpha=0.05). Win distribution deviates too much from perfect balance.`
  );
});
