/**
 * powerup-click.mjs - Verifica el flujo de click: pointerdown sobre un
 * powerup lo recoge para el equipo del jugador; las trampas van a los
 * demás equipos.
 *   node test/powerup-click.mjs
 */

import "./dom-stub.js";

const listeners = {};
const canvas = {
  style: {},
  width: 640,
  height: 384,
  listeners,
  addEventListener(type, fn) {
    (listeners[type] ||= []).push(fn);
  },
  removeEventListener() {},
  getContext() {
    return { canvas, fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, translate() {}, scale() {}, fillText() {}, set fillStyle(v) {}, set globalAlpha(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {} };
  },
  getBoundingClientRect() {
    return { width: 640, height: 384, left: 0, top: 0 };
  }
};

const prevGetElementById = document.getElementById;
document.getElementById = id => (id === "canvas1" ? canvas : prevGetElementById(id));

const { Game } = await import("../src/index.js");
const { PowerUp } = await import("../src/entities/PowerUp.js");

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

const rect = canvas.getBoundingClientRect();
const clickAt = p => {
  const clientX = (p.x + p.width / 2) * (rect.width / canvas.width) + rect.left;
  const clientY = (p.y + p.height / 2) * (rect.height / canvas.height) + rect.top;
  listeners.pointerdown[0]({ clientX, clientY });
};

assert(listeners.pointerdown?.length > 0, "debe existir un listener pointerdown en el canvas");

const p = new PowerUp({ game });
p.x = 150;
p.y = 120;
p.vx = 0;
p.vy = 0;
game.powerups = [p];
clickAt(p);
assert(p.dead, "click sobre el powerup debe recogerlo");

const p2 = new PowerUp({ game });
p2.x = 500;
p2.y = 300;
p2.vx = 0;
p2.vy = 0;
game.powerups = [p2];
const farX = 300 * (rect.width / canvas.width) + rect.left;
const farY = 100 * (rect.height / canvas.height) + rect.top;
listeners.pointerdown[0]({ clientX: farX, clientY: farY });
assert(!p2.dead, "click lejos del powerup NO debe recogerlo");

const heal = new PowerUp({ game });
heal.type = "heal";
heal.x = 100;
heal.y = 100;
heal.vx = 0;
heal.vy = 0;
game.powerups = [heal];
const rockTarget = game.enemies.find(e => e.team === "rocks");
rockTarget.life = 100;
clickAt(heal);
assert(heal.dead, "click sobre heal debe consumirlo");
assert(rockTarget.life > 100, `heal clickeado debe curar a MI equipo (${rockTarget.life})`);

const zap = new PowerUp({ game });
zap.type = "zap";
zap.x = 200;
zap.y = 180;
zap.vx = 0;
zap.vy = 0;
game.powerups = [zap];
const rocksBefore = game.enemies.filter(e => e.team === "rocks").map(e => e.life);
const paperTarget = game.enemies.find(e => e.team === "papers");
const paperBefore = paperTarget.life;
clickAt(zap);
assert(zap.dead, "click sobre la trampa debe consumirla");
assert(
  game.enemies.filter(e => e.team === "rocks").every((e, i) => e.life === rocksBefore[i]),
  "la trampa clickeada NO debe dañar a MI equipo"
);
assert(paperTarget.life < paperBefore, `la trampa clickeada debe dañar a otros equipos (${paperBefore} -> ${paperTarget.life})`);

const slow = new PowerUp({ game });
slow.type = "slow";
slow.x = 260;
slow.y = 220;
slow.vx = 0;
slow.vy = 0;
game.powerups = [slow];
const rocksStill = game.enemies.filter(e => e.team === "rocks");
clickAt(slow);
assert(slow.dead, "click sobre slow debe consumirlo");
assert(
  rocksStill.every(e => !e.isBuffActive("slow")),
  "slow clickeado NO debe aplicar debuff a MI equipo"
);
assert(
  game.enemies.some(e => e.team !== "rocks" && e.isBuffActive("slow")),
  "slow clickeado debe aplicar debuff a otros equipos"
);

console.log(ok ? "POWERUP CLICK OK" : "POWERUP CLICK FAIL");
game.destroy();
process.exit(ok ? 0 : 1);
