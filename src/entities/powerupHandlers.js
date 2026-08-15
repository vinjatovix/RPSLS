export const GLOBAL_EFFECT_HANDLERS = {
  time: (powerup, team, config) => {
    powerup.game.timeLeft += config.amount;
  },
  gold: (powerup, team, config) => {
    if (team !== powerup.game.progressManager.selectedTeam) return;
    powerup.game.progressManager.awardCredits(5 + Math.floor(Math.random() * 21));
  }
};

export const TARGET_EFFECT_HANDLERS = {
  heal: (target, config) => {
    target.life = target.maxLife;
  },
  zap: (target, config) => {
    target.life = Math.max(1, Math.floor(target.life * config.amount));
  }
};
