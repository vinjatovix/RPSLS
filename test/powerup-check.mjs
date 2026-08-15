/**
 * powerup-check.mjs - Verifica que los powerups se mueven y que
 * el click (aplicación por equipo) los recoge.
 *   node test/powerup-check.mjs
 */

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { PowerUp } from "../src/entities/PowerUp.js";

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

const p = new PowerUp({ game });
p.x = 100;
p.y = 100;
p.vx = 2;
p.vy = 1;
game.powerups = [p];

const savedEnemies = game.enemies;
game.enemies = [];

const startX = p.x;
const startY = p.y;
for (let i = 0; i < 30; i++) game.update(16);
assert(p.x !== startX || p.y !== startY, `powerup debe moverse (${startX},${startY}) -> (${p.x},${p.y})`);
assert(!p.dead, "powerup no debe morir por movimiento");
game.enemies = savedEnemies;

const heal = new PowerUp({ game });
heal.type = "heal";
heal.x = 300;
heal.y = 200;
const rocks = game.enemies.find(e => e.team === "rocks");
rocks.life = rocks.maxLife / 2;
const before = rocks.life;
heal.applyToTeam("rocks");
assert(heal.dead, "applyToTeam debe consumir el powerup");
assert(rocks.life > before, `heal debe curar al equipo (${before} -> ${rocks.life})`);

const zap = new PowerUp({ game });
zap.type = "zap";
const victim = game.enemies.find(e => e.team === "rocks");
const zBefore = victim.life;
zap.applyToTeam("rocks");
assert(victim.life < zBefore, `zap debe dañar al equipo (${zBefore} -> ${victim.life})`);

console.log(ok ? "POWERUP OK" : "POWERUP FAIL");
game.destroy();
process.exit(ok ? 0 : 1);
