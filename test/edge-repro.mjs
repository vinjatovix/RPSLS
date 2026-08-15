/**
 * edge-repro.mjs - Reproduction of the outDies bug on fleeing prey.
 * A prey (papers) at the left edge flees from its predator (scissors),
 * aiming outward at max speed. Before, the clamp saved it; now it must
 * die from outDies when crossing the boundary.
 *   node test/edge-repro.mjs
 */

import "./dom-stub.js";
import { RACE_CLASSES } from "../src/entities/races.js";

const WIDTH = 640;
const HEIGHT = 384;
const scale = WIDTH / 5120;

function makeGame() {
  return {
    gameTime: 0,
    canvasAdapter: {
      getScale: () => scale,
      getContext: () => null,
      getWidth: () => WIDTH,
      getHeight: () => HEIGHT,
      getSize: () => ({ width: WIDTH, height: HEIGHT }),
      getCenter: () => ({ x: WIDTH / 2, y: HEIGHT / 2 }),
      getRandomSpawnPoint: () => ({ x: WIDTH / 2, y: HEIGHT / 2 }),
      clampPosition: pos => ({
        x: Math.max(0, Math.min(pos.x, WIDTH - pos.width)),
        y: Math.max(0, Math.min(pos.y, HEIGHT - pos.height))
      })
    },
    options: { mechanics: { limitCanvas: false, outDies: true }, effects: {} },
    scoreManager: { recordKill: () => {} }
  };
}

const scenarios = [
  { name: "papers escapes from scissors (left wall)", victim: "papers", pred: "scissors", x: 5, angle: Math.PI },
  { name: "papers escapes from scissors (right wall)", victim: "papers", pred: "scissors", x: WIDTH - 25, angle: 0 }
];

for (const scenario of scenarios) {
  const game = makeGame();
  const victim = new RACE_CLASSES[scenario.victim]({ game, x: scenario.x, y: HEIGHT / 2, angle: scenario.angle });
  const predator = new RACE_CLASSES[scenario.pred]({ game, x: scenario.x < 100 ? 300 : 340, y: HEIGHT / 2 });
  victim.speed = victim.maxSpeed;
  victim.velocityX = Math.cos(victim.angle) * victim.speed;
  victim.velocityY = Math.sin(victim.angle) * victim.speed;

  const both = [victim, predator];
  let offScreenFrame = -1;
  let deadFrame = -1;
  let fleeFrames = 0;
  let minX = victim.x;
  for (let frame = 0; frame < 3000; frame++) {
    victim.update(16, both);
    predator.update(16, both);
    minX = Math.min(minX, victim.x);
    if (victim.fleeing) fleeFrames++;
    if (victim.offScreen && offScreenFrame < 0) offScreenFrame = frame;
    if (victim.dead) {
      deadFrame = frame;
      break;
    }
  }
  console.log(
    `${scenario.name}: fleeing=${fleeFrames} frames | minX=${minX.toFixed(1)} | ` +
      `offScreen@${offScreenFrame >= 0 ? offScreenFrame : "never"} | ` +
      `dead@${deadFrame >= 0 ? deadFrame : "never"}${victim.killedBy ? ` killedBy=${victim.killedBy}` : ""}`
  );
}
