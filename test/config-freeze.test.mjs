import { test } from "node:test";
import assert from "node:assert/strict";

import { deepFreeze } from "../src/core/index.js";
import { RACE_STATS } from "../src/config/gameConfig.js";

test("deepFreeze freezes deeply", () => {
  const config = { a: { b: { c: 1 } }, arr: [1, 2] };
  deepFreeze(config);
  assert.ok(Object.isFrozen(config), "level 1 frozen");
  assert.ok(Object.isFrozen(config.a), "level 2 frozen");
  assert.ok(Object.isFrozen(config.a.b), "level 3 frozen");
  assert.ok(Object.isFrozen(config.arr), "arrays frozen");
  assert.throws(() => {
    config.a.b.c = 2;
  }, "writing to a frozen node throws in strict mode");
});

test("deepFreeze works even if the root object is already shallow-frozen", () => {
  // RACE_STATS is Object.freeze() at the root but its children are NOT:
  // deepFreeze must keep descending, not stop at the root isFrozen.
  const config = Object.freeze({ team: { damage: { amount: 10 } } });
  deepFreeze(config);
  assert.ok(Object.isFrozen(config.team), "child frozen despite frozen root");
  assert.ok(Object.isFrozen(config.team.damage), "grandchild frozen");
  assert.throws(() => {
    config.team.damage.amount = 999;
  });
});

test("deepFreeze tolerates cycles", () => {
  const a = {};
  const b = { a };
  a.b = b;
  deepFreeze(a);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(b));
});

test("real configs MUTABLE in Node (the balance harness calibrates them)", () => {
  RACE_STATS.rocks.damage.amount = 999;
  assert.equal(RACE_STATS.rocks.damage.amount, 999, "RACE_STATS can be written in Node");
  RACE_STATS.rocks.damage.amount = 10;
  assert.equal(RACE_STATS.rocks.damage.amount, 10, "value restored");
});
