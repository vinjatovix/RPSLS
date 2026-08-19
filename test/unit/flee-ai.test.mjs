import { test } from "node:test";
import assert from "node:assert/strict";

import { GAME_CONFIG } from "../../src/config/gameConfig.js";
import {
  pickEscapePoint,
  clearanceToBoundary,
  CLEARANCE_SATURATE
} from "../../src/canvas/index.js";
import { EnemyBuilder } from "../builders/EnemyBuilder.mjs";
import { FakeGame } from "../doubles/FakeGame.mjs";
import { TICK_MS } from "../doubles/setupSimulationContext.mjs";

const ARENA = { width: GAME_CONFIG.display.minWidth, height: GAME_CONFIG.display.minHeight };
const MARGIN = GAME_CONFIG.mechanics.ai.escape.margin;

const CENTER_X = ARENA.width / 2;
const CENTER_Y = ARENA.height / 2;
const DANGER_RADIUS = GAME_CONFIG.mechanics.ai.dangerRadius;
const ESCAPE_DISTANCE_THRESHOLD = 100;
const NEAR_CORNER_OFFSET = 40;
const THREAT_OFFSET = 80;

function fleeAim(preyTeam, predatorTeam, prey, pred, arena = ARENA) {
  const game = new FakeGame({ width: arena.width, height: arena.height });
  game.canvasAdapter.getScale = () => arena.width / GAME_CONFIG.display.maxWidth;
  game.options.mechanics.outDies = false;

  const preyEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(preyTeam)
    .withPosition(prey.x, prey.y)
    .withAngle(Math.PI)
    .build();

  const predEnemy = new EnemyBuilder()
    .withGame(game)
    .withTeam(predatorTeam)
    .withPosition(pred.x, pred.y)
    .withAngle(0)
    .build();

  game.enemies = [preyEnemy, predEnemy];

  preyEnemy.update(TICK_MS, [preyEnemy, predEnemy]);
  return { aimX: preyEnemy.aimX, aimY: preyEnemy.aimY };
}

function inBounds(aim) {
  return (
    aim.aimX >= MARGIN && aim.aimX <= ARENA.width - MARGIN &&
    aim.aimY >= MARGIN && aim.aimY <= ARENA.height - MARGIN
  );
}

test("Scenario 1 - open field: predator to the right, prey at center", () => {
  const preyPosAtCenter = { x: CENTER_X, y: CENTER_Y };
  const predPos20UnitsInsideDangerRadius = { x: CENTER_X + DANGER_RADIUS - 20, y: CENTER_Y };

  const aim = fleeAim("scissors", "rocks", preyPosAtCenter, predPos20UnitsInsideDangerRadius);
  
  assert.ok(aim.aimX < CENTER_X, `flees to the left (aimX=${aim.aimX})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 2 - against the right wall with predator to the left", () => {
  const preyPosCloseToRightBoundaryButOutsideMargin = { x: ARENA.width - 60, y: CENTER_Y };
  const predPosToTheLeftOfPrey = { x: preyPosCloseToRightBoundaryButOutsideMargin.x - 60, y: CENTER_Y };

  const aim = fleeAim("scissors", "rocks", preyPosCloseToRightBoundaryButOutsideMargin, predPosToTheLeftOfPrey);

  assert.ok(Math.abs(aim.aimY - CENTER_Y) > ESCAPE_DISTANCE_THRESHOLD, `escapes vertically, not into the wall (aimY=${aim.aimY})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 3 - in the bottom-left corner with predator inside", () => {
  const preyPosAtBottomLeftCorner = { x: NEAR_CORNER_OFFSET, y: ARENA.height - NEAR_CORNER_OFFSET };
  const predPosInsideDiagonally = { x: NEAR_CORNER_OFFSET + THREAT_OFFSET, y: ARENA.height - (NEAR_CORNER_OFFSET + THREAT_OFFSET) };

  const aim = fleeAim("scissors", "rocks", preyPosAtBottomLeftCorner, predPosInsideDiagonally);
 
  const preyDistanceFromBottomLeftCorner = Math.hypot(aim.aimX, ARENA.height - aim.aimY);
  assert.ok(preyDistanceFromBottomLeftCorner > ESCAPE_DISTANCE_THRESHOLD, `moves away from the corner, does not box itself in (dist=${preyDistanceFromBottomLeftCorner.toFixed(0)})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 4 - threat behind with open space ahead", () => {
  const preyPosAtCenter = { x: CENTER_X, y: CENTER_Y };
  const predPos20UnitsBehindPrey = { x: CENTER_X - (DANGER_RADIUS - 20), y: CENTER_Y };

  const aim = fleeAim("scissors", "rocks", preyPosAtCenter, predPos20UnitsBehindPrey);

  assert.ok(aim.aimX > CENTER_X, `flees toward the open space (aimX=${aim.aimX})`);
  assert.ok(inBounds(aim), `aim in-bounds (${aim.aimX}, ${aim.aimY})`);
});

test("Scenario 5 - solver: clearance bias (straight = corner, tangential = open)", () => {
  const preyPosAtBottomLeftCorner = { x: NEAR_CORNER_OFFSET, y: ARENA.height - NEAR_CORNER_OFFSET };
  const threatPosInsideDiagonally = { x: NEAR_CORNER_OFFSET + THREAT_OFFSET, y: ARENA.height - (NEAR_CORNER_OFFSET + THREAT_OFFSET) };
  const solverConfig = { margin: MARGIN, radius: DANGER_RADIUS };
  const directAngleAwayFromThreat = Math.atan2(preyPosAtBottomLeftCorner.y - threatPosInsideDiagonally.y, preyPosAtBottomLeftCorner.x - threatPosInsideDiagonally.x);
  const clearanceAlongDirectAngle = clearanceToBoundary(
    preyPosAtBottomLeftCorner.x, preyPosAtBottomLeftCorner.y, Math.cos(directAngleAwayFromThreat), Math.sin(directAngleAwayFromThreat), ARENA.width, ARENA.height
  );

  const aim = pickEscapePoint(preyPosAtBottomLeftCorner, threatPosInsideDiagonally, ARENA, solverConfig);
  
  const aimDirectionX = aim.x - preyPosAtBottomLeftCorner.x;
  const aimDirectionY = aim.y - preyPosAtBottomLeftCorner.y;
  const aimDistance = Math.hypot(aimDirectionX, aimDirectionY) || 1;
  const clearanceAlongChosenAim = clearanceToBoundary(
    preyPosAtBottomLeftCorner.x, preyPosAtBottomLeftCorner.y, aimDirectionX / aimDistance, aimDirectionY / aimDistance, ARENA.width, ARENA.height
  );
  assert.ok(
    clearanceAlongDirectAngle < CLEARANCE_SATURATE && clearanceAlongChosenAim > clearanceAlongDirectAngle,
    `aim clearance (${clearanceAlongChosenAim.toFixed(0)}) > straight clearance to the corner (${clearanceAlongDirectAngle.toFixed(0)})`
  );
  assert.ok(
    aim.x >= MARGIN && aim.x <= ARENA.width - MARGIN &&
    aim.y >= MARGIN && aim.y <= ARENA.height - MARGIN,
    `aim in-bounds (${aim.x}, ${aim.y})`
  );
});
