import { Game } from "../index.js";
import { RACE_STATS } from "../config/gameConfig.js";
import { Random } from "../core/index.js";

export const TEAMS = Object.keys(RACE_STATS);
export const BUCKET_SIZE = 25;
export const CHUNK_STEPS = 2000;
export const MAX_STEPS_PER_RUN = 500000;

let installed = false;

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
    // Fallback handled below via Storage prototype patch
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

function createInitialStats(bucketCount) {
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
  return stats;
}

function handleMatchEnd(game, stats, aliveBefore, timing) {
  timing.matchDurations.push(timing.simulatedMs - timing.matchStartMs);
  timing.matchStartMs = timing.simulatedMs;

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
    stats.finalTwoWinners[key][game.lastWin] = (stats.finalTwoWinners[key][game.lastWin] || 0) + 1;
  }
  if (game.lastWin !== "DRAW") {
    stats.winByMode[game.lastWin][mode] += 1;
  }
}

function getAliveTeams(game) {
  return [...new Set(game.enemies.filter(enemy => !enemy.dead).map(enemy => enemy.team))];
}

function createGameInstance({ capture, powerups }) {
  const game = new Game({ startLevel: 0, mode: capture ? "infinite-capture" : "infinite-death" });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.progressManager.awardCredits = () => {};
  game.matchManager.match = 0;
  game.onTeamChanged();

  if (!powerups) {
    game.powerupTimer = Infinity;
  }
  return game;
}

function subscribeToGameEvents(game, stats, bucketCount) {
  const unsubscribeWin = game.eventBus.subscribe("match-win", ({ team, match }) => {
    stats.wins[team] += 1;
    stats.buckets[bucketOf(match, bucketCount)][team] += 1;
  });
  const unsubscribeKill = game.eventBus.subscribe("kill", ({ killerTeam, victimTeam }) => {
    stats.kills[killerTeam] += 1;
    stats.deaths[victimTeam] += 1;
    stats.matrix[killerTeam][victimTeam] += 1;
  });

  return () => {
    unsubscribeWin();
    unsubscribeKill();
  };
}

async function handleProgressChunk({ game, steps, maxLevel, onProgress, stats }) {
  const cancel = onProgress?.({
    steps,
    match: game.matchManager.match,
    matchesLeft: Math.max(0, maxLevel - game.matchManager.match + 1)
  });
  if (cancel) {
    stats.truncated = true;
    return true;
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  return false;
}

async function executeSimulation({ game, maxLevel, deltaTime, onProgress, stats }) {
  let steps = 0;
  const timing = {
    simulatedMs: 0,
    matchStartMs: 0,
    matchDurations: []
  };

  while (game.matchManager.match <= maxLevel) {
    const matchBefore = game.matchManager.match;
    const aliveBefore = getAliveTeams(game);
    
    game.update(deltaTime);
    steps += 1;
    timing.simulatedMs += deltaTime;

    if (game.matchManager.match !== matchBefore) {
      handleMatchEnd(game, stats, aliveBefore, timing);
    }

    if (steps % CHUNK_STEPS === 0) {
      const shouldCancel = await handleProgressChunk({ game, steps, maxLevel, onProgress, stats });
      if (shouldCancel) {
        break;
      }
    }

    if (steps >= MAX_STEPS_PER_RUN) {
      stats.truncated = true;
      break;
    }
  }

  return { steps, timing };
}

function finalizeCampaignStats(stats, game, steps, timing) {
  const totalWins = Object.values(stats.wins).reduce((a, b) => a + b, 0);
  stats.matches = Math.max(0, game.matchManager.match - 1);
  stats.draws = Math.max(0, stats.matches - totalWins);
  stats.steps = steps;
  stats.avgMatchMs = timing.matchDurations.length
    ? timing.matchDurations.reduce((a, b) => a + b, 0) / timing.matchDurations.length
    : 0;
}

let isCampaignRunning = false;

/**
 * WARNING: runCampaign synchronously mutates the global 'Random' Singleton.
 * Campaigns must be executed in strictly SEQUENTIAL order.
 * Do NOT use Promise.all or Node threading parallelism at this level.
 */
export async function runCampaign({
  maxLevel = 100,
  deltaTime = 16,
  capture = false,
  powerups = false,
  onProgress = null,
  seed = null
} = {}) {
  if (isCampaignRunning) {
    throw new Error(
      "[Fatal] Concurrent campaign simulation detected! " +
      "runCampaign mutates the global 'Random' singleton and must be " +
      "executed in a strictly sequential queue."
    );
  }

  isCampaignRunning = true;

  try {
    installTestEnv();

    if (seed !== null) {
      Random.setSeed(seed);
    }

    const game = createGameInstance({ capture, powerups });
    const bucketCount = Math.max(1, Math.ceil(maxLevel / BUCKET_SIZE));
    const stats = createInitialStats(bucketCount);
    const unsubscribe = subscribeToGameEvents(game, stats, bucketCount);

    try {
      const { steps, timing } = await executeSimulation({
        game,
        maxLevel,
        deltaTime,
        onProgress,
        stats
      });
      finalizeCampaignStats(stats, game, steps, timing);
    } finally {
      unsubscribe();
      game.destroy();
      if (seed !== null) {
        Random.restore();
      }
    }

    return stats;
  } finally {
    isCampaignRunning = false;
  }
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

function createInitialAggregate(runCount, totalMatches) {
  const aggregate = {
    runs: runCount,
    totalMatches,
    draws: 0,
    avgMatchMs: 0,
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
    for (const victim of TEAMS) {
      aggregate.matrix[team][victim] = 0;
    }
    aggregate.winByMode[team] = { elimination: 0, countdown2: 0 };
  }
  return aggregate;
}

function mergeRunsData(aggregate, runs) {
  aggregate.draws = sum(runs.map(run => run.draws));
  aggregate.avgMatchMs = aggregate.totalMatches
    ? sum(runs.map(run => run.avgMatchMs * run.matches)) / aggregate.totalMatches
    : 0;

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
}

function computeTeamAggregateStats(aggregate, runs, totalMatches) {
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
}

function computeBucketsAggregate(aggregate, runs, bucketCount, matchesPerRun) {
  for (let i = 0; i < bucketCount; i++) {
    const bucket = {};
    for (const team of TEAMS) {
      bucket[team] = 0;
    }
    for (const run of runs) {
      const runBucket = run.buckets[i];
      if (!runBucket) continue;
      for (const team of TEAMS) {
        bucket[team] += runBucket[team] ?? 0;
      }
    }
    aggregate.buckets.push(bucket);
    const first = i * BUCKET_SIZE + 1;
    const last = i === bucketCount - 1 ? matchesPerRun : (i + 1) * BUCKET_SIZE;
    aggregate.bucketSizes.push({ min: first, max: last, count: last - first + 1 });
  }
}

export function aggregateRuns(runs) {
  const runCount = runs.length;
  const totalMatches = sum(runs.map(run => run.matches));
  const matchesPerRun = Math.round(totalMatches / Math.max(1, runCount));
  const bucketCount = Math.max(0, ...runs.map(run => run.buckets.length));

  const aggregate = createInitialAggregate(runCount, totalMatches);
  mergeRunsData(aggregate, runs);
  computeTeamAggregateStats(aggregate, runs, totalMatches);
  computeBucketsAggregate(aggregate, runs, bucketCount, matchesPerRun);

  return aggregate;
}

function formatTeamStatsSection(aggregate) {
  const lines = [];
  const formatRow = cells => cells.map((c, i) => (i === 0 ? c.padEnd(14) : c.padStart(9))).join(" ");
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
  return lines;
}

function formatKillMatrixSection(aggregate) {
  const lines = [];
  const formatRow = cells => cells.map((c, i) => (i === 0 ? c.padEnd(14) : c.padStart(9))).join(" ");
  lines.push("Deaths by killer -> victim (total across all runs):");
  lines.push(formatRow(["killer\\victim"].concat(TEAMS)));
  for (const killer of TEAMS) {
    const cells = [killer];
    for (const victim of TEAMS) {
      cells.push(String(aggregate.matrix[killer][victim]));
    }
    lines.push(formatRow(cells));
  }
  return lines;
}

function formatMatchEndingsSection(aggregate) {
  const lines = [];
  const totalEnd = aggregate.endModes.elimination + aggregate.endModes.countdown2 + aggregate.endModes.draw;
  if (!totalEnd) return lines;

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
  return lines;
}

function formatWinsByEndingSection(aggregate) {
  const lines = [];
  const winRows = Object.keys(aggregate.winByMode).filter(team => {
    const wm = aggregate.winByMode[team];
    return wm.elimination + wm.countdown2 > 0;
  });
  if (!winRows.length) return lines;

  lines.push("Wins by match ending (breakdown per team):");
  for (const team of winRows) {
    const wm = aggregate.winByMode[team];
    const tot = wm.elimination + wm.countdown2;
    lines.push(
      `  ${team.padEnd(10)} elim ${String(wm.elimination).padStart(5)} (${((wm.elimination / tot) * 100).toFixed(0).padStart(2)}%)  ` +
        `countdown ${String(wm.countdown2).padStart(5)} (${((wm.countdown2 / tot) * 100).toFixed(0).padStart(2)}%)`
    );
  }
  return lines;
}

function formatFinalTwoSection(aggregate) {
  const lines = [];
  const finalTwoKeys = Object.entries(aggregate.finalTwo).sort((a, b) => b[1] - a[1]);
  if (!finalTwoKeys.length) return lines;

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
  return lines;
}

function formatVerdictSection(aggregate, thresholdPp) {
  const EXPECTED = 20;
  const lines = [];
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
  return lines;
}

function formatLevelBucketsSection(aggregate) {
  const lines = [];
  if (!aggregate.buckets.length) return lines;

  const formatRow = cells => cells.map((c, i) => (i === 0 ? c.padEnd(14) : c.padStart(9))).join(" ");
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
  return lines;
}

export function formatReport(aggregate, { thresholdPp = 5 } = {}) {
  const lines = [];

  lines.push("== BALANCE REPORT - no upgrades purchased ==");
  lines.push(
    `Runs: ${aggregate.runs} | Matches: ${aggregate.totalMatches} | Draws: ${aggregate.draws} | ` +
      `Avg match: ${aggregate.avgMatchMs.toFixed(0)} simulated ms`
  );
  lines.push("");

  lines.push(...formatTeamStatsSection(aggregate));
  lines.push("");

  lines.push(...formatKillMatrixSection(aggregate));

  const endings = formatMatchEndingsSection(aggregate);
  if (endings.length) {
    lines.push("");
    lines.push(...endings);
  }

  const winsByEnding = formatWinsByEndingSection(aggregate);
  if (winsByEnding.length) {
    lines.push("");
    lines.push(...winsByEnding);
  }

  const finalTwo = formatFinalTwoSection(aggregate);
  if (finalTwo.length) {
    lines.push("");
    lines.push(...finalTwo);
  }

  lines.push("");
  lines.push(...formatVerdictSection(aggregate, thresholdPp));

  const buckets = formatLevelBucketsSection(aggregate);
  if (buckets.length) {
    lines.push("");
    lines.push(...buckets);
  }

  return lines.join("\n");
}

installTestEnv();
