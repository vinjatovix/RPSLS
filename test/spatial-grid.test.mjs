import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { SpatialGrid } from "../src/canvas/geometry/SpatialGrid.js";
import { TargetingSystem } from "../src/entities/TargetingSystem.js";
import { Random } from "../src/core/index.js";

test("SpatialGrid: initialization and default state", () => {
  const cellWidth = 100;
  const cellHeight = 100;
  const grid = new SpatialGrid(cellWidth, cellHeight);

  assert.equal(grid.cellWidth, cellWidth);
  assert.equal(grid.cellHeight, cellHeight);
  assert.equal(grid.cells.size, 0);
});

test("SpatialGrid: insert and query accuracy", () => {
  const grid = new SpatialGrid(100, 100);
  
  const entityInCell00 = { x: 50, y: 50 };
  const entityInCell10 = { x: 150, y: 50 };
  const entityInCell01 = { x: 50, y: 150 };
  const entityInCell22 = { x: 250, y: 250 };

  grid.insert(entityInCell00);
  grid.insert(entityInCell10);
  grid.insert(entityInCell01);
  grid.insert(entityInCell22);

  const queryCenter = 50;
  const smallRadius = 10;
  const entitiesFoundInSmallRadius = grid.query(queryCenter, queryCenter, smallRadius);
  assert.deepEqual(entitiesFoundInSmallRadius, [entityInCell00]);

  const largeRadius = 110;
  const entitiesFoundInLargeRadius = grid.query(queryCenter, queryCenter, largeRadius);
  assert.ok(entitiesFoundInLargeRadius.includes(entityInCell00));
  assert.ok(entitiesFoundInLargeRadius.includes(entityInCell10));
  assert.ok(entitiesFoundInLargeRadius.includes(entityInCell01));
  assert.ok(!entitiesFoundInLargeRadius.includes(entityInCell22));

  grid.clear();

  const entitiesFoundAfterClear = grid.query(queryCenter, queryCenter, largeRadius);
  assert.equal(grid.cells.size, 0);
  assert.deepEqual(entitiesFoundAfterClear, []);
});

test("SpatialGrid: array pooling and reuse", () => {
  const grid = new SpatialGrid(100, 100);
  const entity = { x: 50, y: 50 };
  
  grid.insert(entity);

  const expectedCellKeyFor00 = (SpatialGrid.COORDINATE_OFFSET << 16) | SpatialGrid.COORDINATE_OFFSET;
  const initialCellArrayInstance = grid.cells.get(expectedCellKeyFor00);
  assert.equal(grid.cells.size, 1);

  grid.clear();
  assert.equal(grid.cells.size, 0);
  assert.equal(grid.arrayPool.length, 1);
  assert.equal(grid.arrayPool[0], initialCellArrayInstance);

  grid.insert(entity);
  const cellArrayInstanceAfterReinsert = grid.cells.get(expectedCellKeyFor00);
  assert.equal(grid.cells.size, 1);
  assert.equal(cellArrayInstanceAfterReinsert, initialCellArrayInstance);
});

test("SpatialGrid: benchmarking with 200 entities", () => {
  Random.setSeed(12345);
  try {
    const grid = new SpatialGrid(100, 100);
    const totalEntities = 200;
    const screenWidth = 800;
    const screenHeight = 600;

    for (let i = 0; i < totalEntities; i++) {
      const randomEntity = { x: Random.next() * screenWidth, y: Random.next() * screenHeight };
      grid.insert(randomEntity);
    }

    const benchmarkStartTime = performance.now();
    
    const totalQueriesToExecute = 100;
    const queryRadius = 100;
    for (let i = 0; i < totalQueriesToExecute; i++) {
      const randomQueryX = Random.next() * screenWidth;
      const randomQueryY = Random.next() * screenHeight;
      grid.query(randomQueryX, randomQueryY, queryRadius);
    }
    
    const benchmarkEndTime = performance.now();
    const totalDurationMs = benchmarkEndTime - benchmarkStartTime;
    const averageDurationPerQueryMs = totalDurationMs / totalQueriesToExecute;
    const maxAllowedDurationPerQueryMs = 1;
    
    assert.ok(averageDurationPerQueryMs < maxAllowedDurationPerQueryMs);
  } finally {
    Random.restore();
  }
});

test("SpatialGrid: toroidal wrap-around behavior", () => {
  // Width: 800, Height: 600, Cell size: 100x100 (cols=8, rows=6)
  const grid = new SpatialGrid(100, 100, {
    isToroidal: true,
    width: 800,
    height: 600
  });

  const leftBorderEntity = { x: 50, y: 300, name: "left" };
  const rightBorderEntity = { x: 750, y: 300, name: "right" };

  grid.insert(leftBorderEntity);
  grid.insert(rightBorderEntity);

  // Query from near left border (x=10, y=300) with a radius of 100
  const results = grid.query(10, 300, 100);

  assert.ok(results.includes(leftBorderEntity), "Should find left border entity");
  assert.ok(results.includes(rightBorderEntity), "Should find right border entity via wrap-around!");
});

test("TargetingSystem: incremental/expanding search on spatial grid", () => {
  // Set up spatial grid with cell size 100x100
  const grid = new SpatialGrid(100, 100, { width: 800, height: 600 });
  
  // Mock entity
  const entity = {
    x: 50,
    y: 50,
    width: 20,
    height: 20,
    team: "rocks",
    aim: ["scissors"], // Rocks aim at Scissors (prey)
    game: { spatialGrid: grid }
  };

  const canvasAdapter = {
    getWidth: () => 800,
    getHeight: () => 600,
    getSize: () => ({ width: 800, height: 600 }),
    getCenter: () => ({ x: 400, y: 300 })
  };

  const buffManager = {
    isConfused: () => false
  };

  const targeting = new TargetingSystem(entity, canvasAdapter, buffManager);

  // Scenario A: Prey is close (within grid.cellWidth * 1.5 = 150px)
  const closePrey = { x: 120, y: 50, width: 20, height: 20, team: "scissors", dead: false };
  const farPrey = { x: 500, y: 500, width: 20, height: 20, team: "scissors", dead: false };
  
  grid.insert(closePrey);
  grid.insert(farPrey);

  // Track queries
  const queryRadii = [];
  const originalQuery = grid.query.bind(grid);
  grid.query = (x, y, radius, outCandidates) => {
    queryRadii.push(radius);
    return originalQuery(x, y, radius, outCandidates);
  };

  // Run setTarget with close prey present
  targeting.setTarget([closePrey, farPrey]);

  assert.equal(entity.closest, closePrey, "Should find the close prey");
  assert.equal(queryRadii.length, 1, "Should only perform 1 query because prey was found in initial radius");
  assert.equal(queryRadii[0], 150, "Initial search radius should be grid.cellWidth * 1.5 = 150");

  // Reset tracking and clear grid
  queryRadii.length = 0;
  grid.clear();

  // Scenario B: Prey is far away (requires expanding queries)
  grid.insert(farPrey);

  targeting.setTarget([farPrey]);

  assert.equal(entity.closest, farPrey, "Should find the far prey");
  assert.ok(queryRadii.length > 1, "Should perform multiple queries (expanding radius) to find far prey");
  assert.equal(queryRadii[0], 150, "Initial search radius should be 150");
  assert.ok(queryRadii.includes(300), "Should have expanded to 300");
  assert.ok(queryRadii.includes(600), "Should have expanded to 600");
});
