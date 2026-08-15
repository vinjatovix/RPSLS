/**
 * training-stats.mjs - Verifica las stats de entrenamiento añadidas:
 *   - UPGRADES incluye regen/armor/vampire/decel (por raza) y
 *     powerupDuration/powerupCap/collectRadius (globales)
 *   - buyUpgrade/getRaceModifiers de las stats nuevas
 *   - Enemy: regen cura por segundo, armor reduce daño, vampire cura al
 *     dañar, decel aumenta la frenada (accel ya no la modifica)
 *   - Spawn de powerups: intervalo base 4500ms
 *   - Créditos: 2 por kill del equipo del jugador
 *   node test/training-stats.mjs
 */

import "./dom-stub.js";

const { Game } = await import("../src/index.js");
const { UPGRADES } = await import("../src/config/gameConfig.js");
const { Enemy } = await import("../src/entities/Enemy.js");

let ok = true;
const assert = (cond, msg) => {
  if (!cond) {
    ok = false;
    console.log(`FAIL: ${msg}`);
  }
};

// ============ Config: UPGRADES nuevas ============
assert(UPGRADES.regen?.perRace === true, "regen es per-race");
assert(UPGRADES.armor?.perRace === true, "armor es per-race");
assert(UPGRADES.vampire?.perRace === true, "vampire es per-race");
assert(UPGRADES.decel?.perRace === true, "decel es per-race");
assert(UPGRADES.powerupDuration?.perRace === false, "powerupDuration es global");
assert(UPGRADES.powerupCap?.perRace === false, "powerupCap es global");
assert(UPGRADES.collectRadius?.perRace === false, "collectRadius es global");

// ============ Compra + modificadores por raza ============
const g = new Game({ startLevel: 0 });
g.progressManager.reset();
g.progressManager.selectTeam("rocks");
g.progressManager.awardCredits(500);
assert(g.progressManager.buyUpgrade("regen", "rocks"), "se puede comprar regen");
assert(g.progressManager.buyUpgrade("armor", "rocks"), "se puede comprar armor");
assert(g.progressManager.buyUpgrade("vampire", "rocks"), "se puede comprar vampire");
assert(g.progressManager.buyUpgrade("decel", "rocks"), "se puede comprar decel");
const mods = g.progressManager.getRaceModifiers("rocks");
assert(mods.regen === 4, `regen Lv.1 = +4 vida/s (got ${mods.regen})`);
assert(mods.armor === 0.08, `armor Lv.1 = -8% daño (got ${mods.armor})`);
assert(mods.vampire === 0.05, `vampire Lv.1 = +5% curación (got ${mods.vampire})`);
assert(mods.decel === 1.1, `decel Lv.1 = +10% frenada (got ${mods.decel})`);

// ============ Globales ============
g.progressManager.awardCredits(500);
assert(g.progressManager.buyUpgrade("powerupDuration"), "se puede comprar powerupDuration");
assert(g.progressManager.getPowerupDurationMultiplier() === 1.1, "powerupDuration Lv.1 = ×1.1");
assert(g.progressManager.buyUpgrade("powerupCap"), "se puede comprar powerupCap");
assert(g.progressManager.getPowerupCapBonus() === 2, "powerupCap Lv.1 = +2 tope");
assert(g.progressManager.buyUpgrade("collectRadius"), "se puede comprar collectRadius");
assert(g.progressManager.getCollectRadiusMultiplier() === 1.15, "collectRadius Lv.1 = ×1.15");

// ============ Enemy: regen base ============
const regenEnemy = new Enemy({ game: g, x: 100, y: 100, modifiers: { regen: 4 } }, "rocks");
regenEnemy.life = regenEnemy.maxLife / 2;
const rBefore = regenEnemy.life;
regenEnemy.update(1000, []);
assert(regenEnemy.life > rBefore, `regen base debe curar con el tiempo (${rBefore} -> ${regenEnemy.life})`);
assert(regenEnemy.life <= regenEnemy.maxLife, "regen base no supera el máximo");

// ============ Enemy: armor base ============
const armored = new Enemy({ game: g, x: 100, y: 140, modifiers: { armor: 0.5 } }, "rocks");
assert(armored.getIncomingDamageMultiplier() === 0.5, `armor 0.5 reduce daño a la mitad (got ${armored.getIncomingDamageMultiplier()})`);
const unarmored = new Enemy({ game: g, x: 100, y: 180 }, "rocks");
assert(unarmored.getIncomingDamageMultiplier() === 1, "sin armor el daño entra completo");
unarmored.applyBuff("armor", 10000, 0);
assert(unarmored.getIncomingDamageMultiplier() === 0, "buff armor anula el daño (x0)");

// ============ Enemy: decel separada de accel ============
const baseEnemy = new Enemy({ game: g, x: 100, y: 220 }, "rocks");
const braked = new Enemy({ game: g, x: 100, y: 260, modifiers: { decel: 2 } }, "rocks");
assert(
  braked.deceleration === baseEnemy.deceleration * 2,
  `decel x2 duplica la frenada (${braked.deceleration} vs ${baseEnemy.deceleration})`
);
const accelOnly = new Enemy({ game: g, x: 100, y: 300, modifiers: { accel: 2 } }, "rocks");
assert(
  accelOnly.deceleration === baseEnemy.deceleration * 2,
  `accel sigue afectando a la frenada (${accelOnly.deceleration} vs ${baseEnemy.deceleration})`
);
assert(
  accelOnly.acceleration === baseEnemy.acceleration * 2,
  "accel multiplica la aceleración"
);
const accelDecel = new Enemy({ game: g, x: 100, y: 340, modifiers: { accel: 2, decel: 2 } }, "rocks");
assert(
  accelDecel.deceleration === baseEnemy.deceleration * 4,
  `decel y accel se acumulan en la frenada (${accelDecel.deceleration} vs ${baseEnemy.deceleration})`
);

// ============ Enemy: vampire base ============
const vg = new Game({ startLevel: 0 });
vg.progressManager.reset();
vg.progressManager.selectTeam("rocks");
vg.progressManager.awardCredits = () => {};
vg.match = 0;
vg.onTeamChanged();
vg.powerupTimer = Infinity;

const attacker = new Enemy({ game: vg, x: 200, y: 200, modifiers: { vampire: 0.5 } }, "rocks");
const prey = new Enemy({ game: vg, x: 200, y: 200 }, "scissors");
prey.applyBuff("freeze", 100000, 0);
prey.life = 1e9;
vg.enemies = [attacker, prey];
attacker.life = attacker.maxLife * 0.5;
const vBefore = attacker.life;
for (let i = 0; i < 40; i++) vg.update(16);
assert(attacker.life > vBefore, `vampire base debe curar al hacer daño (${vBefore} -> ${attacker.life})`);

// ============ Spawn de powerups ============
const sg = new Game({ startLevel: 0 });
sg.progressManager.reset();
sg.progressManager.selectTeam("rocks");
assert(sg.powerupTimer === 4500, `intervalo base de powerups = 4500ms (got ${sg.powerupTimer})`);
sg.progressManager.awardCredits(500);
sg.progressManager.buyUpgrade("powerupLuck");
assert(sg.progressManager.getPowerupLuck() === 1.05, "powerupLuck acorta el intervalo (+5%)");

// ============ Créditos por kill ============
const pm = new Game({ startLevel: 0 }).progressManager;
pm.reset();
pm.selectTeam("rocks");
pm.eventBus.emit("kill", { killerTeam: "rocks" });
assert(pm.credits === 2, `kill del equipo del jugador da 2 créditos (got ${pm.credits})`);
pm.eventBus.emit("kill", { killerTeam: "lizards" });
assert(pm.credits === 2, "kill de otro equipo no da créditos");

console.log(ok ? "TRAINING STATS OK" : "TRAINING STATS FAIL");
g.destroy();
vg.destroy();
sg.destroy();
pm.eventBus.emit("kill", { killerTeam: "rocks" });
process.exit(ok ? 0 : 1);
