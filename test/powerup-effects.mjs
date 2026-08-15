/**
 * powerup-effects.mjs - Verifica los efectos de los powerups:
 * heal a full, zap a la mitad, armor anula, damage x2, speed x2,
 * turn x2, slow x0.6, freeze detiene, haste x2 accel, regen cura,
 * vampire cura al atacar, confusion desorienta, gold 5-25 créditos
 * y las duraciones configuradas.
 *   node test/powerup-effects.mjs
 */

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { PowerUp } from "../src/entities/PowerUp.js";
import { POWERUP_TYPES } from "../src/config/gameConfig.js";

const game = new Game({ startLevel: 0 });
game.progressManager.reset();
game.progressManager.selectTeam("rocks");
game.progressManager.awardCredits = () => {};
game.match = 0;
game.onTeamChanged();
game.powerupTimer = Infinity;

let ok = true;
const assert = (cond, msg) => {
  if (!cond) {
    ok = false;
    console.log(`FAIL: ${msg}`);
  }
};

const rock = game.enemies.find(e => e.team === "rocks");
const cfg = POWERUP_TYPES;

["haste", "gold", "freeze", "vampire", "confusion", "regen"].forEach(key =>
  assert(!!cfg[key], `POWERUP_TYPES debe incluir ${key}`)
);
assert(cfg.speed.duration === 15000, "speed dura 15s");
assert(cfg.damage.duration === 15000, "damage dura 15s");
assert(cfg.turn.duration === 15000 && cfg.turn.amount === 2, "turn dura 15s y es x2");
assert(cfg.armor.duration === 10000 && cfg.armor.amount === 0, "armor dura 10s y anula");
assert(cfg.slow.duration === 15000, "slow dura 15s");
assert(cfg.zap.amount === 0.5, "zap reduce a la mitad");
assert(cfg.haste.duration === 15000 && cfg.haste.amount === 2, "haste dura 15s x2");
assert(cfg.freeze.duration === 5000, "freeze dura 5s");
assert(cfg.vampire.duration === 10000 && cfg.vampire.amount === 0.5, "vampire 10s cura 50%");
assert(cfg.confusion.duration === 8000, "confusion dura 8s");
assert(cfg.regen.duration === 10000 && cfg.regen.amount === 40, "regen 10s +40/s");

const heal = new PowerUp({ game });
heal.type = "heal";
rock.life = rock.maxLife / 2;
heal.applyToTeam("rocks");
assert(rock.life === rock.maxLife, `heal debe curar SIEMPRE al máximo (${rock.life}/${rock.maxLife})`);

const zap = new PowerUp({ game });
zap.type = "zap";
rock.life = 200;
const zBefore = rock.life;
zap.applyToTeam("rocks");
assert(rock.life === Math.max(1, Math.floor(zBefore * 0.5)), `zap debe reducir la vida ACTUAL a la mitad (${zBefore} -> ${rock.life})`);
assert(rock.life !== Math.floor(rock.maxLife * 0.5), `zap NO debe usar el total como base (quedó ${rock.life}, total/2=${Math.floor(rock.maxLife * 0.5)})`);
assert(!rock.dead, "zap ya no mata");

rock.applyBuff("armor", 10000, 0);
assert(rock.getIncomingDamageMultiplier() === 0, "armor anula el daño (x0)");

rock.applyBuff("damage", 15000, 2);
assert(
  rock.getDamage() === rock.baseDamage * rock.damageMultiplier * 2,
  `damage debe ser x2 multiplicativo (${rock.getDamage()})`
);

rock.applyBuff("speed", 15000, 2);
assert(rock.getSpeedMultiplier() === 2, "speed x2");
rock.applyBuff("slow", 15000, 0.6);
assert(rock.getSpeedMultiplier() === 1.2, "speed+slow = 2*0.6");
rock.applyBuff("freeze", 5000, 0);
assert(rock.getSpeedMultiplier() === 0, "freeze detiene (x0)");

rock.applyBuff("haste", 15000, 2);
assert(rock.getAccelMultiplier() === 2, "haste x2 aceleración/freno");

rock.applyBuff("turn", 15000, 2);
assert(rock.getTurnMultiplier() === 2, "turn x2");

const regen = game.enemies.find(e => e.team !== "rocks" && !e.dead);
assert(!!regen, "debe existir un enemigo vivo para testear regen");
if (regen) {
  const bystander = game.enemies.find(e => e.team === "rocks");
  game.enemies = [regen, bystander];
  bystander.applyBuff("freeze", 100000, 0);
  bystander.life = 1e9;
  regen.applyBuff("regen", 100000, 40);
  regen.life = regen.maxLife / 2;
  const rBefore = regen.life;
  for (let i = 0; i < 20; i++) game.update(16);
  assert(regen.life > rBefore, `regen debe curar con el tiempo (${rBefore} -> ${regen.life})`);
  assert(regen.life <= regen.maxLife, "regen no debe superar el máximo");
}

const confused = game.enemies.find(e => e.team !== "rocks" && !e.dead);
assert(!!confused, "debe existir un enemigo vivo para testear confusion");
if (confused) {
  confused.applyBuff("confusion", 100000, 0);
  game.update(16);
  assert(confused.isBuffActive("confusion"), "confusion debe estar activa");
  assert(confused.fleeing === false, "confundido no debe huir");
  const w = game.canvasManager.getWidth();
  const h = game.canvasManager.getHeight();
  assert(confused.aimX >= 0 && confused.aimX <= w, "confundido aimX dentro del canvas");
  assert(confused.aimY >= 0 && confused.aimY <= h, "confundido aimY dentro del canvas");
}

const gold = new PowerUp({ game });
gold.type = "gold";
let goldGot = null;
game.progressManager.awardCredits = v => {
  goldGot = v;
};
const realRandom = Math.random;
Math.random = () => 0;
gold.applyToTeam("rocks");
assert(goldGot === 5, `gold mínimo 5 créditos (got ${goldGot})`);
const gold2 = new PowerUp({ game });
gold2.type = "gold";
goldGot = null;
Math.random = () => 0.9999;
gold2.applyToTeam("rocks");
Math.random = realRandom;
assert(goldGot === 25, `gold máximo 25 créditos (got ${goldGot})`);

const vampireGame = new Game({ startLevel: 0 });
vampireGame.progressManager.reset();
vampireGame.progressManager.selectTeam("rocks");
vampireGame.progressManager.awardCredits = () => {};
vampireGame.match = 0;
vampireGame.onTeamChanged();
vampireGame.powerupTimer = Infinity;

const attacker = vampireGame.enemies.find(e => e.team === "rocks");
const prey = vampireGame.enemies.find(e => e.team === "scissors");
vampireGame.enemies = [attacker, prey];
attacker.x = 200;
attacker.y = 200;
prey.x = 200;
prey.y = 200;
prey.applyBuff("freeze", 100000, 0);
prey.life = 1e9;
attacker.applyBuff("vampire", 100000, 0.5);
attacker.life = attacker.maxLife * 0.5;
const vBefore = attacker.life;
for (let i = 0; i < 40; i++) vampireGame.update(16);
assert(attacker.life > vBefore, `vampire debe curar al hacer daño (${vBefore} -> ${attacker.life})`);

console.log(ok ? "POWERUP EFFECTS OK" : "POWERUP EFFECTS FAIL");
game.destroy();
vampireGame.destroy();
process.exit(ok ? 0 : 1);
