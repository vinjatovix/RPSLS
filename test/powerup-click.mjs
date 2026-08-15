/**
 * powerup-click.mjs - Verifica el flujo de click: pointerdown sobre un
 * powerup lo recoge; los positivos afectan al equipo del jugador y las
 * trampas (negativos) a todos los demás equipos. Cubre TODOS los tipos.
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
    return { canvas, fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, translate() {}, scale() {}, fillText() {}, strokeText() {}, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalAlpha(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {} };
  },
  getBoundingClientRect() {
    return { width: 640, height: 384, left: 0, top: 0 };
  }
};

const prevGetElementById = document.getElementById;
document.getElementById = id => (id === "canvas1" ? canvas : prevGetElementById(id));

const { Game } = await import("../src/index.js");
const { PowerUp } = await import("../src/entities/PowerUp.js");
const { POWERUP_TYPES } = await import("../src/config/gameConfig.js");

const game = new Game({ startLevel: 0 });
game.progressManager.reset();
game.progressManager.selectTeam("rocks");
let goldGot = null;
game.progressManager.awardCredits = v => {
  goldGot = v;
};
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

const types = Object.entries(POWERUP_TYPES);
let idx = 0;
for (const [key, cfg] of types) {
  const p = new PowerUp({ game });
  p.type = key;
  p.x = 80 + (idx % 10) * 45;
  p.y = 120 + Math.floor(idx / 10) * 45;
  p.vx = 0;
  p.vy = 0;
  game.powerups = [p];

  game.enemies.forEach(e => {
    e.buffs = {};
  });
  const rocks = game.enemies.filter(e => e.team === "rocks");
  rocks.forEach(r => {
    r.life = Math.floor(r.maxLife / 2);
  });
  const rocksBefore = rocks.map(r => r.life);
  const othersBefore = game.enemies.filter(e => e.team !== "rocks").map(e => e.life);
  const tlBefore = game.timeLeft;
  goldGot = null;

  clickAt(p);

  assert(p.dead, `${key}: click debe consumir el powerup`);
  assert(
    game.particles.particles.some(part => part.text === cfg.label),
    `${key}: click debe mostrar texto flotante "${cfg.label}"`
  );

  if (cfg.trap) {
    assert(
      rocks.every((r, i) => !r.isBuffActive(key) && r.life === rocksBefore[i]),
      `${key}: la trampa NO debe afectar a MI equipo`
    );
    const othersNow = game.enemies.filter(e => e.team !== "rocks").map(e => e.life);
    if (key === "zap") {
      assert(
        othersNow.some((life, i) => life < othersBefore[i]),
        "zap: la trampa debe reducir vida a OTROS equipos"
      );
    } else {
      assert(
        game.enemies.some(e => e.team !== "rocks" && !e.dead && e.isBuffActive(key)),
        `${key}: la trampa debe afectar a OTROS equipos`
      );
    }
  } else {
    switch (key) {
      case "heal":
        assert(
          rocks.every(r => r.life === r.maxLife),
          `heal: debe curar SIEMPRE al 100% (${rocks.map(r => `${r.life}/${r.maxLife}`).join(", ")})`
        );
        break;
      case "time":
        assert(game.timeLeft === tlBefore + cfg.amount, "time: debe sumar tiempo al match");
        break;
      case "gold":
        assert(goldGot !== null && goldGot >= 5 && goldGot <= 25, `gold: debe dar 5-25 créditos (got ${goldGot})`);
        break;
      default:
        assert(
          rocks.some(r => r.isBuffActive(key)),
          `${key}: el positivo debe aplicar buff a MI equipo`
        );
    }
  }
  idx++;
}

const far = new PowerUp({ game });
far.x = 600;
far.y = 340;
far.vx = 0;
far.vy = 0;
game.powerups = [far];
const farX = 100 * (rect.width / canvas.width) + rect.left;
const farY = 100 * (rect.height / canvas.height) + rect.top;
listeners.pointerdown[0]({ clientX: farX, clientY: farY });
assert(!far.dead, "click lejos del powerup NO debe recogerlo");

console.log(ok ? "POWERUP CLICK OK" : "POWERUP CLICK FAIL");
game.destroy();
process.exit(ok ? 0 : 1);
