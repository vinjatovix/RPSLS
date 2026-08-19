import assert from "node:assert/strict";
import { test } from "node:test";

import { Random, createPRNG } from "../../src/core/Random.js";

const PRIMARY_SEED = 42;
const ALTERNATIVE_SEED = 7;
const CALIBRATION_SEED = 12345;
const TELEMETRY_SEED = 999;
const STREAM_LENGTH = 100;
const FIXED_MOCK_VALUE = 0.5;

test("Random: createPRNG produces identical sequences for the same seed", () => {
  const prngPrimaryA = createPRNG(PRIMARY_SEED);
  const prngPrimaryB = createPRNG(PRIMARY_SEED);

  const sequenceA = Array.from({ length: STREAM_LENGTH }, prngPrimaryA);
  const sequenceB = Array.from({ length: STREAM_LENGTH }, prngPrimaryB);

  assert.deepEqual(sequenceA, sequenceB);
});

test("Random: createPRNG produces different sequences for different seeds", () => {
  const prngPrimary = createPRNG(PRIMARY_SEED);
  const prngAlternative = createPRNG(ALTERNATIVE_SEED);

  const sequencePrimary = Array.from({ length: STREAM_LENGTH }, prngPrimary);
  const sequenceAlternative = Array.from({ length: STREAM_LENGTH }, prngAlternative);

  assert.notDeepEqual(sequencePrimary, sequenceAlternative);
});

test("Random: setSeed forces main RNG to produce reproducible streams", () => {
  Random.setSeed(CALIBRATION_SEED);
  const streamA = Array.from({ length: STREAM_LENGTH }, () => Random.next());
  Random.setSeed(CALIBRATION_SEED);

  const streamB = Array.from({ length: STREAM_LENGTH }, () => Random.next());

  Random.restore();
  assert.deepEqual(streamA, streamB);
});

test("Random: setSeed(null) initializes with dynamic seed and does not crash", () => {
  const baseSeed = Random.getSeed();

  Random.setSeed(null);

  const generatedSeed = Random.getSeed();
  const generatedValue = Random.next();
  Random.restore();
  assert.notEqual(generatedSeed, baseSeed);
  assert.ok(generatedValue >= 0);
  assert.ok(generatedValue < 1);
});

test("Random: restore returns main seed and activeRNG to original state", () => {
  const initialSeed = Random.getSeed();
  Random.setSeed(TELEMETRY_SEED);

  Random.restore();

  assert.equal(Random.getSeed(), initialSeed);
});

test("Random: cosmetic stream is different from simulation stream", () => {
  Random.setSeed(PRIMARY_SEED);

  const simulationValue = Random.next();
  const cosmeticValue = Random.cosmeticNext();

  Random.restore();
  assert.notEqual(simulationValue, cosmeticValue);
});

test("Random: setSeed does not affect cosmetic stream progression", () => {
  Random.setSeed(PRIMARY_SEED);
  const cosmeticValueFirst = Random.cosmeticNext();
  Random.setSeed(PRIMARY_SEED);

  const cosmeticValueSecond = Random.cosmeticNext();

  Random.restore();
  assert.notEqual(cosmeticValueFirst, cosmeticValueSecond);
});

test("Random: setMock allows overriding active RNG stream", () => {
  Random.setMock(() => FIXED_MOCK_VALUE);

  const firstValue = Random.next();
  const secondValue = Random.next();

  Random.restore();
  assert.equal(firstValue, FIXED_MOCK_VALUE);
  assert.equal(secondValue, FIXED_MOCK_VALUE);
  assert.notEqual(Random.next(), FIXED_MOCK_VALUE);
});
