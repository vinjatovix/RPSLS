import { RACE_CLASSES, ALL_RACES } from "./races.js";

export const EnemyFactory = {
  spawnEnemy(team, game, props = {}) {
    const EnemyClass = RACE_CLASSES[team];
    if (!EnemyClass) return null;

    return new EnemyClass({ game, x: null, y: null, ...props });
  },

  spawnMatch(game, selectedTeam, progressManager, count) {
    const enemies = [];
    for (let i = 0; i < count; i++) {
      for (const enemyClass of ALL_RACES) {
        const modifiers =
          enemyClass.teamName === selectedTeam
            ? progressManager.getRaceModifiers(selectedTeam)
            : null;
        enemies.push(new enemyClass({ game, x: null, y: null, modifiers }));
      }
    }
    return enemies;
  },

  captureEnemy(killed, game, progressManager) {
    if (!killed.killedBy || !RACE_CLASSES[killed.killedBy]) return null;
    const EnemyClass = RACE_CLASSES[killed.killedBy];
    const modifiers =
      EnemyClass.teamName === progressManager.selectedTeam
        ? progressManager.getRaceModifiers(progressManager.selectedTeam)
        : null;
        
    return new EnemyClass({
      x: killed.x,
      y: killed.y,
      game,
      angle: killed.angle,
      modifiers
    });
  }
};
