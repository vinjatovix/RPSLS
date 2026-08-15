/**
 * game-modes.mjs - Verifica modos de juego, fin de liga, teclas y persistencia:
 *   - Modos captura/muerte fijan mechanics.capture
 *   - Modos nivel arrancan en el nivel elegido sin match fantasma
 *   - Fin de liga: al superar la longitud se dispara onLeagueEnd con el ranking
 *   - Teclas a/c/l/o son inertes (no existen en InputHandler)
 *   - El progreso arranca desde 0 (se limpia idleSave-v1) y no se persiste
 *   node test/game-modes.mjs
 */

import "./dom-stub.js";

const { Game } = await import("../src/index.js");
const { GAME_MODES, LEAGUE_LENGTHS, GAME_CONFIG } = await import("../src/config/gameConfig.js");

let ok = true;
const assert = (cond, msg) => {
  if (!cond) {
    ok = false;
    console.log(`FAIL: ${msg}`);
  }
};

// ============ Config ============
assert(Object.keys(GAME_MODES).length === 6, "GAME_MODES debe tener 6 modos");
assert(
  ["liga-captura", "liga-muerte", "infinito-captura", "infinito-muerte", "lvl-captura", "lvl-muerte"].every(
    k => GAME_MODES[k]
  ),
  "GAME_MODES debe incluir los 6 modos esperados"
);
assert(JSON.stringify(LEAGUE_LENGTHS) === JSON.stringify([50, 100, 200]), "LEAGUE_LENGTHS = [50,100,200]");
assert(GAME_MODES["infinito-muerte"].capture === false, "infinito-muerte: capture false en config");
assert(GAME_MODES["infinito-captura"].capture === true, "infinito-captura: capture true en config");
assert(GAME_MODES["liga-captura"].isLeague === true, "liga-captura: es liga");
assert(GAME_MODES["lvl-muerte"].kind === "level", "lvl-muerte: kind level");
assert(
  GAME_CONFIG.mechanics.matchTimeMaxMs === 60000,
  "matchTimeMaxMs debe ser 60000ms (60s)"
);

// ============ Persistencia: empezar desde 0 ============
localStorage.setItem(
  "idleSave-v1",
  JSON.stringify({
    credits: 999,
    selectedTeam: "lizards",
    teamChosen: true,
    upgrades: { powerupLuck: 3 },
    raceUpgrades: {}
  })
);
const pg = new Game({ startLevel: 0 });
const pm = pg.progressManager;
assert(pm.credits === 0, "persistencia: credits arrancan en 0 aunque haya save previo");
assert(pm.teamChosen === false, "persistencia: teamChosen arranca en false");
assert(pm.selectedTeam === "rocks", "persistencia: selectedTeam vuelve al default");
assert(localStorage.getItem("idleSave-v1") === null, "persistencia: idleSave-v1 se limpia al crear partida");
pm.selectTeam("rocks");
pm.awardCredits(50);
pm.spendCredits(10);
assert(localStorage.getItem("idleSave-v1") === null, "persistencia: awardCredits/spendCredits no persisten");
pg.destroy();

// ============ Modo por defecto + teclas inertes ============
const g = new Game({ startLevel: 0 });
g.progressManager.reset();
g.progressManager.selectTeam("rocks");
g.match = 0;
g.onTeamChanged();
assert(g.modeKey === "infinito-muerte", "modo por defecto es infinito-muerte");
assert(g.options.mechanics.capture === false, "infinito-muerte: capture off tras arrancar");
assert(g.options.mechanics.outDies === true, "outDies siempre true");
assert(g.options.mechanics.limitCanvas === false, "limitCanvas siempre false");
assert(g.match === 1, "primera partida real = match 1 (sin fantasma)");
assert(g.enemies.length > 0 && g.enemies.every(e => !e.dead), "modo default: hay enemigos vivos tras arrancar");

const keys = g.inputHandler.getKeys();
for (const k of ["a", "c", "l", "o"]) {
  assert(!(k in keys), `tecla ${k} no debe existir en InputHandler`);
}
g.inputHandler.setKeyState("o", true);
g.inputHandler.setKeyState("c", true);
g.inputHandler.setKeyState("a", true);
g.inputHandler.setKeyState("l", true);
assert(g.options.mechanics.outDies === true, "o: inerte (no cambia outDies)");
assert(g.options.mechanics.capture === false, "c: inerte (capture lo fija el modo)");
assert(g.options.mechanics.limitCanvas === false, "l: inerte (limitCanvas sigue off)");
assert(!("dot" in g.options.effects), "a: inerte (dot eliminado de efectos)");
g.destroy();

// ============ Modo captura fija capture ============
const cap = new Game({ startLevel: 0, mode: "infinito-captura" });
cap.progressManager.reset();
cap.progressManager.selectTeam("rocks");
cap.match = 0;
cap.onTeamChanged();
assert(cap.options.mechanics.capture === true, "infinito-captura: capture on tras arrancar");
cap.destroy();

// ============ Modo nivel: arranca en el nivel elegido ============
const lvl = new Game({ startLevel: 100, mode: "lvl-captura", team: "rocks" });
assert(lvl.match === 100, `lvl-captura: primer match = nivel elegido (got ${lvl.match})`);
assert(lvl.options.mechanics.capture === true, "lvl-captura: capture on");
assert(
  lvl.enemies.length === Math.floor(100 / 10) * 5,
  `lvl-captura: enemies = 10 niveles × 5 razas (got ${lvl.enemies.length})`
);
assert(lvl.enemies.length > 0 && lvl.enemies.every(e => !e.dead), "lvl-captura: enemigos vivos desde el primer frame");
lvl.destroy();

const lvlDeath = new Game({ startLevel: 0, mode: "lvl-muerte", team: "rocks" });
assert(lvlDeath.match === 0, "lvl-muerte: nivel 0 → match 0");
assert(lvlDeath.options.mechanics.capture === false, "lvl-muerte: capture off");
assert(
  lvlDeath.enemies.length === 5,
  `lvl-muerte: enemies = 1 nivel × 5 razas (got ${lvlDeath.enemies.length})`
);
lvlDeath.destroy();

const lvlMax = new Game({ startLevel: 2000, mode: "lvl-muerte", team: "rocks" });
assert(
  lvlMax.timeLeft === 60000,
  `lvl 2000: timer capado a 60000ms (got ${lvlMax.timeLeft})`
);
lvlMax.destroy();

// ============ Fin de liga ============
const lg = new Game({ startLevel: 0, mode: "liga-muerte", leagueLength: 3 });
lg.progressManager.reset();
lg.progressManager.selectTeam("rocks");
lg.match = 0;
lg.onTeamChanged();
assert(lg.match === 1, "liga: primer match = 1");
assert(lg.options.mechanics.capture === false, "liga-muerte: capture off");
assert(lg.scoreManager.getRanking().length === 5, "liga: el ranking tiene 5 equipos");

lg.scoreManager.addWin("rocks", { match: 1 });
lg.scoreManager.addWin("rocks", { match: 2 });
let result = null;
lg.onLeagueEnd = p => {
  result = p;
};
lg.match = 3;
lg.enemies = [];
lg.options.setMechanic("timeless", false);
lg.timeLeft = 100;
lg.timeSinceLastAction = 0;
lg.update(200);

assert(result !== null, "liga: al superar la longitud se dispara onLeagueEnd");
assert(result && result.modeKey === "liga-muerte", "liga: payload incluye modeKey");
assert(result && result.leagueLength === 3, "liga: payload incluye leagueLength");
assert(result && result.playerTeam === "rocks", "liga: payload incluye playerTeam");
assert(result && result.ranking.length === 5, "liga: ranking completo con nombres");
assert(result && result.ranking[0].name === "rocks", "liga: el primero del ranking es el ganador");
assert(lg.paused === true, "liga: el juego queda en pausa al terminar");
assert(lg.match === 4, `liga: match queda en longitud+1 (got ${lg.match})`);
lg.destroy();

console.log(ok ? "GAME MODES OK" : "GAME MODES FAIL");
process.exit(ok ? 0 : 1);
