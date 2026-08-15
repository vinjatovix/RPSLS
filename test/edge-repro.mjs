/**
 * edge-repro.mjs - Repro del bug de outDies en presas que huyen.
 * Una presa (papers) en el borde izquierdo huye de su predador (scissors),
 * apuntando hacia fuera con velocidad máxima. Antes el clamp la salvaba;
 * ahora debe morir por outDies al cruzar la frontera.
 *   node test/edge-repro.mjs
 */

import "./dom-stub.js";
import { RACE_CLASSES } from "../src/entities/races.js";

const W = 640;
const H = 384;
const scale = W / 5120;

function makeGame() {
  return {
    gameTime: 0,
    canvasManager: {
      getScale: () => scale,
      getCtx: () => null,
      getWidth: () => W,
      getHeight: () => H,
      getSize: () => ({ width: W, height: H }),
      getCenter: () => ({ x: W / 2, y: H / 2 }),
      getRandomSpawnPoint: () => ({ x: W / 2, y: H / 2 }),
      clampPosition: pos => ({
        x: Math.max(0, Math.min(pos.x, W - pos.width)),
        y: Math.max(0, Math.min(pos.y, H - pos.height))
      })
    },
    options: { mechanics: { limitCanvas: false, outDies: true }, effects: {} },
    scoreManager: { recordKill: () => {} }
  };
}

const scenarios = [
  { name: "papers escapa de scissors (muro izq)", victim: "papers", pred: "scissors", x: 5, angle: Math.PI },
  { name: "papers escapa de scissors (muro der)", victim: "papers", pred: "scissors", x: W - 25, angle: 0 }
];

for (const sc of scenarios) {
  const game = makeGame();
  const victim = new RACE_CLASSES[sc.victim]({ game, x: sc.x, y: H / 2, angle: sc.angle });
  const predator = new RACE_CLASSES[sc.pred]({ game, x: sc.x < 100 ? 300 : 340, y: H / 2 });
  victim.speed = victim.maxSpeed;
  victim.vx = Math.cos(victim.angle) * victim.speed;
  victim.vy = Math.sin(victim.angle) * victim.speed;

  const both = [victim, predator];
  let offScreenFrame = -1;
  let deadFrame = -1;
  let fleeFrames = 0;
  let minX = victim.x;
  for (let f = 0; f < 3000; f++) {
    victim.update(16, both);
    predator.update(16, both);
    minX = Math.min(minX, victim.x);
    if (victim.fleeing) fleeFrames++;
    if (victim.offScreen && offScreenFrame < 0) offScreenFrame = f;
    if (victim.dead) {
      deadFrame = f;
      break;
    }
  }
  console.log(
    `${sc.name}: fleeing=${fleeFrames} frames | minX=${minX.toFixed(1)} | ` +
      `offScreen@${offScreenFrame >= 0 ? offScreenFrame : "nunca"} | ` +
      `dead@${deadFrame >= 0 ? deadFrame : "nunca"}${victim.killedBy ? ` killedBy=${victim.killedBy}` : ""}`
  );
}
