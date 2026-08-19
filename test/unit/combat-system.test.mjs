import { test } from "node:test";
import assert from "node:assert/strict";

import { CombatSystem } from "../../src/entities/CombatSystem.js";
import { setupSimulationContext } from "../doubles/setupSimulationContext.mjs";

test("CombatSystem: instance structure", () => {
  const { manager } = setupSimulationContext();
  manager.spawnMatch(1);
  const enemy = manager.enemies[0];
  
  assert.ok(enemy.combatSystem instanceof CombatSystem);
});

test("CombatSystem: kill method successfully kills target and triggers scoreManager.recordKill", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);

  const attacker = manager.enemies.find(e => e.team === "rocks");
  const victim = manager.enemies.find(e => e.team === "scissors");
  assert.ok(attacker && victim);

  let recordKillArgs = null;
  game.scoreManager.recordKill = (killerTeam, victimTeam) => {
    recordKillArgs = { killerTeam, victimTeam };
  };
  
  victim.life = attacker.getDamage() * victim.getIncomingDamageMultiplier();

  attacker.combatSystem.kill(victim);

  assert.equal(victim.dead, true);
  assert.deepEqual(recordKillArgs, { killerTeam: "rocks", victimTeam: "scissors" });
});

test("CombatSystem: prevents double-killing the same target", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);

  const attacker = manager.enemies.find(e => e.team === "rocks");
  const victim = manager.enemies.find(e => e.team === "scissors");
  assert.ok(attacker && victim);

  let recordKillCalls = 0;
  game.scoreManager.recordKill = () => {
    recordKillCalls++;
  };
  
  victim.life = attacker.getDamage() * victim.getIncomingDamageMultiplier();

  attacker.combatSystem.kill(victim);
  assert.equal(victim.dead, true);

  attacker.combatSystem.kill(victim);

  assert.equal(recordKillCalls, 1);
});

test("CombatSystem: dead attacker cannot kill a target", () => {
  const { game, manager } = setupSimulationContext();
  manager.spawnMatch(1);

  const deadAttacker = manager.enemies.find(e => e.team === "rocks");
  const aliveTarget = manager.enemies.find(e => e.team === "papers");
  assert.ok(deadAttacker && aliveTarget);

  let recordKillCalls = 0;
  game.scoreManager.recordKill = () => {
    recordKillCalls++;
  };
  
  deadAttacker.dead = true;

  deadAttacker.combatSystem.kill(aliveTarget);

  assert.equal(aliveTarget.dead, false);
  assert.equal(recordKillCalls, 0);
});
