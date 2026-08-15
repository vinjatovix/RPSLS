/**
 * flee-ai.mjs - Verifica la dirección de huida con conciencia del espacio.
 * Escenarios deterministas (posiciones/ángulos explícitos) con el patrón
 * fake-game de matchupSim: la presa no tiene presas que cazar, así que
 * #setTarget dispara #flee contra el predador.
 *
 *   node test/flee-ai.mjs
 */

import {
  pickEscapePoint,
  clearanceToBoundary,
  CLEARANCE_SATURATE
} from "../src/canvas/geometry/EscapeSolver.js";
import { RACE_CLASSES } from "../src/entities/races.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ok - ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL - ${label}`);
  }
}

const ARENA = { width: 640, height: 384 };
const MARGIN = 30;

/**
 * Fake game mínimo que satisface lo que Enemy usa en update().
 * Igual patrón que src/testing/matchupSim.js.
 */
function makeFakeGame(arena) {
  const scale = arena.width / 5120;
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

function fleeAim(preyTeam, predatorTeam, prey, pred, arena = ARENA) {
  const game = makeFakeGame(arena);
  const preyEnemy = new RACE_CLASSES[preyTeam]({
    game,
    x: prey.x,
    y: prey.y,
    angle: Math.PI
  });
  const predEnemy = new RACE_CLASSES[predatorTeam]({
    game,
    x: pred.x,
    y: pred.y,
    angle: 0
  });
  preyEnemy.update(16, [preyEnemy, predEnemy]);
  return { aimX: preyEnemy.aimX, aimY: preyEnemy.aimY };
}

function inBounds(aim) {
  return (
    aim.aimX >= MARGIN && aim.aimX <= ARENA.width - MARGIN &&
    aim.aimY >= MARGIN && aim.aimY <= ARENA.height - MARGIN
  );
}

console.log("Escenario 1 - campo abierto: predador a la derecha, presa al centro");
{
  const aim = fleeAim("scissors", "rocks", { x: 320, y: 192 }, { x: 520, y: 192 });
  assert(aim.aimX < 320, `huye hacia la izquierda (aimX=${aim.aimX})`);
  assert(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
}

console.log("Escenario 2 - pegado al muro derecho con predador a la izquierda");
{
  const aim = fleeAim("scissors", "rocks", { x: 580, y: 192 }, { x: 520, y: 192 });
  assert(Math.abs(aim.aimY - 192) > 100, `escapa en vertical, no contra la pared (aimY=${aim.aimY})`);
  assert(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
}

console.log("Escenario 3 - en la esquina inferior-izquierda con predador dentro");
{
  const aim = fleeAim("scissors", "rocks", { x: 40, y: 344 }, { x: 120, y: 264 });
  const cornerDist = Math.hypot(aim.aimX, ARENA.height - aim.aimY);
  assert(cornerDist > 100, `se aleja de la esquina, no se encajona (dist=${cornerDist.toFixed(0)})`);
  assert(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
}

console.log("Escenario 4 - threat detrás con espacio abierto al frente");
{
  const aim = fleeAim("scissors", "rocks", { x: 320, y: 192 }, { x: 120, y: 192 });
  assert(aim.aimX > 320, `huye hacia el espacio abierto (aimX=${aim.aimX})`);
  assert(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
}

console.log("Escenario 5 - solver: sesgo por clearance (recto = esquina, tangencial = abierto)");
{
  const pos = { x: 40, y: 344 };
  const threat = { x: 120, y: 264 };
  const cfg = { margin: MARGIN, radius: 300 };
  const aim = pickEscapePoint(pos, threat, ARENA, cfg);
  const straight = 135 * Math.PI / 180;
  const straightClear = clearanceToBoundary(
    pos.x, pos.y, Math.cos(straight), Math.sin(straight), ARENA.width, ARENA.height
  );
  const aimDirX = aim.x - pos.x;
  const aimDirY = aim.y - pos.y;
  const aimDist = Math.hypot(aimDirX, aimDirY) || 1;
  const aimClear = clearanceToBoundary(
    pos.x, pos.y, aimDirX / aimDist, aimDirY / aimDist, ARENA.width, ARENA.height
  );
  assert(
    straightClear < CLEARANCE_SATURATE && aimClear > straightClear,
    `clearance del aim (${aimClear.toFixed(0)}) > clearance recto a la esquina (${straightClear.toFixed(0)})`
  );
  assert(
    aim.x >= MARGIN && aim.x <= ARENA.width - MARGIN &&
    aim.y >= MARGIN && aim.y <= ARENA.height - MARGIN,
    `aim in-bounds (${aim.x}, ${aim.y})`
  );
}

console.log(`\n${passed} ok, ${failed} fallos`);
process.exit(failed ? 1 : 0);
