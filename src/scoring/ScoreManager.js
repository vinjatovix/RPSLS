import { RACE_STATS } from "../config/gameConfig.js";
import { clone } from "../core/clone.js";

export class ScoreManager {
  constructor({ eventBus = null } = {}) {
    this.eventBus = eventBus;
    this.initialValues = { kills: 0, deaths: 0, score: 0, ratio: 0 };

    this.teams = {};
    for (const team of Object.keys(RACE_STATS)) {
      this.teams[team] = { 
        emoji: RACE_STATS[team].emoji, 
        name: RACE_STATS[team].team, 
        ...clone(this.initialValues) 
      };
    }
  }

  recordKill(killerTeam, victimTeam) {
    if (!this.teams[killerTeam] || !this.teams[victimTeam]) {
      console.warn(`Team not found: ${killerTeam} or ${victimTeam}`);
      return;
    }

    this.teams[killerTeam].kills += 1;
    this.teams[victimTeam].deaths += 1;

    this.teams[killerTeam].ratio =
      this.teams[killerTeam].deaths > 0
        ? this.teams[killerTeam].kills / this.teams[killerTeam].deaths
        : this.teams[killerTeam].kills;

    this.teams[victimTeam].ratio =
      this.teams[victimTeam].deaths > 0
        ? this.teams[victimTeam].kills / this.teams[victimTeam].deaths
        : this.teams[victimTeam].kills;

    this.eventBus?.emit("kill", { killerTeam, victimTeam });
    this.eventBus?.emit("score:update");
  }

  addWin(team, { match = 0 } = {}) {
    if (this.teams[team]) {
      this.teams[team].score += 1;
    }

    this.eventBus?.emit("match-win", {
      team,
      match,
      mvp: this.isMvp(team)
    });
    this.eventBus?.emit("score:update");
  }

  isMvp(team) {
    const maxKills = Math.max(...Object.values(this.teams).map(t => t.kills));
    return maxKills > 0 && this.teams[team]?.kills === maxKills;
  }

  getRanking() {
    const ranking = Object.values(this.teams);
    return this.sortRanking(ranking);
  }

  sortRanking(ranking) {
    return ranking.sort((first, second) => {
      if (first.score !== second.score) return second.score - first.score;
      if (first.ratio !== second.ratio) return second.ratio - first.ratio;
      if (first.kills !== second.kills) return second.kills - first.kills;
      return second.deaths - first.deaths;
    });
  }

  getTeam(teamName) {
    return this.teams[teamName] || null;
  }

  reset() {
    Object.keys(this.teams).forEach(teamName => {
      this.teams[teamName] = {
        emoji: this.teams[teamName].emoji,
        name: teamName,
        ...clone(this.initialValues)
      };
    });
  }
}
