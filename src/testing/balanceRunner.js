/**
 * balanceRunner.js - Team balance simulation harness
 * Runs the real game engine (Game) in fast-forward WITHOUT rendering,
 * under controlled conditions and without touching the player's real save.
 *
 * Usage (from a page, see test/balance-sim.html):
 *   const result = await runCampaign({ maxLevel: 100 });
 *   const aggregate = aggregateRuns([result]);
 *   formatReport(aggregate);
 */

import { Game } from "../index.js";
import { RACE_STATS } from "../config/gameConfig.js";

export const TEAMS = Object.keys(RACE_STATS);
export const BUCKET_SIZE = 25;
export const CHUNK_STEPS = 2000;
export const MAX_STEPS_PER_RUN = 500000;

/**
 * Seeded PRNG (mulberry32). Returns a function producing [0, 1) numbers.
 * Used to make balance simulations deterministic (same seed -> same run).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let installed = false;

/**
 * Isolate the test environment:
 * - Prevents index.js from auto-starting the real game (rAF) on import.
 * - Replaces localStorage with an in-memory fake (the player's save is not touched).
 */
export function installTestEnv() {
  if (installed) return;
  installed = true;
  window.__NO_AUTOSTART__ = true;

  const fake = createFakeStorage();
  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: fake
    });
  } catch {
    // Fallback for browsers that do not allow redefining window.localStorage:
    // done with the Storage prototype patch below.
  }
  const proto = window.Storage?.prototype;
  if (proto) {
    const delegate = fn => function (...args) {
      return fn.apply(fake, args);
    };
    proto.getItem = delegate(fake.getItem);
    proto.setItem = delegate(fake.setItem);
    proto.removeItem = delegate(fake.removeItem);
    proto.clear = delegate(fake.clear);
    proto.key = delegate(fake.key);
  }
}

function createFakeStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    }
  };
}

function bucketOf(match, bucketCount) {
  return Math.min(bucketCount - 1, Math.floor((match - 1) / BUCKET_SIZE));
}

/**
 * Simulate a level campaign with the real game engine.
 * Each match is equivalent to leveling up 1 level (Game.#restart increments match).
 *
 * @param {Object} opts
 * @param {number} opts.maxLevel - Final level of the campaign (matches per run).
 * @param {number} opts.deltaTime - Fixed delta time in ms (16 ≈ 60fps of the real game).
 * @param {boolean} opts.capture - Enable the capture mechanic (default: false).
 * @param {boolean} opts.powerups - Enable powerups (default: false).
 * @param {(info) => boolean} [opts.onProgress] - Return true to cancel.
 * @param {number} [opts.seed] - If set, the run is deterministic (seeded PRNG).
 * @returns {Promise<Object>} Aggregated statistics of the run.
 */
export async function runCampaign({
  maxLevel = 100,
  deltaTime = 16,
  capture = false,
  powerups = false,
  onProgress = null,
  seed = null
} = {}) {
  installTestEnv();

  const previousRandom = Math.random;
  if (seed !== null) Math.random = mulberry32(seed);

  const game = new Game({ startLevel: 0, mode: capture ? "infinite-capture" : "infinite-death" });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.progressManager.awardCredits = () => {};
  game.match = 0;
  game.onTeamChanged();

  if (!powerups) game.powerupTimer = Infinity;

  const bucketCount = Math.max(1, Math.ceil(maxLevel / BUCKET_SIZE));
  const stats = {
    matches: 0,
    wins: {},
    kills: {},
    deaths: {},
    matrix: {},
    endModes: { elimination: 0, countdown2: 0, draw: 0 },
    buckets: [],
    draws: 0,
    steps: 0,
    avgMatchMs: 0,
    truncated: false,
    finalTwo: {},
    finalTwoWinners: {},
    winByMode: {}
  };
  for (const team of TEAMS) {
    stats.wins[team] = 0;
    stats.kills[team] = 0;
    stats.deaths[team] = 0;
    stats.matrix[team] = {};
    for (const victim of TEAMS) stats.matrix[team][victim] = 0;
    stats.winByMode[team] = { elimination: 0, countdown2: 0 };
  }
  for (let i = 0; i < bucketCount; i++) {
    const bucket = {};
    for (const team of TEAMS) bucket[team] = 0;
    stats.buckets.push(bucket);
  }

  const unsubscribeWin = game.eventBus.subscribe("match-win", ({ team, match }) => {
    stats.wins[team] += 1;
    stats.buckets[bucketOf(match, bucketCount)][team] += 1;
  });
  const unsubscribeKill = game.eventBus.subscribe("kill", ({ killerTeam, victimTeam }) => {
    stats.kills[killerTeam] += 1;
    stats.deaths[victimTeam] += 1;
    stats.matrix[killerTeam][victimTeam] += 1;
  });

  let steps = 0;
  let simulatedMs = 0;
  let matchStartMs = 0;
  const matchDurations = [];

  try {
    while (game.match <= maxLevel) {
      const matchBefore = game.match;
      const aliveBefore = [...new Set(game.enemies.filter(enemy => !enemy.dead).map(enemy => enemy.team))];
      game.update(deltaTime);
      steps += 1;
      simulatedMs += deltaTime;
      if (game.match !== matchBefore) {
        matchDurations.push(simulatedMs - matchStartMs);
        matchStartMs = simulatedMs;
        let mode;
        if (game.lastWin === "DRAW") {
          stats.endModes.draw += 1;
          mode = "draw";
        } else if (aliveBefore.length === 1) {
          stats.endModes.elimination += 1;
          mode = "elimination";
        } else {
          stats.endModes.countdown2 += 1;
          mode = "countdown2";
          const pair = [...aliveBefore].sort();
          const key = pair.join("~");
          stats.finalTwo[key] = (stats.finalTwo[key] || 0) + 1;
          stats.finalTwoWinners[key] = stats.finalTwoWinners[key] || {};
          stats.finalTwoWinners[key][game.lastWin] =
            (stats.finalTwoWinners[key][game.lastWin] || 0) + 1;
        }
        if (game.lastWin !== "DRAW") stats.winByMode[game.lastWin][mode] += 1;
      }
      if (steps % CHUNK_STEPS === 0) {
        if (onProgress) {
          const cancel = onProgress({
            steps,
            match: game.match,
            matchesLeft: Math.max(0, maxLevel - game.match + 1)
          });
          if (cancel) {
            stats.truncated = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (steps >= MAX_STEPS_PER_RUN) {
        stats.truncated = true;
        break;
      }
    }
  } finally {
    if (seed !== null) Math.random = previousRandom;
  }

  const totalWins = Object.values(stats.wins).reduce((a, b) => a + b, 0);
  stats.matches = Math.max(0, game.match - 1);
  stats.draws = Math.max(0, stats.matches - totalWins);
  stats.steps = steps;
  stats.avgMatchMs = matchDurations.length
    ? matchDurations.reduce((a, b) => a + b, 0) / matchDurations.length
    : 0;

  unsubscribeWin();
  unsubscribeKill();
  game.destroy();

  return stats;
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function mean(arr) {
  return sum(arr) / arr.length;
}

function sampleStd(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map(x => (x - m) ** 2)) / (arr.length - 1));
}

/**
 * Aggregate multiple runs into per-team and per-level-range metrics.
 */
export function aggregateRuns(runs) {
  const runCount = runs.length;
  const totalMatches = sum(runs.map(run => run.matches));
  const matchesPerRun = Math.round(totalMatches / Math.max(1, runCount));
  const bucketCount = Math.max(0, ...runs.map(run => run.buckets.length));

  const aggregate = {
    runs: runCount,
    totalMatches,
    draws: sum(runs.map(run => run.draws)),
    avgMatchMs: totalMatches ? sum(runs.map(run => run.avgMatchMs * run.matches)) / totalMatches : 0,
    matrix: {},
    endModes: { elimination: 0, countdown2: 0, draw: 0 },
    teams: {},
    buckets: [],
    bucketSizes: [],
    finalTwo: {},
    finalTwoWinners: {},
    winByMode: {}
  };

  for (const team of TEAMS) {
    aggregate.matrix[team] = {};
    for (const victim of TEAMS) aggregate.matrix[team][victim] = 0;
    aggregate.winByMode[team] = { elimination: 0, countdown2: 0 };
  }
  for (const run of runs) {
    for (const killer of TEAMS) {
      for (const victim of TEAMS) {
        aggregate.matrix[killer][victim] += run.matrix?.[killer]?.[victim] ?? 0;
      }
    }
    aggregate.endModes.elimination += run.endModes?.elimination ?? 0;
    aggregate.endModes.countdown2 += run.endModes?.countdown2 ?? 0;
    aggregate.endModes.draw += run.endModes?.draw ?? 0;
    for (const [key, count] of Object.entries(run.finalTwo ?? {})) {
      aggregate.finalTwo[key] = (aggregate.finalTwo[key] || 0) + count;
    }
    for (const [key, winners] of Object.entries(run.finalTwoWinners ?? {})) {
      aggregate.finalTwoWinners[key] = aggregate.finalTwoWinners[key] || {};
      for (const [team, count] of Object.entries(winners)) {
        aggregate.finalTwoWinners[key][team] = (aggregate.finalTwoWinners[key][team] || 0) + count;
      }
    }
    for (const team of TEAMS) {
      const wm = run.winByMode?.[team] ?? { elimination: 0, countdown2: 0 };
      aggregate.winByMode[team].elimination += wm.elimination ?? 0;
      aggregate.winByMode[team].countdown2 += wm.countdown2 ?? 0;
    }
  }

  for (const team of TEAMS) {
    const winsByRun = runs.map(run => run.wins[team] ?? 0);
    const winsRateByRun = winsByRun.map((wins, i) => (wins / Math.max(1, runs[i].matches)) * 100);
    const kills = sum(runs.map(run => run.kills[team] ?? 0));
    const deaths = sum(runs.map(run => run.deaths[team] ?? 0));
    const totalWins = sum(winsByRun);
    aggregate.teams[team] = {
      wins: totalWins,
      winRate: totalMatches ? (totalWins / totalMatches) * 100 : 0,
      kills,
      deaths,
      killDeathRatio: deaths ? kills / deaths : kills,
      minWinRate: winsRateByRun.length ? Math.min(...winsRateByRun) : 0,
      maxWinRate: winsRateByRun.length ? Math.max(...winsRateByRun) : 0,
      std: sampleStd(winsRateByRun)
    };
  }

  for (let i = 0; i < bucketCount; i++) {
    const bucket = {};
    for (const team of TEAMS) bucket[team] = 0;
    for (const run of runs) {
      const runBucket = run.buckets[i];
      if (!runBucket) continue;
      for (const team of TEAMS) bucket[team] += runBucket[team] ?? 0;
    }
    aggregate.buckets.push(bucket);
    const first = i * BUCKET_SIZE + 1;
    const last = i === bucketCount - 1 ? matchesPerRun : (i + 1) * BUCKET_SIZE;
    aggregate.bucketSizes.push({ min: first, max: last, count: last - first + 1 });
  }

  return aggregate;
}

/**
 * Render the report in plain text (monospaced).
 */
export function formatReport(aggregate, { thresholdPp = 5 } = {}) {
  const EXPECTED = 20;
  const lines = [];

  lines.push("== BALANCE REPORT - no upgrades purchased ==");
  lines.push(
    `Runs: ${aggregate.runs} | Matches: ${aggregate.totalMatches} | Draws: ${aggregate.draws} | ` +
      `Avg match: ${aggregate.avgMatchMs.toFixed(0)} simulated ms`
  );
  lines.push("");

  const formatRow = cells =>
    cells.map((c, i) => (i === 0 ? c.padEnd(14) : c.padStart(9))).join(" ");

  lines.push(formatRow(["Team", "Wins", "WinRate", "Kills", "Deaths", "K/D", "min", "max", "sigma"]));
  for (const team of TEAMS) {
    const stats = aggregate.teams[team];
    lines.push(
      formatRow([
        team,
        String(stats.wins),
        stats.winRate.toFixed(1) + "%",
        String(stats.kills),
        String(stats.deaths),
        stats.killDeathRatio.toFixed(2),
        stats.minWinRate.toFixed(1) + "%",
        stats.maxWinRate.toFixed(1) + "%",
        stats.std.toFixed(2)
      ])
    );
  }

  lines.push("");
  lines.push("Deaths by killer -> victim (total across all runs):");
  lines.push(formatRow(["killer\\victim"].concat(TEAMS)));
  for (const killer of TEAMS) {
    const cells = [killer];
    for (const victim of TEAMS) cells.push(String(aggregate.matrix[killer][victim]));
    lines.push(formatRow(cells));
  }

  const totalEnd = aggregate.endModes.elimination + aggregate.endModes.countdown2 + aggregate.endModes.draw;
  if (totalEnd) {
    lines.push("");
    lines.push("Match endings:");
    lines.push(
      `  Elimination (1 team left):      ${aggregate.endModes.elimination} (${((aggregate.endModes.elimination / totalEnd) * 100).toFixed(1)}%)`
    );
    lines.push(
      `  Time out, 2 teams:              ${aggregate.endModes.countdown2} (${((aggregate.endModes.countdown2 / totalEnd) * 100).toFixed(1)}%)`
    );
    lines.push(
      `  Draw (time out, >=3):           ${aggregate.endModes.draw} (${((aggregate.endModes.draw / totalEnd) * 100).toFixed(1)}%)`
    );
  }

  const winRows = Object.keys(aggregate.winByMode).filter(team => {
    const wm = aggregate.winByMode[team];
    return wm.elimination + wm.countdown2 > 0;
  });
  if (winRows.length) {
    lines.push("");
    lines.push("Wins by match ending (breakdown per team):");
    for (const team of winRows) {
      const wm = aggregate.winByMode[team];
      const tot = wm.elimination + wm.countdown2;
      lines.push(
        `  ${team.padEnd(10)} elim ${String(wm.elimination).padStart(5)} (${((wm.elimination / tot) * 100).toFixed(0).padStart(2)}%)  ` +
          `countdown ${String(wm.countdown2).padStart(5)} (${((wm.countdown2 / tot) * 100).toFixed(0).padStart(2)}%)`
      );
    }
  }

  const finalTwoKeys = Object.entries(aggregate.finalTwo).sort((a, b) => b[1] - a[1]);
  if (finalTwoKeys.length) {
    lines.push("");
    lines.push("Final-2 pairs in countdown2 (who reaches the tiebreaker and who wins):");
    lines.push("  pair" + " ".repeat(12) + "times   winner(s)");
    for (const [key, count] of finalTwoKeys) {
      const winners = Object.entries(aggregate.finalTwoWinners[key] || {})
        .sort((a, b) => b[1] - a[1])
        .map(([team, wins]) => `${team}: ${wins}`)
        .join(", ");
      const percent = aggregate.endModes.countdown2
        ? ((count / aggregate.endModes.countdown2) * 100).toFixed(1)
        : "0";
      lines.push(`  ${key.padEnd(16)} ${String(count).padStart(5)} (${percent.padStart(4)}%)  ${winners}`);
    }
  }

  lines.push("");
  lines.push(`Verdict (perfect balance = ${EXPECTED}% per team, threshold ±${thresholdPp}pp):`);
  let worst = 0;
  for (const team of TEAMS) {
    const stats = aggregate.teams[team];
    const deviation = stats.winRate - EXPECTED;
    worst = Math.max(worst, Math.abs(deviation));
    const ok = Math.abs(deviation) <= thresholdPp;
    lines.push(
      `  ${team.padEnd(10)} ${stats.winRate.toFixed(1).padStart(5)}%  ` +
        (ok ? "balanced" : "!! OUT OF RANGE") +
        `  (${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}pp)`
    );
  }
  lines.push(
    `  -> Max deviation: ${worst.toFixed(1)}pp ` +
      (worst <= thresholdPp ? "(all races within range)" : "(some races unbalanced)")
  );

  if (aggregate.buckets.length) {
    lines.push("");
    lines.push("Wins by level range (% of matches in the range):");
    lines.push(
      formatRow(["Range"].concat(aggregate.bucketSizes.map(size => `${size.min}-${size.max}`)))
    );
    aggregate.buckets.forEach((bucket, i) => {
      const size = aggregate.bucketSizes[i].count * aggregate.runs;
      const cells = [`levels ${aggregate.bucketSizes[i].min}-${aggregate.bucketSizes[i].max}`];
      for (const team of TEAMS) {
        cells.push(size ? ((bucket[team] / size) * 100).toFixed(1) + "%" : "0.0%");
      }
      lines.push(formatRow(cells));
    });
  }

  return lines.join("\n");
}

installTestEnv();
