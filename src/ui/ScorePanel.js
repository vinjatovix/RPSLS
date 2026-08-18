export class ScorePanel {
  constructor({ scoreManager, eventBus }) {
    this.scoreManager = scoreManager;
    this.eventBus = eventBus;
    this.scoreListElement = document.getElementById("score-list");

    this._handlers = {
      "score:update": () => this.#handleScoreUpdate(),
    };

    for (const [event, handler] of Object.entries(this._handlers)) {
      this.eventBus.subscribe(event, handler);
    }

    this.draw();
  }

  #handleScoreUpdate() {
    this.draw();
  }

  destroy() {
    for (const [event, handler] of Object.entries(this._handlers)) {
      this.eventBus.unsubscribe(event, handler);
    }
  }

  draw() {
    const ranking = this.scoreManager.getRanking();

    if (this.scoreListElement) {
      this.scoreListElement.innerHTML = `
        <div class="score-head">
          <span>Team</span>
          <span>Wins</span>
          <span>Kills</span>
          <span>Deaths</span>
          <span>Ratio</span>
        </div>
        ${ranking.map((team, i) => `
          <div class="score-item rank-${i}">
            <span>${team.emoji} ${team.name}</span>
            <span>${team.score}</span>
            <span>${team.kills}</span>
            <span>${team.deaths}</span>
            <span>${team.ratio.toFixed(2)}</span>
          </div>
        `).join("")}`;
    }
  }
}
