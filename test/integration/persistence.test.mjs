import assert from "node:assert/strict";
import { test } from "node:test";

import { Game } from "../../src/index.js";
import { createFakeAdapters } from "../doubles/FakeAdapters.mjs";

test("Game: start saves initial active game state to storageAdapter", () => {
  const adapters = createFakeAdapters();
  const game = new Game({ startLevel: 0, mode: "league-death", leagueLength: 5, adapters });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");

  game.start();

  const saved = adapters.storageAdapter.load("active-game-state");
  assert.ok(saved);
  assert.equal(saved.match, 1);
  assert.equal(saved.leagueLength, 5);
  assert.equal(saved.modeKey, "league-death");
  assert.equal(saved.leagueSeed, game.leagueSeed);
  game.destroy();
});

test("Game: nextMatch increments and saves updated match count to storageAdapter", () => {
  const adapters = createFakeAdapters();
  const game = new Game({ startLevel: 0, mode: "league-death", leagueLength: 5, adapters });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.start();

  game.matchManager.nextMatch();

  const saved = adapters.storageAdapter.load("active-game-state");
  assert.equal(saved.match, 2);
  game.destroy();
});

test("Game: initialization restores previous match and scoring state from storageAdapter", () => {
  const adapters = createFakeAdapters();
  const game = new Game({ startLevel: 0, mode: "league-death", leagueLength: 5, adapters });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.start();
  game.matchManager.nextMatch();

  const reloadedGame = new Game({ startLevel: 0, mode: "league-death", leagueLength: 5, adapters });

  assert.equal(reloadedGame.matchManager.match, 2);
  assert.equal(reloadedGame.leagueSeed, game.leagueSeed);
  assert.deepEqual(reloadedGame.scoreManager.teams, game.scoreManager.teams);
  game.destroy();
  reloadedGame.destroy();
});

test("Game: reloaded game start does not increment restored match number", () => {
  const adapters = createFakeAdapters();
  const game = new Game({ startLevel: 0, mode: "league-death", leagueLength: 5, adapters });
  game.progressManager.reset();
  game.progressManager.selectTeam("rocks");
  game.start();
  game.matchManager.nextMatch();
  const reloadedGame = new Game({ startLevel: 0, mode: "league-death", leagueLength: 5, adapters });

  reloadedGame.start();

  assert.equal(reloadedGame.matchManager.match, 2);
  game.destroy();
  reloadedGame.destroy();
});

test("Game: loadGameState handles corrupted or partially incomplete active-game-state gracefully", () => {
  const adapters = createFakeAdapters();
  const corruptedState = {
    match: -10,
    modeKey: "invalid-mode-key-that-does-not-exist",
    leagueLength: -50,
    leagueSeed: "not-an-integer",
    teams: {
      rocks: { kills: -5, deaths: "ten", score: -100, ratio: -1.2 },
      papers: null
    }
  };
  adapters.storageAdapter.save(corruptedState, "active-game-state");

  const game = new Game({ startLevel: 0, adapters });

  assert.ok(game.matchManager.match >= 0);
  assert.equal(game.modeKey, "infinite-death");
  assert.ok(game.leagueLength > 0);
  assert.ok(Number.isInteger(game.leagueSeed));
  for (const team of Object.keys(game.raceStats)) {
    const t = game.scoreManager.teams[team];
    assert.ok(t);
    assert.ok(t.kills >= 0);
    assert.ok(t.deaths >= 0);
    assert.ok(t.score >= 0);
    assert.ok(t.ratio >= 0);
  }
  game.destroy();
});

test("Game: loadGameState handles missing teams object by falling back gracefully", () => {
  const adapters = createFakeAdapters();
  const corruptedState = {
    match: 5,
    modeKey: "infinite-death",
    leagueLength: 10,
    leagueSeed: 12345,
    teams: null
  };
  adapters.storageAdapter.save(corruptedState, "active-game-state");

  const game = new Game({ startLevel: 0, adapters });

  assert.equal(game.matchManager.match, 0);
  assert.equal(game.modeKey, "infinite-death");
  assert.ok(game.leagueLength > 0);
  assert.ok(Number.isInteger(game.leagueSeed));
  for (const team of Object.keys(game.raceStats)) {
    const t = game.scoreManager.teams[team];
    assert.ok(t);
    assert.equal(t.kills, 0);
    assert.equal(t.deaths, 0);
    assert.equal(t.score, 0);
    assert.equal(t.ratio, 0);
  }
  game.destroy();
});
