import { test } from "node:test";
import assert from "node:assert/strict";

import "../dom-stub.js";
import { Game } from "../../src/index.js";
import { GAME_MODES, LEAGUE_LENGTHS, GAME_CONFIG } from "../../src/config/gameConfig.js";

test("Config: GAME_MODES has 6 well-defined modes", () => {
  assert.equal(Object.keys(GAME_MODES).length, 6);
  assert.ok(
    ["league-capture", "league-death", "infinite-capture", "infinite-death", "level-capture", "level-death"].every(
      key => GAME_MODES[key]
    ),
    "GAME_MODES must include the 6 expected modes"
  );
  assert.equal(JSON.stringify(LEAGUE_LENGTHS), JSON.stringify([50, 100, 200]));
  assert.equal(GAME_MODES["infinite-death"].capture, false);
  assert.equal(GAME_MODES["infinite-capture"].capture, true);
  assert.equal(GAME_MODES["league-capture"].isLeague, true);
  assert.equal(GAME_MODES["level-death"].kind, "level");
  assert.equal(GAME_CONFIG.mechanics.matchTimeMaxMs, 60000, "matchTimeMaxMs must be 60000ms (60s)");
});

test("ProgressManager: starts with session defaults", () => {
  const pg = new Game({ startLevel: 0 });
  const progressManager = pg.progressManager;
  assert.equal(progressManager.credits, 0, "credits start at 0");
  assert.equal(progressManager.teamChosen, false);
  assert.equal(progressManager.selectedTeam, "rocks", "selectedTeam defaults to rocks");
  pg.destroy();
});

test("Default mode: infinite-death + inert keys", () => {
  const game = new Game({ startLevel: 0 });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.matchManager.match = 0;
  game.onTeamChanged();
  assert.equal(game.modeKey, "infinite-death");
  assert.equal(game.options.mechanics.capture, false);
  assert.equal(game.options.mechanics.outDies, true);
  assert.equal(game.options.mechanics.limitCanvas, false);
  assert.equal(game.matchManager.match, 1, "first real match = match 1 (no phantom)");
  assert.ok(game.enemies.length > 0 && game.enemies.every(e => !e.dead), "enemies alive after starting");

  const keys = game.inputHandler.getKeys();
  assert.deepEqual(
    Object.keys(keys).sort(),
    ["b", "d", "s", "x"],
    "Only toggle keys should be present"
  );
  game.destroy();
});

test("Capture mode: sets mechanics.capture", () => {
  const cap = new Game({ startLevel: 0, mode: "infinite-capture" });
  cap.progressManager.reset();
  cap.progressManager.selectTeam("rocks");
  cap.matchManager.match = 0;
  cap.onTeamChanged();
  assert.equal(cap.options.mechanics.capture, true);
  cap.destroy();
});

test("Level mode: starts at the chosen level without a phantom match", () => {
  const lvl = new Game({ startLevel: 100, mode: "level-capture", team: "rocks" });
  assert.equal(lvl.matchManager.match, 100, `first match = chosen level (got ${lvl.matchManager.match})`);
  assert.equal(lvl.options.mechanics.capture, true);
  assert.equal(lvl.enemies.length, Math.floor(100 / 10) * 5, `enemies = 10 levels × 5 races`);
  assert.ok(lvl.enemies.length > 0 && lvl.enemies.every(e => !e.dead), "enemies alive from the first frame");
  lvl.destroy();

  const lvlDeath = new Game({ startLevel: 0, mode: "level-death", team: "rocks" });
  assert.equal(lvlDeath.matchManager.match, 0, "level 0 → match 0");
  assert.equal(lvlDeath.options.mechanics.capture, false);
  assert.equal(lvlDeath.enemies.length, 5, "enemies = 1 level × 5 races");
  lvlDeath.destroy();

  const lvlMax = new Game({ startLevel: 2000, mode: "level-death", team: "rocks" });
  assert.equal(lvlMax.matchManager.timeLeft, 60000, `lvl 2000: timer capped at 60000ms`);
  lvlMax.destroy();
});

test("League end: onLeagueEnd with ranking after surpassing the length", () => {
  const lg = new Game({ startLevel: 0, mode: "league-death", leagueLength: 3 });
  lg.progressManager.reset();
  lg.progressManager.selectTeam("rocks");
  lg.matchManager.match = 0;
  lg.onTeamChanged();
  assert.equal(lg.matchManager.match, 1);
  assert.equal(lg.options.mechanics.capture, false);
  assert.equal(lg.scoreManager.getRanking().length, 5);

  lg.scoreManager.addWin("rocks", { match: 1 });
  lg.scoreManager.addWin("rocks", { match: 2 });
  let result = null;
  lg.onLeagueEnd = payload => {
    result = payload;
  };
  lg.matchManager.match = 3;
  lg.enemies = [];
  lg.options.setMechanic("timeless", false);
  lg.matchManager.timeLeft = 100;
  lg.matchManager.timeSinceLastAction = 0;
  lg.update(200);

  assert.notEqual(result, null, "surpassing the length triggers onLeagueEnd");
  assert.equal(result.modeKey, "league-death");
  assert.equal(result.leagueLength, 3);
  assert.equal(result.playerTeam, "rocks");
  assert.equal(result.ranking.length, 5);
  assert.equal(result.ranking[0].name, "rocks");
  assert.equal(lg.matchManager.paused, true);
  assert.equal(lg.matchManager.match, 4, `match ends at length+1 (got ${lg.matchManager.match})`);
  lg.destroy();
});

test("Anti-stall: breaks timeless mode and triggers countdown after stallTimeoutMs", () => {
  const game = new Game({ startLevel: 0, mode: "infinite-death" });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.matchManager.match = 1;
  game.onTeamChanged();

  game.enemies = [
    { team: "rocks", dead: false, preUpdate() {}, move() {}, postUpdate() {}, draw() {} },
    { team: "papers", dead: false, preUpdate() {}, move() {}, postUpdate() {}, draw() {} },
    { team: "scissors", dead: false, preUpdate() {}, move() {}, postUpdate() {}, draw() {} },
    { team: "lizards", dead: false, preUpdate() {}, move() {}, postUpdate() {}, draw() {} }
  ];

  game.update(100);
  assert.equal(game.options.mechanics.timeless, true, "Should be in timeless mode with 4 teams");

  const initialTimeLeft = game.matchManager.timeLeft;
  game.update(5000); 
  assert.equal(game.matchManager.timeLeft, initialTimeLeft, "timeLeft should not decrease in timeless mode");

  game.matchManager.timeSinceLastAction = 31000;
  game.update(100); 

  assert.equal(game.options.mechanics.timeless, false, "Should exit timeless mode after stallTimeoutMs");
  assert.equal(game.matchManager.timeLeft, 9900, "timeLeft should be capped at stallCountdownMs minus deltaTime (10000 - 100 = 9900ms)");

  game.update(2000);
  assert.equal(game.matchManager.timeLeft, 7900, "timeLeft should decrease once out of timeless mode");

  game.destroy();
});
