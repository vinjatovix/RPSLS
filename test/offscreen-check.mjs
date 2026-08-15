/**
 * offscreen-check.mjs - Measures off-screen deaths (killedBy null) vs by damage.
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
game.powerupTimer = Infinity;

const allSeen = new Set();
while (game.match <= matches) {
  game.update(16);
  for (const enemy of game.enemies) allSeen.add(enemy);
}

const offScreen = {};
const byDamage = {};
for (const team of TEAMS) {
  offScreen[team] = 0;
  byDamage[team] = 0;
}
let total = 0;
for (const enemy of allSeen) {
  if (!enemy.dead) continue;
  total++;
  if (enemy.killedBy) byDamage[enemy.team]++;
  else offScreen[enemy.team]++;
}

const offScreenTotal = Object.values(offScreen).reduce((a, b) => a + b, 0);
console.log(`Matches: ${matches} | enemies seen: ${allSeen.size} | deaths: ${total}`);
console.log(`Off-screen per team: ${JSON.stringify(offScreen)}`);
console.log(`By damage per team:   ${JSON.stringify(byDamage)}`);
console.log(`% off-screen of total: ${((offScreenTotal / Math.max(1, total)) * 100).toFixed(1)}%`);

game.destroy();
