import assert from "node:assert/strict";
import { test } from "node:test";

import { Clock } from "../../src/core/Clock.js";
import { TICK_MS } from "../doubles/setupSimulationContext.mjs";

const INITIAL_FAKE_TIME_MS = 1000000;
const SLOW_FRAME_MS = 33;
const BACKGROUND_SLEEP_MS = 5000;
const MILLISECONDS_IN_SECOND = 1000;

test("Clock: initial state", () => {
  const clock = new Clock();

  const isLastTimeValid = clock.lastTime <= Date.now();
  const isDeltaZero = clock.deltaTime === 0;

  assert.ok(isLastTimeValid);
  assert.ok(isDeltaZero);
});

test("Clock: update computes elapsed time and calculates FPS for standard frames", () => {
  const originalNow = Date.now;
  let fakeTime = INITIAL_FAKE_TIME_MS;
  Date.now = () => fakeTime;
  const clock = new Clock();
  fakeTime += TICK_MS;

  const delta = clock.update();

  Date.now = originalNow;
  assert.equal(delta, TICK_MS);
  assert.equal(clock.deltaTime, TICK_MS);
  assert.equal(clock.calculateFPS(), MILLISECONDS_IN_SECOND / TICK_MS);
});

test("Clock: update computes elapsed time and calculates FPS for slow frames", () => {
  const originalNow = Date.now;
  let fakeTime = INITIAL_FAKE_TIME_MS;
  Date.now = () => fakeTime;
  const clock = new Clock();
  fakeTime += SLOW_FRAME_MS;

  const delta = clock.update();

  Date.now = originalNow;
  assert.equal(delta, SLOW_FRAME_MS);
  assert.equal(clock.deltaTime, SLOW_FRAME_MS);
  assert.equal(clock.calculateFPS(), MILLISECONDS_IN_SECOND / SLOW_FRAME_MS);
});

test("Clock: reset restarts lastTime to now and sets delta to 0", () => {
  const originalNow = Date.now;
  let fakeTime = INITIAL_FAKE_TIME_MS;
  Date.now = () => fakeTime;
  const clock = new Clock();
  fakeTime += BACKGROUND_SLEEP_MS;

  clock.reset();

  Date.now = originalNow;
  assert.equal(clock.deltaTime, 0);
  assert.equal(clock.lastTime, INITIAL_FAKE_TIME_MS + BACKGROUND_SLEEP_MS);
});

test("Clock: update after reset measures delta from the reset point", () => {
  const originalNow = Date.now;
  let fakeTime = INITIAL_FAKE_TIME_MS;
  Date.now = () => fakeTime;
  const clock = new Clock();
  fakeTime += BACKGROUND_SLEEP_MS;
  clock.reset();
  fakeTime += TICK_MS;

  const delta = clock.update();

  Date.now = originalNow;
  assert.equal(delta, TICK_MS);
});
