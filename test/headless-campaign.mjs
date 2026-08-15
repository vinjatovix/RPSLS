/**
 * headless-campaign.mjs - Runs the balance sim WITHOUT a browser.
 * Reuses runCampaign from balanceRunner.js (real Game in fast-forward).
 *
 * Usage:
 *   node test/headless-campaign.mjs campaign [runs=10] [levels=100]
 *   node test/headless-campaign.mjs sweep     [runs=2]  [levels=100] [pct=15]
 *   node test/headless-campaign.mjs matchup   [seeds=12]
 */

import "./dom-stub.js";

const { runCampaign, aggregateRuns, formatReport } = await import("../src/testing/balanceRunner.js");
const { runMatchupSim, formatMatchupReport } = await import("../src/testing/matchupSim.js");
const { RACE_STATS, GAME_CONFIG } = await import("../src/config/gameConfig.js");

const TEAMS = Object.keys(RACE_STATS);

const SWEEP_STAT_PATHS = [
  ["baseSpeed", "movement.baseSpeed"],
  ["minSpeed", "movement.minSpeed"],
  ["speedVariance", "movement.speedVariance"],
  ["acceleration", "movement.acceleration"],
  ["deceleration", "movement.deceleration"],
  ["maxSpeed", "movement.maxSpeed"],
  ["rotationSpeed", "movement.rotationSpeed"],
  ["rotationAcceleration", "movement.rotationAcceleration"],
  ["health", "health.max"],
  ["damage", "damage.amount"]
];

function readPath(obj, path) {
  return path.split(".").reduce((o, k) => o[k], obj);
}
function writePath(obj, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce((o, k) => o[k], obj);
  target[last] = value;
}

function labelOf(config) {
  if (config.timer === "base") return `timer.base ${config.direction > 0 ? "+" : ""}${config.direction * config.percent}%`;
  if (config.timer === "growth") return `timer.growth ${config.direction > 0 ? "+" : ""}${config.direction * config.percent}%`;
  if (config.ai === "dangerRadius") return `ai.dangerRadius ${config.direction > 0 ? "+" : ""}${config.direction * config.percent}%`;
  return `${config.team}.${config.name} ${config.direction > 0 ? "+" : ""}${config.direction * config.percent}%`;
}

async function runShort(runs, levels, deltaTime) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    results.push(await runCampaign({ maxLevel: levels, deltaTime }));
  }
  return results.length ? aggregateRuns(results) : null;
}

function winRates(aggregate) {
  const out = {};
  if (aggregate) for (const team of TEAMS) out[team] = aggregate.teams[team].winRate;
  return out;
}

function statPathOf(name) {
  const hit = SWEEP_STAT_PATHS.find(([n]) => n === name);
  return hit ? hit[1] : name;
}

async function runFocus(paths, runs, levels, deltaTime, percent) {
  process.stdout.write(`[focus] baseline ${runs}x${levels}...\n`);
  const startTime = Date.now();
  const base = winRates(await runShort(runs, levels, deltaTime));

  const configs = [];
  for (const path of paths) {
    const [team, ...rest] = path.split(".");
    const statPath = statPathOf(rest.join("."));
    for (const direction of [-1, 1]) configs.push({ team, name: rest.join("."), path: statPath, direction, percent });
  }

  const rows = [];
  for (let ci = 0; ci < configs.length; ci++) {
    const config = configs[ci];
    process.stdout.write(
      `[focus] ${ci + 1}/${configs.length} ${labelOf(config)} (${((Date.now() - startTime) / 1000).toFixed(0)}s)\n`
    );
    const current = readPath(RACE_STATS[config.team], config.path);
    writePath(RACE_STATS[config.team], config.path, Math.max(Math.abs(current) * 0.01, current * (1 + (config.direction * percent) / 100)));
    const rates = winRates(await runShort(runs, levels, deltaTime));
    writePath(RACE_STATS[config.team], config.path, current);
    rows.push({ config, rates, base });
  }
  return { base, rows, percent };
}

async function runSweep(runs, levels, deltaTime, percent) {
  process.stdout.write(`[sweep] baseline ${runs}x${levels}...\n`);
  const startTime = Date.now();
  const base = winRates(await runShort(runs, levels, deltaTime));

  const baseline = {};
  for (const team of TEAMS)
    for (const [name, path] of SWEEP_STAT_PATHS)
      baseline[`${team}.${path}`] = readPath(RACE_STATS[team], path);
  const timerBase = GAME_CONFIG.mechanics.matchTimeBaseMs;
  const timerGrowth = GAME_CONFIG.mechanics.matchTimeGrowthMs;
  const dangerBase = GAME_CONFIG.mechanics.ai.dangerRadius;

  const configs = [];
  for (const team of TEAMS)
    for (const [name, path] of SWEEP_STAT_PATHS)
      for (const direction of [-1, 1]) configs.push({ team, name, path, direction, percent });
  for (const timer of ["base", "growth"]) for (const direction of [-1, 1]) configs.push({ timer, direction, percent });
  for (const direction of [-1, 1]) configs.push({ ai: "dangerRadius", direction, percent });

  const rows = [];
  for (let ci = 0; ci < configs.length; ci++) {
    const config = configs[ci];
    process.stdout.write(
      `[sweep] ${ci + 1}/${configs.length} ${labelOf(config)} (${((Date.now() - startTime) / 1000).toFixed(0)}s)\n`
    );
    if (config.timer === "base") {
      GAME_CONFIG.mechanics.matchTimeBaseMs = Math.max(1000, timerBase * (1 + (config.direction * percent) / 100));
    } else if (config.timer === "growth") {
      GAME_CONFIG.mechanics.matchTimeGrowthMs = Math.max(0, timerGrowth * (1 + (config.direction * percent) / 100));
    } else if (config.ai === "dangerRadius") {
      GAME_CONFIG.mechanics.ai.dangerRadius = Math.max(20, dangerBase * (1 + (config.direction * percent) / 100));
    } else {
      const current = readPath(RACE_STATS[config.team], config.path);
      writePath(RACE_STATS[config.team], config.path, Math.max(Math.abs(current) * 0.01, current * (1 + (config.direction * percent) / 100)));
    }

    const rates = winRates(await runShort(runs, levels, deltaTime));

    if (config.timer === "base") GAME_CONFIG.mechanics.matchTimeBaseMs = timerBase;
    else if (config.timer === "growth") GAME_CONFIG.mechanics.matchTimeGrowthMs = timerGrowth;
    else if (config.ai === "dangerRadius") GAME_CONFIG.mechanics.ai.dangerRadius = dangerBase;
    else writePath(RACE_STATS[config.team], config.path, baseline[`${config.team}.${config.path}`]);

    rows.push({ config, rates, base });
  }
  return { base, rows, percent };
}

function formatSweepReport(sweep) {
  const lines = [];
  const baseStr = Object.entries(sweep.base)
    .map(([team, value]) => `${team} ${value.toFixed(1)}%`)
    .join(", ");
  lines.push(`Sensitivity sweep ±${sweep.percent}% (baseline: ${baseStr})`);
  lines.push("Cells: delta in percentage points vs baseline");
  lines.push("");
  const formatRow = cells => cells.map((c, i) => (i === 0 ? c.padEnd(24) : String(c).padStart(9))).join(" ");
  lines.push(formatRow(["Perturbation"].concat(TEAMS)));
  for (const row of sweep.rows) {
    const cells = [labelOf(row.config)];
    for (const team of TEAMS) {
      const d = (row.rates[team] ?? 0) - (row.base[team] ?? 0);
      cells.push((d >= 0 ? "+" : "") + d.toFixed(1));
    }
    lines.push(formatRow(cells));
  }
  lines.push("");
  lines.push("Best levers per team:");
  for (const team of TEAMS) {
    let best = null;
    let worst = null;
    let bestDelta = -Infinity;
    let worstDelta = Infinity;
    for (const row of sweep.rows) {
      if (!row.config.team) continue;
      const d = (row.rates[team] ?? 0) - (row.base[team] ?? 0);
      if (d > bestDelta) {
        bestDelta = d;
        best = row.config;
      }
      if (d < worstDelta) {
        worstDelta = d;
        worst = row.config;
      }
    }
    lines.push(
      `  ${team.padEnd(10)} raise: ${best ? labelOf(best) : "-"} (+${bestDelta.toFixed(1)}pp)   ` +
        `lower: ${worst ? labelOf(worst) : "-"} (${worstDelta.toFixed(1)}pp)`
    );
  }
  lines.push("");
  lines.push("Note: the sweep restores the config at the end. Perturbs one stat at a time.");
  return lines.join("\n");
}

const [, , mode, ...args] = process.argv;

if (mode === "sweep") {
  const runs = +args[0] || 2;
  const levels = +args[1] || 100;
  const percent = +args[2] || 15;
  const startTime = Date.now();
  const sweep = await runSweep(runs, levels, 16, percent);
  const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(formatSweepReport(sweep));
  console.log(`\n[${seconds}s]`);
} else if (mode === "focus") {
  const runs = +args[0] || 10;
  const levels = +args[1] || 100;
  const percent = +args[2] || 15;
  const paths = args.slice(3).join(",").split(",").filter(Boolean);
  const startTime = Date.now();
  const sweep = await runFocus(paths, runs, levels, 16, percent);
  const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(formatSweepReport(sweep));
  console.log(`\n[${seconds}s]`);
} else if (mode === "matchup") {
  const seeds = +args[0] || 12;
  const result = runMatchupSim({ seeds });
  console.log(formatMatchupReport(result));
} else {
  const runs = +args[0] || 10;
  const levels = +args[1] || 100;
  const startTime = Date.now();
  const results = [];
  for (let i = 0; i < runs; i++) results.push(await runCampaign({ maxLevel: levels, deltaTime: 16 }));
  const aggregate = aggregateRuns(results);
  console.log(formatReport(aggregate, { thresholdPp: 5 }));
  console.log(`\n[${((Date.now() - startTime) / 1000).toFixed(1)}s]`);
}
