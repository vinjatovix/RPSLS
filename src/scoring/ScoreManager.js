/**
 * ScoreManager - Gestión de puntuaciones y estadísticas
 * Responsabilidad única: mantener y actualizar estadísticas de los equipos
 */

export class ScoreManager {
  constructor() {
    this.initialValues = { kills: 0, deaths: 0, score: 0, ratio: 0 };
    
    // Inicializar equipos con sus emojis
    this.teams = {
      rocks: { emoji: "🪨", ...JSON.parse(JSON.stringify(this.initialValues)) },
      papers: { emoji: "📄", ...JSON.parse(JSON.stringify(this.initialValues)) },
      scissors: { emoji: "✂️", ...JSON.parse(JSON.stringify(this.initialValues)) },
      lizards: { emoji: "🦎", ...JSON.parse(JSON.stringify(this.initialValues)) },
      spocks: { emoji: "🖖", ...JSON.parse(JSON.stringify(this.initialValues)) }
    };
  }

  /**
   * Actualizar estadísticas cuando un equipo mata a otro
   */
  recordKill(killerTeam, victimTeam) {
    if (!this.teams[killerTeam] || !this.teams[victimTeam]) {
      console.warn(`Team not found: ${killerTeam} or ${victimTeam}`);
      return;
    }

    this.teams[killerTeam].kills += 1;
    this.teams[victimTeam].deaths += 1;

    // Actualizar ratios (evitar división por cero)
    this.teams[killerTeam].ratio = 
      this.teams[killerTeam].deaths > 0
        ? (this.teams[killerTeam].kills / this.teams[killerTeam].deaths).toFixed(2)
        : this.teams[killerTeam].kills;

    this.teams[victimTeam].ratio = 
      this.teams[victimTeam].deaths > 0
        ? (this.teams[victimTeam].kills / this.teams[victimTeam].deaths).toFixed(2)
        : this.teams[victimTeam].kills;
  }

  /**
   * Añadir punto de victoria a un equipo
   */
  addWin(team) {
    if (this.teams[team]) {
      this.teams[team].score += 1;
    }
  }

  /**
   * Obtener ranking ordenado
   */
  getRanking() {
    const ranking = Object.values(this.teams);
    return this.sortRanking(ranking);
  }

  /**
   * Ordenar ranking por criterios: score > ratio > kills > deaths
   */
  sortRanking(ranking) {
    return ranking.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.ratio !== b.ratio) return b.ratio - a.ratio;
      if (a.kills !== b.kills) return b.kills - a.kills;
      return b.deaths - a.deaths;
    });
  }

  /**
   * Obtener equipo por nombre
   */
  getTeam(teamName) {
    return this.teams[teamName] || null;
  }

  /**
   * Resetear todas las estadísticas
   */
  reset() {
    Object.keys(this.teams).forEach(teamName => {
      this.teams[teamName] = { 
        emoji: this.teams[teamName].emoji,
        ...JSON.parse(JSON.stringify(this.initialValues))
      };
    });
  }
}
