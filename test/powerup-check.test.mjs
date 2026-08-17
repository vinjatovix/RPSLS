/**
 * powerup-check.test.mjs - Verifies that power-ups move and that
 * the click (per-team application) collects them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { PowerUp } from "../src/entities/PowerUp.js";

test("power-ups: move without dying and per-team click applies them", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.progressManager.awardCredits = () => {};
  game.matchManager.match = 0;
  game.onTeamChanged();
  game.powerupTimer = Infinity;

  const p = new PowerUp({ game });
  p.x = 100;
  p.y = 100;
  p.velocityX = 2;
  p.velocityY = 1;
  game.powerups = [p];

  const savedEnemies = game.enemies;
  game.enemies = [];

  const startX = p.x;
  const startY = p.y;
  for (let i = 0; i < 30; i++) game.update(16);
  assert.ok(p.x !== startX || p.y !== startY, `power-up must move (${startX},${startY}) -> (${p.x},${p.y})`);
  assert.ok(!p.dead, "power-up must not die from movement");
  game.enemies = savedEnemies;

  const heal = new PowerUp({ game });
  heal.type = "heal";
  heal.x = 300;
  heal.y = 200;
  const rocks = game.enemies.find(e => e.team === "rocks");
  rocks.life = rocks.maxLife / 2;
  const before = rocks.life;
  heal.applyToTeam("rocks");
  assert.ok(heal.dead, "applyToTeam must consume the power-up");
  assert.ok(rocks.life > before, `heal must heal the team (${before} -> ${rocks.life})`);

  const zap = new PowerUp({ game });
  zap.type = "zap";
  const victim = game.enemies.find(e => e.team === "rocks");
  const zBefore = victim.life;
  zap.applyToTeam("rocks");
  assert.ok(victim.life < zBefore, `zap must damage the team (${zBefore} -> ${victim.life})`);

  game.destroy();
});
