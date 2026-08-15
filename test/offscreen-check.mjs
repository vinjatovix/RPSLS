/**
 * offscreen-check.mjs - Mide muertes off-screen (killedBy null) vs por daño.
 *   node test/offscreen-check.mjs [matches=100]
 */

import "./dom-stub.js";
import { Game } from "../src/index.js";
import { TEAMS } from "../src/testing/balanceRunner.js";

const matches = +process.argv[2] || 100;

const game = new Game({ startLevel: 0 });
game.progressManager.reset();
game.progressManager.selectTeam("rocks");
game.progressManager.awardCredits = () => {};
game.match = 0;
game.onTeamChanged();
game.inputHandler.setKeyState("c", false);
game.inputHandler.setKeyState("o", true);
game.powerupTimer = Infinity;

const allSeen = new Set();
while (game.match <= matches) {
  game.update(16);
  for (const e of game.enemies) allSeen.add(e);
}

const offScreen = {};
const byDamage = {};
for (const t of TEAMS) {
  offScreen[t] = 0;
  byDamage[t] = 0;
}
let total = 0;
for (const e of allSeen) {
  if (!e.dead) continue;
  total++;
  if (e.killedBy) byDamage[e.team]++;
  else offScreen[e.team]++;
}

const o = Object.values(offScreen).reduce((a, b) => a + b, 0);
console.log(`Matches: ${matches} | enemigos vistos: ${allSeen.size} | muertes: ${total}`);
console.log(`Off-screen por equipo: ${JSON.stringify(offScreen)}`);
console.log(`Por daño por equipo:   ${JSON.stringify(byDamage)}`);
console.log(`% off-screen del total: ${((o / Math.max(1, total)) * 100).toFixed(1)}%`);

game.destroy();
