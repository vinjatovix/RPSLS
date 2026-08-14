/**
 * balanceRunner.js - Harness de simulación de balance de equipos
 * Corre el motor real del juego (Game) en fast-forward SIN renderizar,
 * con condiciones controladas y sin tocar el save real del jugador.
 *
 * Uso (desde una página, ver test/balance-sim.html):
 *   const result = await runCampaign({ maxLevel: 100 });
 *   const agg = aggregateRuns([result]);
 *   formatReport(agg);
 */

import { Game } from "../index.js";
import { RACE_STATS } from "../config/gameConfig.js";

export const TEAMS = Object.keys(RACE_STATS);
export const BUCKET_SIZE = 25;
export const CHUNK_STEPS = 2000;
export const MAX_STEPS_PER_RUN = 500000;

let installed = false;

/**
 * Aislar el entorno de prueba:
 * - Evita que index.js auto-arranque el juego real (rAF) al importar.
 * - Sustituye localStorage por un fake en memoria (el save del jugador no se toca).
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
    // Fallback para navegadores que no permiten redefinir window.localStorage:
    // se hace con el parche del prototype de Storage de abajo.
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

function bucketOf(match, nbuckets) {
  return Math.min(nbuckets - 1, Math.floor((match - 1) / BUCKET_SIZE));
}

/**
 * Simular una campaña de niveles con el motor real del juego.
 * Cada match equivale a subir 1 nivel (Game.#restart incrementa match).
 *
 * @param {Object} opts
 * @param {number} opts.maxLevel - Nivel final de la campaña (matches por run).
 * @param {number} opts.dt - DeltaTime fijo en ms (16 ≈ 60fps del juego real).
 * @param {boolean} opts.capture - Activar mecánica de capture (default: false).
 * @param {boolean} opts.powerups - Activar powerups (default: false).
 * @param {(info) => boolean} [opts.onProgress] - Devuelve true para cancelar.
 * @returns {Promise<Object>} Estadísticas agregadas del run.
 */
export async function runCampaign({
  maxLevel = 100,
  dt = 16,
  capture = false,
  powerups = false,
  onProgress = null
} = {}) {
  installTestEnv();

  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.progressManager.awardCredits = () => {};
  game.match = 0;
  game.onTeamChanged();

  game.inputHandler.setKeyState("c", capture);
  game.inputHandler.setKeyState("o", true);
  if (!powerups) game.powerupTimer = Infinity;

  const nbuckets = Math.max(1, Math.ceil(maxLevel / BUCKET_SIZE));
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
    final2: {},
    final2Winners: {},
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
  for (let i = 0; i < nbuckets; i++) {
    const bucket = {};
    for (const team of TEAMS) bucket[team] = 0;
    stats.buckets.push(bucket);
  }

  const unsubWin = game.eventBus.subscribe("match-win", ({ team, match }) => {
    stats.wins[team] += 1;
    stats.buckets[bucketOf(match, nbuckets)][team] += 1;
  });
  const unsubKill = game.eventBus.subscribe("kill", ({ killerTeam, victimTeam }) => {
    stats.kills[killerTeam] += 1;
    stats.deaths[victimTeam] += 1;
    stats.matrix[killerTeam][victimTeam] += 1;
  });

  let steps = 0;
  let simMs = 0;
  let matchStartMs = 0;
  const matchDurations = [];

  while (game.match <= maxLevel) {
    const matchBefore = game.match;
    const aliveBefore = [...new Set(game.enemies.filter(enemy => !enemy.dead).map(enemy => enemy.team))];
    game.update(dt);
    steps += 1;
    simMs += dt;
    if (game.match !== matchBefore) {
      matchDurations.push(simMs - matchStartMs);
      matchStartMs = simMs;
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
        stats.final2[key] = (stats.final2[key] || 0) + 1;
        stats.final2Winners[key] = stats.final2Winners[key] || {};
        stats.final2Winners[key][game.lastWin] =
          (stats.final2Winners[key][game.lastWin] || 0) + 1;
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

  const totalWins = Object.values(stats.wins).reduce((a, b) => a + b, 0);
  stats.matches = Math.max(0, game.match - 1);
  stats.draws = Math.max(0, stats.matches - totalWins);
  stats.steps = steps;
  stats.avgMatchMs = matchDurations.length
    ? matchDurations.reduce((a, b) => a + b, 0) / matchDurations.length
    : 0;

  unsubWin();
  unsubKill();
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
 * Agregar varios runs en métricas por equipo y por tramo de niveles.
 */
export function aggregateRuns(runs) {
  const n = runs.length;
  const totalMatches = sum(runs.map(r => r.matches));
  const mpr = Math.round(totalMatches / Math.max(1, n));
  const nbuckets = Math.max(0, ...runs.map(r => r.buckets.length));

  const agg = {
    runs: n,
    totalMatches,
    draws: sum(runs.map(r => r.draws)),
    avgMatchMs: totalMatches ? sum(runs.map(r => r.avgMatchMs * r.matches)) / totalMatches : 0,
    matrix: {},
    endModes: { elimination: 0, countdown2: 0, draw: 0 },
    teams: {},
    buckets: [],
    bucketSizes: [],
    final2: {},
    final2Winners: {},
    winByMode: {}
  };

  for (const team of TEAMS) {
    agg.matrix[team] = {};
    for (const victim of TEAMS) agg.matrix[team][victim] = 0;
    agg.winByMode[team] = { elimination: 0, countdown2: 0 };
  }
  for (const run of runs) {
    for (const killer of TEAMS) {
      for (const victim of TEAMS) {
        agg.matrix[killer][victim] += run.matrix?.[killer]?.[victim] ?? 0;
      }
    }
    agg.endModes.elimination += run.endModes?.elimination ?? 0;
    agg.endModes.countdown2 += run.endModes?.countdown2 ?? 0;
    agg.endModes.draw += run.endModes?.draw ?? 0;
    for (const [key, count] of Object.entries(run.final2 ?? {})) {
      agg.final2[key] = (agg.final2[key] || 0) + count;
    }
    for (const [key, winners] of Object.entries(run.final2Winners ?? {})) {
      agg.final2Winners[key] = agg.final2Winners[key] || {};
      for (const [team, count] of Object.entries(winners)) {
        agg.final2Winners[key][team] = (agg.final2Winners[key][team] || 0) + count;
      }
    }
    for (const team of TEAMS) {
      const wm = run.winByMode?.[team] ?? { elimination: 0, countdown2: 0 };
      agg.winByMode[team].elimination += wm.elimination ?? 0;
      agg.winByMode[team].countdown2 += wm.countdown2 ?? 0;
    }
  }

  for (const team of TEAMS) {
    const winsByRun = runs.map(r => r.wins[team] ?? 0);
    const winsRateByRun = winsByRun.map((w, i) => (w / Math.max(1, runs[i].matches)) * 100);
    const kills = sum(runs.map(r => r.kills[team] ?? 0));
    const deaths = sum(runs.map(r => r.deaths[team] ?? 0));
    const totalWins = sum(winsByRun);
    agg.teams[team] = {
      wins: totalWins,
      winRate: totalMatches ? (totalWins / totalMatches) * 100 : 0,
      kills,
      deaths,
      kd: deaths ? kills / deaths : kills,
      minWinRate: winsRateByRun.length ? Math.min(...winsRateByRun) : 0,
      maxWinRate: winsRateByRun.length ? Math.max(...winsRateByRun) : 0,
      std: sampleStd(winsRateByRun)
    };
  }

  for (let i = 0; i < nbuckets; i++) {
    const bucket = {};
    for (const team of TEAMS) bucket[team] = 0;
    for (const run of runs) {
      const runBucket = run.buckets[i];
      if (!runBucket) continue;
      for (const team of TEAMS) bucket[team] += runBucket[team] ?? 0;
    }
    agg.buckets.push(bucket);
    const first = i * BUCKET_SIZE + 1;
    const last = i === nbuckets - 1 ? mpr : (i + 1) * BUCKET_SIZE;
    agg.bucketSizes.push({ min: first, max: last, count: last - first + 1 });
  }

  return agg;
}

/**
 * Renderizar el reporte en texto plano (monoespaciado).
 */
export function formatReport(agg, { thresholdPp = 5 } = {}) {
  const EXPECTED = 20;
  const L = [];

  L.push("== REPORTE DE BALANCE - sin upgrades comprados ==");
  L.push(
    `Runs: ${agg.runs} | Matches: ${agg.totalMatches} | Draws: ${agg.draws} | ` +
      `Match medio: ${agg.avgMatchMs.toFixed(0)} ms simulados`
  );
  L.push("");

  const row = cells =>
    cells.map((c, i) => (i === 0 ? c.padEnd(14) : c.padStart(9))).join(" ");

  L.push(row(["Equipo", "Wins", "WinRate", "Kills", "Muertes", "K/D", "min", "max", "sigma"]));
  for (const team of TEAMS) {
    const t = agg.teams[team];
    L.push(
      row([
        team,
        String(t.wins),
        t.winRate.toFixed(1) + "%",
        String(t.kills),
        String(t.deaths),
        t.kd.toFixed(2),
        t.minWinRate.toFixed(1) + "%",
        t.maxWinRate.toFixed(1) + "%",
        t.std.toFixed(2)
      ])
    );
  }

  L.push("");
  L.push("Muertes por killer -> victima (total en todos los runs):");
  L.push(row(["killer\\victima"].concat(TEAMS)));
  for (const killer of TEAMS) {
    const cells = [killer];
    for (const victim of TEAMS) cells.push(String(agg.matrix[killer][victim]));
    L.push(row(cells));
  }

  const totalEnd = agg.endModes.elimination + agg.endModes.countdown2 + agg.endModes.draw;
  if (totalEnd) {
    L.push("");
    L.push("Fin de match:");
    L.push(
      `  Eliminacion (queda 1 equipo):   ${agg.endModes.elimination} (${((agg.endModes.elimination / totalEnd) * 100).toFixed(1)}%)`
    );
    L.push(
      `  Tiempo agotado, 2 equipos:      ${agg.endModes.countdown2} (${((agg.endModes.countdown2 / totalEnd) * 100).toFixed(1)}%)`
    );
    L.push(
      `  Empate (tiempo agotado, >=3):   ${agg.endModes.draw} (${((agg.endModes.draw / totalEnd) * 100).toFixed(1)}%)`
    );
  }

  const winRows = Object.keys(agg.winByMode).filter(team => {
    const wm = agg.winByMode[team];
    return wm.elimination + wm.countdown2 > 0;
  });
  if (winRows.length) {
    L.push("");
    L.push("Wins por fin del match (descomposicion por equipo):");
    for (const team of winRows) {
      const wm = agg.winByMode[team];
      const tot = wm.elimination + wm.countdown2;
      L.push(
        `  ${team.padEnd(10)} elim ${String(wm.elimination).padStart(5)} (${((wm.elimination / tot) * 100).toFixed(0).padStart(2)}%)  ` +
          `countdown ${String(wm.countdown2).padStart(5)} (${((wm.countdown2 / tot) * 100).toFixed(0).padStart(2)}%)`
      );
    }
  }

  const final2Keys = Object.entries(agg.final2).sort((a, b) => b[1] - a[1]);
  if (final2Keys.length) {
    L.push("");
    L.push("Parejas final-2 en countdown2 (quien llega al desempate y quien gana):");
    L.push("  pareja" + " ".repeat(12) + "veces   ganador(es)");
    for (const [key, count] of final2Keys) {
      const winners = Object.entries(agg.final2Winners[key] || {})
        .sort((a, b) => b[1] - a[1])
        .map(([team, w]) => `${team}: ${w}`)
        .join(", ");
      const pct = agg.endModes.countdown2
        ? ((count / agg.endModes.countdown2) * 100).toFixed(1)
        : "0";
      L.push(`  ${key.padEnd(16)} ${String(count).padStart(5)} (${pct.padStart(4)}%)  ${winners}`);
    }
  }

  L.push("");
  L.push(`Veredicto (equilibrio perfecto = ${EXPECTED}% por equipo, umbral ±${thresholdPp}pp):`);
  let worst = 0;
  for (const team of TEAMS) {
    const t = agg.teams[team];
    const dev = t.winRate - EXPECTED;
    worst = Math.max(worst, Math.abs(dev));
    const ok = Math.abs(dev) <= thresholdPp;
    L.push(
      `  ${team.padEnd(10)} ${t.winRate.toFixed(1).padStart(5)}%  ` +
        (ok ? "ok equilibrado" : "!! FUERA DE RANGO") +
        `  (${dev >= 0 ? "+" : ""}${dev.toFixed(1)}pp)`
    );
  }
  L.push(
    `  -> Mayor desviacion: ${worst.toFixed(1)}pp ` +
      (worst <= thresholdPp ? "(todas las razas dentro de rango)" : "(hay razas desbalanceadas)")
  );

  if (agg.buckets.length) {
    L.push("");
    L.push("Wins por tramo de niveles (% de matches del tramo):");
    L.push(
      row(["Tramo"].concat(agg.bucketSizes.map(s => `${s.min}-${s.max}`)))
    );
    agg.buckets.forEach((bucket, i) => {
      const size = agg.bucketSizes[i].count * agg.runs;
      const cells = [`niveles ${agg.bucketSizes[i].min}-${agg.bucketSizes[i].max}`];
      for (const team of TEAMS) {
        cells.push(size ? ((bucket[team] / size) * 100).toFixed(1) + "%" : "0.0%");
      }
      L.push(row(cells));
    });
  }

  return L.join("\n");
}

installTestEnv();
