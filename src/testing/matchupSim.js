/**
 * matchupSim.js - Deterministic 1v1 pursuit simulator
 * Reuses the real race classes (Enemy) and their update() in an empty arena,
 * WITHOUT cluster: measures whether a chaser catches and kills its prey, and how long it takes.
 *
 * It is the diagnosis missing from the balance report: the real matrix of
 * counters (who chases whom) without the noise of the central funnel.
 *
 * Usage:
 *   const result = runMatchupSim({ seeds: 12 });
 *   formatMatchupReport(result);
 */

import { RACE_CLASSES } from "../entities/races.js";
import { RACE_STATS } from "../config/gameConfig.js";

export const TEAMS = Object.keys(RACE_STATS);

export const DEFAULT_ARENA = { width: 640, height: 384 };
const MAX_WIDTH = 5120;

/**
 * Minimal fake game that satisfies what Enemy uses in update():
 * canvasAdapter, options.mechanics and scoreManager. Never draws.
 */
function makeFakeGame(arena) {
  const scale = arena.width / MAX_WIDTH;
  return {
    canvasAdapter: {
      getScale: () => scale,
      getContext: () => null,
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
 * A trial: the prey waits at the center of the arena (like in the real scrum),
 * the chaser enters from a given distance and must close in and kill it.
 * Measures the real time (approach + damage) until the kill.
 */
function runTrial(chaserTeam, victimTeam, { arena, distance, deltaTime, maxSteps }) {
  const game = makeFakeGame(arena);
  const centerX = arena.width / 2;
  const centerY = arena.height / 2;
  const chaser = new RACE_CLASSES[chaserTeam]({ game, x: centerX + distance, y: centerY });
  const victim = new RACE_CLASSES[victimTeam]({ game, x: centerX, y: centerY });
  const both = [chaser, victim];

  let steps = 0;
  while (steps < maxSteps) {
    chaser.update(deltaTime, both);
    victim.update(deltaTime, both);
    steps += 1;
    if (victim.dead) return { winner: chaserTeam, steps };
    if (chaser.dead) return { winner: victimTeam, steps };
  }
  return { winner: null, steps };
}

/**
 * Run the simulator for all "should-counter" pairs (B in A's aim).
 *
 * @param {Object} opts
 * @param {number} opts.seeds - Trials per pair (default 12).
 * @param {number} opts.distance - Initial separation in px (default 200).
 * @param {number} opts.deltaTime - Fixed delta time in ms (default 16).
 * @param {number} opts.maxSteps - Max steps per trial (default 12000 ≈ 192 s sim).
 * @param {Object} opts.arena - Arena size.
 */
export function runMatchupSim({
  seeds = 12,
  distance = 200,
  deltaTime = 16,
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
      for (let seedIndex = 0; seedIndex < seeds; seedIndex++) {
        const trialResult = runTrial(chaser, victim, { arena, distance, deltaTime, maxSteps });
        if (trialResult.winner === chaser) {
          chaserWins += 1;
          killStepsTotal += trialResult.steps;
        } else if (trialResult.winner === victim) {
          victimWins += 1;
          killStepsTotal += trialResult.steps;
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
        avgKillMs: kills ? (killStepsTotal / kills) * deltaTime : null
      };
    }
  }
  return { pairs };
}

function formatCell(result) {
  if (!result) return "  -  ";
  const percent = result.killRate;
  if (percent <= 0) return "0%";
  const timeToKill = result.avgKillMs != null ? `${(result.avgKillMs / 1000).toFixed(1)}s` : "?";
  const detail = `${percent.toFixed(0)}%·${timeToKill}`;
  return detail.padStart(7);
}

/**
 * Render the pursuit matrix in plain text.
 */
export function formatMatchupReport(result) {
  const lines = [];
  lines.push("Matchup 1v1 (real pursuit, no cluster)");
  lines.push("Chaser \\ prey     " + TEAMS.map(team => team.padStart(7)).join(""));
  for (const chaser of TEAMS) {
    const cells = [chaser.padEnd(17)];
    for (const victim of TEAMS) {
      cells.push(formatCell(result.pairs[`${chaser}~${victim}`]));
    }
    lines.push(cells.join(""));
  }
  lines.push("");
  lines.push("Cell: % chaser wins over prey in 1v1 pursuit · average time to kill.");
  lines.push("0% = the chaser does NOT catch its prey in pursuit (only kills in cluster).");
  return lines.join("\n");
}
