import assert from "node:assert/strict";
import { test } from "node:test";

import { ScoreManager } from "../../src/scoring/ScoreManager.js";
import { FakeEventBus } from "../doubles/FakeEventBus.mjs";

test("ScoreManager: initialization sets correct default team structure", () => {
  const scoreManager = new ScoreManager();
  const teamKeys = Object.keys(scoreManager.teams);

  assert.ok(teamKeys.length > 0);

  for (const team of teamKeys) {
    const data = scoreManager.getTeam(team);

    assert.equal(data.kills, 0);
    assert.equal(data.deaths, 0);
    assert.equal(data.score, 0);
    assert.equal(data.ratio, 0);
    assert.ok(data.emoji);
    assert.ok(data.name);
  }
});

test("ScoreManager: recordKill increments kills for the killer", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");

  assert.equal(scoreManager.getTeam("rocks").kills, 1);
});

test("ScoreManager: recordKill increments deaths for the victim", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");

  assert.equal(scoreManager.getTeam("scissors").deaths, 1);
});

test("ScoreManager: recordKill computes ratio as total kills when there are no deaths", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");

  assert.equal(scoreManager.getTeam("rocks").ratio, 1);
});

test("ScoreManager: recordKill computes ratio as kills divided by deaths when deaths is greater than zero", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");
  scoreManager.recordKill("scissors", "papers");
  scoreManager.recordKill("scissors", "papers");

  assert.equal(scoreManager.getTeam("scissors").ratio, 2);
});

test("ScoreManager: recordKill handles invalid team names gracefully", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("invalidTeamA", "rocks");
  assert.equal(scoreManager.getTeam("rocks").deaths, 0);

  scoreManager.recordKill("rocks", "invalidTeamB");
  assert.equal(scoreManager.getTeam("rocks").kills, 0);
});

test("ScoreManager: recordKill emits kill event with correct payload", () => {
  const eventBus = new FakeEventBus();
  const scoreManager = new ScoreManager({ eventBus });

  scoreManager.recordKill("rocks", "scissors");

  const killEvents = eventBus.getEmitted("kill");

  assert.equal(killEvents.length, 1);
  assert.deepEqual(killEvents[0].data, { killerTeam: "rocks", victimTeam: "scissors" });
});

test("ScoreManager: recordKill emits score:update event", () => {
  const eventBus = new FakeEventBus();
  const scoreManager = new ScoreManager({ eventBus });

  scoreManager.recordKill("rocks", "scissors");

  const scoreUpdateEvents = eventBus.getEmitted("score:update");

  assert.equal(scoreUpdateEvents.length, 1);
});

test("ScoreManager: addWin increments team score", () => {
  const scoreManager = new ScoreManager();

  scoreManager.addWin("rocks");

  assert.equal(scoreManager.getTeam("rocks").score, 1);
});

test("ScoreManager: addWin emits match-win event with correct payload and MVP status", () => {
  const eventBus = new FakeEventBus();
  const scoreManager = new ScoreManager({ eventBus });

  scoreManager.recordKill("rocks", "scissors");
  scoreManager.addWin("rocks", { match: 5 });

  const winEvents = eventBus.getEmitted("match-win");

  assert.equal(winEvents.length, 1);
  assert.deepEqual(winEvents[0].data, {
    team: "rocks",
    match: 5,
    mvp: true
  });
});

test("ScoreManager: addWin emits score:update event", () => {
  const eventBus = new FakeEventBus();
  const scoreManager = new ScoreManager({ eventBus });

  scoreManager.addWin("rocks");

  const scoreUpdateEvents = eventBus.getEmitted("score:update");

  assert.equal(scoreUpdateEvents.length, 1);
});

test("ScoreManager: isMvp returns false when no kills are recorded", () => {
  const scoreManager = new ScoreManager();

  assert.equal(scoreManager.isMvp("rocks"), false);
});

test("ScoreManager: isMvp returns true for the team with the most kills", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");

  assert.equal(scoreManager.isMvp("rocks"), true);
});

test("ScoreManager: isMvp returns false for a team that is not the top killer", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");
  scoreManager.recordKill("scissors", "papers");
  scoreManager.recordKill("scissors", "papers");

  assert.equal(scoreManager.isMvp("rocks"), false);
});

test("ScoreManager: getRanking sorts primarily by score descending", () => {
  const scoreManager = new ScoreManager();

  scoreManager.addWin("rocks");
  scoreManager.addWin("rocks");
  scoreManager.addWin("papers");

  const ranking = scoreManager.getRanking();

  assert.equal(ranking[0].name, "rocks");
  assert.equal(ranking[1].name, "papers");
});

test("ScoreManager: getRanking sorts by ratio descending as a first tie-breaker", () => {
  const scoreManager = new ScoreManager();

  scoreManager.addWin("rocks");
  scoreManager.recordKill("rocks", "scissors");

  scoreManager.addWin("papers");
  scoreManager.recordKill("papers", "rocks");
  scoreManager.recordKill("papers", "rocks");

  const ranking = scoreManager.getRanking();

  assert.equal(ranking[0].name, "papers");
  assert.equal(ranking[1].name, "rocks");
});

test("ScoreManager: getRanking sorts by kills descending as a second tie-breaker", () => {
  const scoreManager = new ScoreManager();

  scoreManager.addWin("rocks");
  scoreManager.recordKill("spocks", "rocks");
  scoreManager.recordKill("rocks", "lizards");

  scoreManager.addWin("papers");
  scoreManager.recordKill("lizards", "papers");
  scoreManager.recordKill("lizards", "papers");
  scoreManager.recordKill("papers", "spocks");
  scoreManager.recordKill("papers", "spocks");

  const ranking = scoreManager.getRanking();

  assert.equal(ranking[0].name, "papers");
  assert.equal(ranking[1].name, "rocks");
});

test("ScoreManager: getRanking sorts by deaths descending as a third tie-breaker", () => {
  const scoreManager = new ScoreManager();

  scoreManager.recordKill("rocks", "scissors");
  scoreManager.recordKill("rocks", "scissors");

  scoreManager.recordKill("papers", "spocks");
  scoreManager.recordKill("papers", "spocks");
  scoreManager.recordKill("lizards", "papers");

  const ranking = scoreManager.getRanking();

  assert.equal(ranking[0].name, "papers");
  assert.equal(ranking[1].name, "rocks");
});

test("ScoreManager: reset restores all team statistics to their initial values", () => {
  const scoreManager = new ScoreManager();

  scoreManager.addWin("rocks");
  scoreManager.recordKill("rocks", "scissors");
  scoreManager.reset();

  const rocks = scoreManager.getTeam("rocks");

  assert.equal(rocks.kills, 0);
  assert.equal(rocks.deaths, 0);
  assert.equal(rocks.score, 0);
  assert.equal(rocks.ratio, 0);
});

test("ScoreManager: increments winner score when handling game:match-resolved", () => {
  const eventBus = new FakeEventBus();
  const scoreManager = new ScoreManager({ eventBus });

  eventBus.emit("game:match-resolved", { winner: "rocks", match: 1 });

  assert.equal(scoreManager.getTeam("rocks").score, 1);
});

test("ScoreManager: does not increment score when game:match-resolved is a DRAW", () => {
  const eventBus = new FakeEventBus();
  const scoreManager = new ScoreManager({ eventBus });

  eventBus.emit("game:match-resolved", { winner: "DRAW", match: 1 });

  assert.equal(scoreManager.getTeam("rocks").score, 0);
});
