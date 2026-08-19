import { Random } from "../core/index.js";
export const GLOBAL_EFFECT_HANDLERS = {
  time: (powerup, team, config) => {
    powerup.game.matchManager.timeLeft += config.amount;
  },
  gold: (powerup, team, config) => {
    if (team !== powerup.game.progressManager.selectedTeam) return;
    powerup.game.progressManager.awardCredits(config.amount + Math.floor(Random.next() * config.range));
  }
};

export const TARGET_EFFECT_HANDLERS = {
  heal: (target) => {
    target.life = target.maxLife;
  },
  zap: (target, config) => {
    target.life = Math.max(1, Math.floor(target.life * config.amount));
  }
};
