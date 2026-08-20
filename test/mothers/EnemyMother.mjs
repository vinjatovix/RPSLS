import { EnemyBuilder } from "../builders/EnemyBuilder.mjs";

export const EnemyMother = {
  rock(game = null) {
    const builder = new EnemyBuilder().withTeam("rocks");
    if (game) builder.withGame(game);

    return builder.build();
  },

  scissors(game = null) {
    const builder = new EnemyBuilder().withTeam("scissors");
    if (game) builder.withGame(game);

    return builder.build();
  },

  paper(game = null) {
    const builder = new EnemyBuilder().withTeam("papers");
    if (game) builder.withGame(game);

    return builder.build();
  },

  lizard(game = null) {
    const builder = new EnemyBuilder().withTeam("lizards");
    if (game) builder.withGame(game);

    return builder.build();
  },

  spock(game = null) {
    const builder = new EnemyBuilder().withTeam("spocks");
    if (game) builder.withGame(game);

    return builder.build();
  },

  rockWithLowHealth(game = null) {
    const builder = new EnemyBuilder()
      .withTeam("rocks")
      .withModifiers({ health: 0.01 }); 
    if (game) builder.withGame(game);
    const enemy = builder.build();
    enemy.life = 1;

    return enemy;
  },

  scissorsWithLowHealth(game = null) {
    const builder = new EnemyBuilder()
      .withTeam("scissors")
      .withModifiers({ health: 0.01 });
    if (game) builder.withGame(game);
    const enemy = builder.build();
    enemy.life = 1;

    return enemy;
  },

  paperAtCenter(width = 600, height = 400, game = null) {
    const builder = new EnemyBuilder()
      .withTeam("papers")
      .withPosition(width / 2, height / 2);
    if (game) builder.withGame(game);
    
    return builder.build();
  }
};
