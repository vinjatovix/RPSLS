import assert from "node:assert/strict";
import { test } from "node:test";

import { BloodParticles } from "../../src/particles/BloodParticles.js";
import { FloatingText } from "../../src/particles/FloatingText.js";
import { ParticleSystem } from "../../src/particles/ParticleSystem.js";
import { PowerUpBurst } from "../../src/particles/PowerUpEffects.js";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const DEFAULT_BLOOD_PREALLOCATED = 500;
const PARTICLES_PER_COLLISION = 10;
const PARTICLES_PER_POWERUP_BURST = 8;
const PARTICLES_PER_FLOATING_TEXT = 1;
const POOL_SATURATION_MARGIN = 10;

const DEFAULT_BLOOD_LIFE = 1000;
const SNUFF_BLOOD_LIFE = 3000;
const DEFAULT_TEXT_LIFE = 900;

const COLLISION_X = 100;
const COLLISION_Y = 200;
const BURST_X = 150;
const BURST_Y = 250;
const TEXT_X = 50;
const TEXT_Y = 75;

const UPDATE_DT_SHORT = 100;
const UPDATE_DT_LONG = 1000;

const createFakeGame = (bloodEnabled = true, snuffEnabled = false) => {
  return {
    canvasAdapter: {
      getContext: () => ({
        save: () => {},
        restore: () => {},
        translate: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        strokeText: () => {},
      })
    },
    options: {
      effects: {
        blood: bloodEnabled,
        snuff: snuffEnabled
      }
    },
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  };
};

test("ParticleSystem: should preallocate configured volume of BloodParticles on startup", () => {
  const game = createFakeGame();

  const system = new ParticleSystem({ game });

  const subpool = system.pool.pools.get(BloodParticles);
  assert.equal(subpool.length, DEFAULT_BLOOD_PREALLOCATED);
});

test("ParticleSystem: collision should spawn configured amount of particles", () => {
  const game = createFakeGame(true, false);
  const system = new ParticleSystem({ game });

  system.collision(COLLISION_X, COLLISION_Y);

  assert.equal(system.particles.length, PARTICLES_PER_COLLISION);
});

test("ParticleSystem: collision should spawn BloodParticles", () => {
  const game = createFakeGame(true, false);
  const system = new ParticleSystem({ game });

  system.collision(COLLISION_X, COLLISION_Y);

  const p = system.particles[0];
  assert.ok(p instanceof BloodParticles);
});

test("ParticleSystem: collision should initialize particles at collision coordinates", () => {
  const game = createFakeGame(true, false);
  const system = new ParticleSystem({ game });

  system.collision(COLLISION_X, COLLISION_Y);

  const p = system.particles[0];
  assert.equal(p.x, COLLISION_X);
  assert.equal(p.y, COLLISION_Y);
});

test("ParticleSystem: collision should initialize particles with default life", () => {
  const game = createFakeGame(true, false);
  const system = new ParticleSystem({ game });

  system.collision(COLLISION_X, COLLISION_Y);

  const p = system.particles[0];
  assert.equal(p.life, DEFAULT_BLOOD_LIFE);
  assert.equal(p.maxLife, DEFAULT_BLOOD_LIFE);
});

test("ParticleSystem: collision with snuff enabled should initialize particles with longer life", () => {
  const game = createFakeGame(true, true);
  const system = new ParticleSystem({ game });

  system.collision(COLLISION_X, COLLISION_Y);

  const p = system.particles[0];
  assert.equal(p.life, SNUFF_BLOOD_LIFE);
  assert.equal(p.maxLife, SNUFF_BLOOD_LIFE);
});

test("ParticleSystem: collision with blood disabled should not spawn particles", () => {
  const game = createFakeGame(false, false);
  const system = new ParticleSystem({ game });

  system.collision(COLLISION_X, COLLISION_Y);

  assert.equal(system.particles.length, 0);
});

test("ParticleSystem: powerUpBurst should spawn configured amount of particles", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });

  system.powerUpBurst(BURST_X, BURST_Y, "blue");

  assert.equal(system.particles.length, PARTICLES_PER_POWERUP_BURST);
});

test("ParticleSystem: powerUpBurst should spawn PowerUpBurst particles", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });

  system.powerUpBurst(BURST_X, BURST_Y, "blue");

  const p = system.particles[0];
  assert.ok(p instanceof PowerUpBurst);
});

test("ParticleSystem: powerUpBurst should initialize particles at burst coordinates with correct color", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });

  system.powerUpBurst(BURST_X, BURST_Y, "blue");

  const p = system.particles[0];
  assert.equal(p.x, BURST_X);
  assert.equal(p.y, BURST_Y);
  assert.equal(p.color, "blue");
});

test("ParticleSystem: showFloatingText should spawn exactly one particle", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });

  system.showFloatingText(TEXT_X, TEXT_Y, "Level Up", "gold");

  assert.equal(system.particles.length, PARTICLES_PER_FLOATING_TEXT);
});

test("ParticleSystem: showFloatingText should spawn FloatingText particle", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });

  system.showFloatingText(TEXT_X, TEXT_Y, "Level Up", "gold");

  const p = system.particles[0];
  assert.ok(p instanceof FloatingText);
});

test("ParticleSystem: showFloatingText should initialize particle with text, color, and coordinates", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });

  system.showFloatingText(TEXT_X, TEXT_Y, "Level Up", "gold");

  const p = system.particles[0];
  assert.equal(p.x, TEXT_X);
  assert.equal(p.y, TEXT_Y);
  assert.equal(p.text, "Level Up");
  assert.equal(p.color, "gold");
});

test("ParticleSystem: update should decrease particle life by elapsed time", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });
  system.showFloatingText(TEXT_X, TEXT_Y, "Test", "red");
  const p = system.particles[0];

  system.update(UPDATE_DT_SHORT);

  assert.equal(p.life, DEFAULT_TEXT_LIFE - UPDATE_DT_SHORT);
});

test("ParticleSystem: update should mark particle as dead when its life is fully depleted", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });
  system.showFloatingText(TEXT_X, TEXT_Y, "Test", "red");
  const p = system.particles[0];

  system.update(UPDATE_DT_LONG);

  assert.equal(p.dead, true);
});

test("ParticleSystem: update should remove dead particles from active list and release them to pool", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });
  system.showFloatingText(TEXT_X, TEXT_Y, "Test", "red");
  const p = system.particles[0];

  system.update(UPDATE_DT_LONG);

  const subpool = system.pool.pools.get(FloatingText);
  assert.equal(system.particles.length, 0);
  assert.equal(subpool.length, 1);
  assert.equal(subpool[0], p);
});

test("ParticleSystem: clear should empty the active particles list", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });
  system.collision(COLLISION_X, COLLISION_Y);
  system.powerUpBurst(BURST_X, BURST_Y, "blue");
  system.showFloatingText(TEXT_X, TEXT_Y, "Test", "red");

  system.clear();

  assert.equal(system.particles.length, 0);
});

test("ParticleSystem: clear should release active particles back to their respective type subpools", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });
  system.collision(COLLISION_X, COLLISION_Y);
  system.powerUpBurst(BURST_X, BURST_Y, "blue");
  system.showFloatingText(TEXT_X, TEXT_Y, "Test", "red");

  system.clear();

  const bloodPool = system.pool.pools.get(BloodParticles);
  const burstPool = system.pool.pools.get(PowerUpBurst);
  const textPool = system.pool.pools.get(FloatingText);
  assert.equal(bloodPool.length, DEFAULT_BLOOD_PREALLOCATED);
  assert.equal(burstPool.length, PARTICLES_PER_POWERUP_BURST);
  assert.equal(textPool.length, PARTICLES_PER_FLOATING_TEXT);
});

test("ParticleSystem: should not allocate new instances beyond preallocated capacity when pool saturates", () => {
  const game = createFakeGame();
  const system = new ParticleSystem({ game });
  const collisionsToSaturatePool = (DEFAULT_BLOOD_PREALLOCATED / PARTICLES_PER_COLLISION) + POOL_SATURATION_MARGIN;

  for (let i = 0; i < collisionsToSaturatePool; i++) {
    system.collision(COLLISION_X, COLLISION_Y);
  }

  const bloodPool = system.pool.pools.get(BloodParticles);
  assert.equal(system.particles.length, DEFAULT_BLOOD_PREALLOCATED);
  assert.equal(bloodPool.length, 0);
});
