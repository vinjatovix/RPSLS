import assert from "node:assert/strict";
import { test } from "node:test";

import { BloodParticles } from "../../src/particles/BloodParticles.js";
import { ParticlePool } from "../../src/particles/ParticlePool.js";

test("ParticlePool: should acquire new instance when pool is empty", () => {
  const pool = new ParticlePool(10);
  const options = { context: {}, game: {} };

  const p = pool.acquire(BloodParticles, 10, 20, options);

  assert.ok(p instanceof BloodParticles);
  assert.equal(p.x, 10);
  assert.equal(p.y, 20);
});

test("ParticlePool: should preallocate inactive particles of a type", () => {
  const pool = new ParticlePool(10);
  const options = { context: {}, game: {} };

  pool.preAllocate(BloodParticles, 5, options);

  const subpool = pool.pools.get(BloodParticles);
  assert.equal(subpool.length, 5);
  assert.equal(subpool[0].dead, true);
  assert.equal(subpool[0]._inPool, true);
});

test("ParticlePool: should reuse preallocated particle on acquire", () => {
  const pool = new ParticlePool(10);
  const options = { context: {}, game: {} };
  pool.preAllocate(BloodParticles, 1, options);

  const p = pool.acquire(BloodParticles, 10, 20, options);

  const subpool = pool.pools.get(BloodParticles);
  assert.equal(subpool.length, 0);
  assert.equal(p.dead, false);
  assert.equal(p._inPool, false);
});

test("ParticlePool: should place released particle into its type-specific inactive subpool", () => {
  const pool = new ParticlePool(10);
  const options = { context: {}, game: {} };
  const p = pool.acquire(BloodParticles, 10, 20, options);

  pool.release(p);

  const subpool = pool.pools.get(BloodParticles);
  assert.equal(subpool.length, 1);
  assert.equal(subpool[0], p);
  assert.equal(p._inPool, true);
});

test("ParticlePool: should limit the number of inactive particles in the subpool to maxSize", () => {
  const pool = new ParticlePool(2);
  const options = { context: {}, game: {} };

  const p1 = pool.acquire(BloodParticles, 1, 1, options);
  const p2 = pool.acquire(BloodParticles, 2, 2, options);
  const p3 = pool.acquire(BloodParticles, 3, 3, options);

  pool.release(p1);
  pool.release(p2);
  pool.release(p3);

  const subpool = pool.pools.get(BloodParticles);
  assert.equal(subpool.length, 2);
  assert.ok(subpool.includes(p1));
  assert.ok(subpool.includes(p2));
  assert.ok(!subpool.includes(p3));
});

test("ParticlePool: should prevent duplicate release of the same particle", () => {
  const pool = new ParticlePool(10);
  const options = { context: {}, game: {} };
  const p = pool.acquire(BloodParticles, 10, 20, options);

  pool.release(p);
  pool.release(p);

  const subpool = pool.pools.get(BloodParticles);
  assert.equal(subpool.length, 1);
});

test("ParticlePool: should return null when pool is saturated", () => {
  const pool = new ParticlePool(10);
  const options = { context: {}, game: {} };
  pool.preAllocate(BloodParticles, 1, options);
  pool.acquire(BloodParticles, 10, 20, options);

  const pSaturated = pool.acquire(BloodParticles, 10, 20, options);

  assert.equal(pSaturated, null);
});

test("ParticlePool: should decrement created counts on release when subpool is full", () => {
  const pool = new ParticlePool(1);
  const options = { context: {}, game: {} };
  pool.preAllocate(BloodParticles, 2, options);
  const p1 = pool.acquire(BloodParticles, 10, 20, options);
  const p2 = pool.acquire(BloodParticles, 10, 20, options);
  pool.release(p1);

  pool.release(p2);

  assert.equal(pool.createdCounts.get(BloodParticles), 1);
});

test("ParticlePool: should apply options on pre-allocated recycled particles", () => {
  const pool = new ParticlePool(10);
  const preallocOptions = { context: { isFakeContext: true }, game: { isFakeGame: true }, color: "blue" };
  pool.preAllocate(BloodParticles, 1, preallocOptions);

  const pRecycled = pool.acquire(BloodParticles, 10, 20, { color: "green" });

  assert.equal(pRecycled.context.isFakeContext, true);
  assert.equal(pRecycled.game.isFakeGame, true);
  assert.equal(pRecycled.color, "green");
  assert.equal(pRecycled.x, 10);
  assert.equal(pRecycled.y, 20);
});

test("ParticlePool: should apply options on newly instantiated particles", () => {
  const pool = new ParticlePool(10);
  const options = { context: { isFakeContext: true }, game: { isFakeGame: true }, color: "yellow" };

  const pNew = pool.acquire(BloodParticles, 30, 40, options);

  assert.ok(pNew instanceof BloodParticles);
  assert.equal(pNew.context.isFakeContext, true);
  assert.equal(pNew.game.isFakeGame, true);
  assert.equal(pNew.color, "yellow");
  assert.equal(pNew.x, 30);
  assert.equal(pNew.y, 40);
});
