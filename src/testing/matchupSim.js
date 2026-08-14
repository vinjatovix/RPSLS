/**
 * matchupSim.js - Simulador determinista de persecución 1v1
 * Reutiliza las clases reales de raza (Enemy) y su update() en un arena vacía,
 * SIN cluster: mide si un cazador alcanza y mata a su presa, y cuánto tarda.
 *
 * Es el diagnóstico que falta en el reporte de balance: la matriz real de
 * contadores (quién caza a quién) sin el ruido del fúnel central.
 *
 * Uso:
 *   const res = runMatchupSim({ seeds: 12 });
 *   formatMatchupReport(res);
 */

import { RACE_CLASSES } from "../entities/races.js";
import { RACE_STATS } from "../config/gameConfig.js";

export const TEAMS = Object.keys(RACE_STATS);

export const DEFAULT_ARENA = { width: 640, height: 384 };
const MAX_WIDTH = 5120;

/**
 * Fake game mínimo que satisface lo que Enemy usa en update():
 * canvasManager, options.mechanics y scoreManager. Nunca se dibuja.
 */
function makeFakeGame(arena) {
  const scale = arena.width / MAX_WIDTH;
  return {
    canvasManager: {
      getScale: () => scale,
      getCtx: () => null,
      getWidth: () => arena.width,
      getHeight: () => arena.height,
      getSize: () => ({ width: arena.width, height: arena.height }),
      getCenter: () => ({ x: arena.width / 2, y: arena.height / 2 }),
      getRandomSpawnPoint: () => ({ x: arena.width / 2, y: arena.height / 2 }),
      clampPosition: pos => ({
        x: Math.max(0, Math.min(pos.x, arena.width - pos.width)),
        y: Math.max(0, Math.min(pos.y, arena.height - pos.height))
      })
    },
    options: {
      mechanics: { limitCanvas: true, outDies: false },
      effects: {}
    },
    scoreManager: { recordKill: () => {} }
  };
}

/**
 * Una prueba: la presa espera en el centro del arena (como en el scrum real),
 * el cazador entra desde una distancia dada y tiene que acercarse y matarla.
 * Mide el tiempo real (acercamiento + daño) hasta el kill.
 */
function runTrial(chaserTeam, victimTeam, { arena, distance, dt, maxSteps }) {
  const game = makeFakeGame(arena);
  const cx = arena.width / 2;
  const midY = arena.height / 2;
  const chaser = new RACE_CLASSES[chaserTeam]({ game, x: cx + distance, y: midY });
  const victim = new RACE_CLASSES[victimTeam]({ game, x: cx, y: midY });
  const both = [chaser, victim];

  let steps = 0;
  while (steps < maxSteps) {
    chaser.update(dt, both);
    victim.update(dt, both);
    steps += 1;
    if (victim.dead) return { winner: chaserTeam, steps };
    if (chaser.dead) return { winner: victimTeam, steps };
  }
  return { winner: null, steps };
}

/**
 * Correr el simulador para todos los pares "debería contrarrestar" (B en aim de A).
 *
 * @param {Object} opts
 * @param {number} opts.seeds - Pruebas por par (default 12).
 * @param {number} opts.distance - Separación inicial en px (default 200).
 * @param {number} opts.dt - DeltaTime fijo en ms (default 16).
 * @param {number} opts.maxSteps - Pasos máx por prueba (default 12000 ≈ 192 s sim).
 * @param {Object} opts.arena - Tamaño del arena.
 */
export function runMatchupSim({
  seeds = 12,
  distance = 200,
  dt = 16,
  maxSteps = 12000,
  arena = DEFAULT_ARENA
} = {}) {
  const pairs = {};
  for (const chaser of TEAMS) {
    for (const victim of TEAMS) {
      if (!RACE_STATS[chaser].aim.includes(victim)) continue;
      let chaserWins = 0;
      let victimWins = 0;
      let timeouts = 0;
      let killStepsTotal = 0;
      for (let s = 0; s < seeds; s++) {
        const r = runTrial(chaser, victim, { arena, distance, dt, maxSteps });
        if (r.winner === chaser) {
          chaserWins += 1;
          killStepsTotal += r.steps;
        } else if (r.winner === victim) {
          victimWins += 1;
          killStepsTotal += r.steps;
        } else {
          timeouts += 1;
        }
      }
      const kills = chaserWins + victimWins;
      pairs[`${chaser}~${victim}`] = {
        chaser,
        victim,
        trials: seeds,
        chaserWins,
        victimWins,
        timeouts,
        killRate: seeds ? (chaserWins / seeds) * 100 : 0,
        avgKillMs: kills ? (killStepsTotal / kills) * dt : null
      };
    }
  }
  return { pairs };
}

function cell(result) {
  if (!result) return "  -  ";
  const pct = result.killRate;
  if (pct <= 0) return "0%";
  const tt = result.avgKillMs != null ? `${(result.avgKillMs / 1000).toFixed(1)}s` : "?";
  const detail = `${pct.toFixed(0)}%·${tt}`;
  return detail.padStart(7);
}

/**
 * Renderizar la matriz de persecución en texto plano.
 */
export function formatMatchupReport(res) {
  const L = [];
  L.push("Matchup 1v1 (persecucion real, sin cluster)");
  L.push("Cazador \\ presa     " + TEAMS.map(t => t.padStart(7)).join(""));
  for (const chaser of TEAMS) {
    const cells = [chaser.padEnd(17)];
    for (const victim of TEAMS) {
      cells.push(cell(res.pairs[`${chaser}~${victim}`]));
    }
    L.push(cells.join(""));
  }
  L.push("");
  L.push("Celda: %victorias del cazador sobre la presa en una persecucion 1v1 · tiempo medio de kill.");
  L.push("0% = el cazador NO alcanza a su presa en persecucion (solo mata en cluster).");
  return L.join("\n");
}
