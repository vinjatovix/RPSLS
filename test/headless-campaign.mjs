/**
 * headless-campaign.mjs - Ejecuta el sim de balance SIN navegador.
 * Reusa runCampaign de balanceRunner.js (Game real en fast-forward).
 *
 * Uso:
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

function labelOf(cfg) {
  if (cfg.timer === "base") return `timer.base ${cfg.dir > 0 ? "+" : ""}${cfg.dir * cfg.pct}%`;
  if (cfg.timer === "growth") return `timer.growth ${cfg.dir > 0 ? "+" : ""}${cfg.dir * cfg.pct}%`;
  if (cfg.ai === "dangerRadius") return `ai.dangerRadius ${cfg.dir > 0 ? "+" : ""}${cfg.dir * cfg.pct}%`;
  return `${cfg.team}.${cfg.name} ${cfg.dir > 0 ? "+" : ""}${cfg.dir * cfg.pct}%`;
}

async function runShort(runs, levels, dt) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    results.push(await runCampaign({ maxLevel: levels, dt }));
  }
  return results.length ? aggregateRuns(results) : null;
}

function winRates(agg) {
  const out = {};
  if (agg) for (const team of TEAMS) out[team] = agg.teams[team].winRate;
  return out;
}

function statPathOf(name) {
  const hit = SWEEP_STAT_PATHS.find(([n]) => n === name);
  return hit ? hit[1] : name;
}

async function runFocus(paths, runs, levels, dt, pct) {
  process.stdout.write(`[focus] baseline ${runs}x${levels}...\n`);
  const t0 = Date.now();
  const base = winRates(await runShort(runs, levels, dt));

  const configs = [];
  for (const p of paths) {
    const [team, ...rest] = p.split(".");
    const path = statPathOf(rest.join("."));
    for (const dir of [-1, 1]) configs.push({ team, name: rest.join("."), path, dir, pct });
  }

  const rows = [];
  for (let ci = 0; ci < configs.length; ci++) {
    const cfg = configs[ci];
    process.stdout.write(
      `[focus] ${ci + 1}/${configs.length} ${labelOf(cfg)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`
    );
    const cur = readPath(RACE_STATS[cfg.team], cfg.path);
    writePath(RACE_STATS[cfg.team], cfg.path, Math.max(Math.abs(cur) * 0.01, cur * (1 + (cfg.dir * pct) / 100)));
    const rates = winRates(await runShort(runs, levels, dt));
    writePath(RACE_STATS[cfg.team], cfg.path, cur);
    rows.push({ cfg, rates, base });
  }
  return { base, rows, pct };
}

async function runSweep(runs, levels, dt, pct) {
  process.stdout.write(`[sweep] baseline ${runs}x${levels}...\n`);
  const t0 = Date.now();
  const base = winRates(await runShort(runs, levels, dt));

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
      for (const dir of [-1, 1]) configs.push({ team, name, path, dir, pct });
  for (const timer of ["base", "growth"]) for (const dir of [-1, 1]) configs.push({ timer, dir, pct });
  for (const dir of [-1, 1]) configs.push({ ai: "dangerRadius", dir, pct });

  const rows = [];
  for (let ci = 0; ci < configs.length; ci++) {
    const cfg = configs[ci];
    process.stdout.write(
      `[sweep] ${ci + 1}/${configs.length} ${labelOf(cfg)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`
    );
    if (cfg.timer === "base") {
      GAME_CONFIG.mechanics.matchTimeBaseMs = Math.max(1000, timerBase * (1 + (cfg.dir * pct) / 100));
    } else if (cfg.timer === "growth") {
      GAME_CONFIG.mechanics.matchTimeGrowthMs = Math.max(0, timerGrowth * (1 + (cfg.dir * pct) / 100));
    } else if (cfg.ai === "dangerRadius") {
      GAME_CONFIG.mechanics.ai.dangerRadius = Math.max(20, dangerBase * (1 + (cfg.dir * pct) / 100));
    } else {
      const cur = readPath(RACE_STATS[cfg.team], cfg.path);
      writePath(RACE_STATS[cfg.team], cfg.path, Math.max(Math.abs(cur) * 0.01, cur * (1 + (cfg.dir * pct) / 100)));
    }

    const rates = winRates(await runShort(runs, levels, dt));

    if (cfg.timer === "base") GAME_CONFIG.mechanics.matchTimeBaseMs = timerBase;
    else if (cfg.timer === "growth") GAME_CONFIG.mechanics.matchTimeGrowthMs = timerGrowth;
    else if (cfg.ai === "dangerRadius") GAME_CONFIG.mechanics.ai.dangerRadius = dangerBase;
    else writePath(RACE_STATS[cfg.team], cfg.path, baseline[`${cfg.team}.${cfg.path}`]);

    rows.push({ cfg, rates, base });
  }
  return { base, rows, pct };
}

function formatSweepReport(sweep) {
  const L = [];
  const baseStr = Object.entries(sweep.base)
    .map(([t, v]) => `${t} ${v.toFixed(1)}%`)
    .join(", ");
  L.push(`Barrido de sensibilidad ±${sweep.pct}% (baseline: ${baseStr})`);
  L.push("Celdas: delta en puntos porcentuales respecto al baseline");
  L.push("");
  const rowCells = cells => cells.map((c, i) => (i === 0 ? c.padEnd(24) : String(c).padStart(9))).join(" ");
  L.push(rowCells(["Perturbacion"].concat(TEAMS)));
  for (const r of sweep.rows) {
    const cells = [labelOf(r.cfg)];
    for (const team of TEAMS) {
      const d = (r.rates[team] ?? 0) - (r.base[team] ?? 0);
      cells.push((d >= 0 ? "+" : "") + d.toFixed(1));
    }
    L.push(rowCells(cells));
  }
  L.push("");
  L.push("Mejores palancas por equipo:");
  for (const team of TEAMS) {
    let best = null;
    let worst = null;
    let bd = -Infinity;
    let wd = Infinity;
    for (const r of sweep.rows) {
      if (!r.cfg.team) continue;
      const d = (r.rates[team] ?? 0) - (r.base[team] ?? 0);
      if (d > bd) {
        bd = d;
        best = r.cfg;
      }
      if (d < wd) {
        wd = d;
        worst = r.cfg;
      }
    }
    L.push(
      `  ${team.padEnd(10)} subir: ${best ? labelOf(best) : "-"} (+${bd.toFixed(1)}pp)   ` +
        `bajar: ${worst ? labelOf(worst) : "-"} (${wd.toFixed(1)}pp)`
    );
  }
  L.push("");
  L.push("Nota: el barrido restaura la config al final. Perturba un stat cada vez.");
  return L.join("\n");
}

const [, , mode, ...args] = process.argv;

if (mode === "sweep") {
  const runs = +args[0] || 2;
  const levels = +args[1] || 100;
  const pct = +args[2] || 15;
  const t0 = Date.now();
  const sweep = await runSweep(runs, levels, 16, pct);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(formatSweepReport(sweep));
  console.log(`\n[${secs}s]`);
} else if (mode === "focus") {
  const runs = +args[0] || 10;
  const levels = +args[1] || 100;
  const pct = +args[2] || 15;
  const paths = args.slice(3).join(",").split(",").filter(Boolean);
  const t0 = Date.now();
  const sweep = await runFocus(paths, runs, levels, 16, pct);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(formatSweepReport(sweep));
  console.log(`\n[${secs}s]`);
} else if (mode === "matchup") {
  const seeds = +args[0] || 12;
  const res = runMatchupSim({ seeds });
  console.log(formatMatchupReport(res));
} else {
  const runs = +args[0] || 10;
  const levels = +args[1] || 100;
  const t0 = Date.now();
  const results = [];
  for (let i = 0; i < runs; i++) results.push(await runCampaign({ maxLevel: levels, dt: 16 }));
  const agg = aggregateRuns(results);
  console.log(formatReport(agg, { thresholdPp: 5 }));
  console.log(`\n[${((Date.now() - t0) / 1000).toFixed(1)}s]`);
}
