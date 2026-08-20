import { Random } from "../core/index.js";

export class MatchManager {
  constructor({ game, eventBus, options, startLevel }) {
    this.game = game;
    this.eventBus = eventBus;
    this.options = options;

    this.timeLeft = this.game.config.meta.initialTimeLeftMs;
    this.match = this.game.mode.kind === "level" ? startLevel : 0;
    this.enemyGroupCount = Math.max(1, Math.floor(this.match / this.game.config.meta.enemiesPerLevel));

    this.gameTime = 0;
    this.lastMechanicTimeless = null;
    this.timeSinceLastAction = 0;
    this.lastTickSecond = -1;
    this.paused = false;

    this.eventBus?.subscribe("kill", () => {
      this.timeSinceLastAction = 0;
    });
  }

  isPaused() {
    return this.paused;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  startMatch() {
    if (this.game.leagueSeed) {
      Random.setSeed(this.game.leagueSeed + this.match);
    }

    this.options.setMechanic("timeless", true);
    this.options.setMechanic("capture", this.game.mode.capture);
    this.enemyGroupCount = Math.max(1, Math.floor(this.match / this.game.config.meta.enemiesPerLevel));

    this.timeLeft = Math.min(
      this.game.config.mechanics.matchTimeMaxMs,
      this.game.config.mechanics.matchTimeBaseMs + this.match * this.game.config.mechanics.matchTimeGrowthMs
    );

    this.timeSinceLastAction = 0;
    this.eventBus?.emit("game:match-start", { 
      matchNumber: this.match, 
      mode: this.game.mode, 
      leagueLength: this.game.leagueLength,
      timeLeft: this.timeLeft,
      timeless: this.options.mechanics.timeless
    });
  }

  nextMatch() {
    this.eventBus?.emit("game:match-end", { 
      match: this.match,
      winners: this.game.lastWin,
      modeKey: this.game.modeKey,
      leagueLength: this.game.leagueLength
    });
    this.match++;

    if (this.game.mode.isLeague && this.match > this.game.leagueLength) {
      this.endLeague();
      return;
    }

    this.game.saveGameState?.();

    if (this.game.width < this.options.display.maxWidth) {
      const { width, height } = this.game.canvasAdapter.resize(1.003 * this.match);
      this.game.width = width;
      this.game.height = height;
    }

    this.startMatch();
  }

  endLeague() {
    this.paused = true;
    this.eventBus?.emit("game:league-ended");
  }

  update(deltaTime, activeEnemies) {
    if (this.paused) return;

    this.gameTime += deltaTime;
    this.options.update();
    
    const alive = activeEnemies.filter(enemy => !enemy.dead).map(enemy => enemy.team);
    const unique = [...new Set(alive)];

    this.timeSinceLastAction += deltaTime;
    const isStalled = this.timeSinceLastAction > this.game.config.meta.stallTimeoutMs && unique.length > 2;
    const shouldBeTimeless = unique.length > 3 && !isStalled;

    if (this.options.mechanics.timeless !== shouldBeTimeless) {
      this.options.setMechanic("timeless", shouldBeTimeless);
    }

    if (isStalled) {
      this.timeLeft = Math.min(this.timeLeft, this.game.config.meta.stallCountdownMs);
    }

    if (!this.options.mechanics.timeless) {
      this.timeLeft -= deltaTime;
    }

    if (!this.options.mechanics.timeless) {
      const currentSecond = Math.floor(this.timeLeft / 1000);
      if (currentSecond !== this.lastTickSecond) {
        this.lastTickSecond = currentSecond;
        this.eventBus?.emit("tick", { timeLeft: this.timeLeft });
      }
    }

    if (this.options.mechanics.timeless !== this.lastMechanicTimeless) {
      this.lastMechanicTimeless = this.options.mechanics.timeless;
      this.eventBus?.emit("game:mechanics-change", { timeless: this.options.mechanics.timeless });
    }

    if (unique.length === 1) {
      const winner = unique[0];
      this.game.lastWin = winner;
      this.eventBus?.emit("game:match-resolved", { winner, match: this.match });
      this.nextMatch();
      return;
    }

    if (this.timeLeft <= 0) {
      let winner = "DRAW";
      if (unique.length === 2) {
        const team1 = activeEnemies.filter(enemy => enemy.team === unique[0]);
        const team2 = activeEnemies.filter(enemy => enemy.team === unique[1]);
        if (team1[0].aim.includes(team2[0].team)) {
          winner = unique[1];
        } else if (team2[0].aim.includes(team1[0].team)) {
          winner = unique[0];
        }
      }
      this.game.lastWin = winner;
      this.eventBus?.emit("game:match-resolved", { winner, match: this.match });
      this.nextMatch();
    }
  }
}
