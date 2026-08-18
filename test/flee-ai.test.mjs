import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pickEscapePoint,
  clearanceToBoundary,
  CLEARANCE_SATURATE
} from "../src/canvas/index.js";
import { RACE_CLASSES } from "../src/entities/index.js";

const ARENA = { width: 640, height: 384 };
const MARGIN = 30;

function makeFakeGame(arena) {
  const scale = arena.width / 5120;
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

test("Scenario 1 - open field: predator to the right, prey at center", () => {
  const aim = fleeAim("scissors", "rocks", { x: 320, y: 192 }, { x: 520, y: 192 });
  assert.ok(aim.aimX < 320, `flees to the left (aimX=${aim.aimX})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 2 - against the right wall with predator to the left", () => {
  const aim = fleeAim("scissors", "rocks", { x: 580, y: 192 }, { x: 520, y: 192 });
  assert.ok(Math.abs(aim.aimY - 192) > 100, `escapes vertically, not into the wall (aimY=${aim.aimY})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 3 - in the bottom-left corner with predator inside", () => {
  const aim = fleeAim("scissors", "rocks", { x: 40, y: 344 }, { x: 120, y: 264 });
  const cornerDist = Math.hypot(aim.aimX, ARENA.height - aim.aimY);
  assert.ok(cornerDist > 100, `moves away from the corner, does not box itself in (dist=${cornerDist.toFixed(0)})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 4 - threat behind with open space ahead", () => {
  const aim = fleeAim("scissors", "rocks", { x: 320, y: 192 }, { x: 120, y: 192 });
  assert.ok(aim.aimX > 320, `flees toward the open space (aimX=${aim.aimX})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 5 - solver: clearance bias (straight = corner, tangential = open)", () => {
  const pos = { x: 40, y: 344 };
  const threat = { x: 120, y: 264 };
  const config = { margin: MARGIN, radius: 300 };
  const aim = pickEscapePoint(pos, threat, ARENA, config);
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
  assert.ok(
    straightClear < CLEARANCE_SATURATE && aimClear > straightClear,
    `aim clearance (${aimClear.toFixed(0)}) > straight clearance to the corner (${straightClear.toFixed(0)})`
  );
  assert.ok(
    aim.x >= MARGIN && aim.x <= ARENA.width - MARGIN &&
    aim.y >= MARGIN && aim.y <= ARENA.height - MARGIN,
    `aim in-bounds (${aim.x}, ${aim.y})`
  );
});
