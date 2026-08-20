import assert from "node:assert/strict";
import { test } from "node:test";

import { CombatSystem } from "../../src/entities/CombatSystem.js";
import { setupSimulationContext } from "../doubles/setupSimulationContext.mjs";

test("CombatSystem: instance structure", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const enemy = manager.enemies[0];
  
  assert.ok(enemy.combatSystem instanceof CombatSystem);
});

test("CombatSystem: kill method successfully kills target and emits kill event via EventBus", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);

  const attacker = manager.enemies.find(e => e.team === "rocks");
  const victim = manager.enemies.find(e => e.team === "scissors");
  assert.ok(attacker && victim);

  victim.life = attacker.getDamage() * victim.getIncomingDamageMultiplier();

  attacker.combatSystem.kill(victim);

  assert.equal(victim.dead, true);

  const killEvents = game.eventBus.getEmitted("kill");
  assert.equal(killEvents.length, 1);
  assert.deepEqual(killEvents[0].data, { killerTeam: "rocks", victimTeam: "scissors" });
});

test("CombatSystem: prevents double-killing the same target", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);

  const attacker = manager.enemies.find(e => e.team === "rocks");
  const victim = manager.enemies.find(e => e.team === "scissors");
  assert.ok(attacker && victim);

  victim.life = attacker.getDamage() * victim.getIncomingDamageMultiplier();

  attacker.combatSystem.kill(victim);
  assert.equal(victim.dead, true);

  attacker.combatSystem.kill(victim);

  const killEvents = game.eventBus.getEmitted("kill");
  assert.equal(killEvents.length, 1);
});

test("CombatSystem: dead attacker cannot kill a target", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);

  const deadAttacker = manager.enemies.find(e => e.team === "rocks");
  const aliveTarget = manager.enemies.find(e => e.team === "papers");
  assert.ok(deadAttacker && aliveTarget);

  deadAttacker.dead = true;

  deadAttacker.combatSystem.kill(aliveTarget);

  assert.equal(aliveTarget.dead, false);

  const killEvents = game.eventBus.getEmitted("kill");
  assert.equal(killEvents.length, 0);
});
