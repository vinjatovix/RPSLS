export class ScorePanel {
  constructor() {
    this.scoreListElement = document.getElementById("score-list");
    this.roundInfoElement = document.getElementById("round-info");
  }

  update(scoreManager, match, timeLeft, mechanics, lastWin, credits, started = true, mode = null, leagueLength = null) {
    const ranking = scoreManager.getRanking();
    this.scoreListElement.innerHTML = `
      <div class="score-head">
        <span>Team</span>
        <span>Wins</span>
        <span>Kills</span>
        <span>Deaths</span>
        <span>Ratio</span>
      </div>
      ${ranking
        .map(
          (team, i) => `
        <div class="score-item rank-${i}">
          <span>${team.emoji}</span>
          <span>${team.score}</span>
          <span>${team.kills}</span>
          <span>${team.deaths}</span>
          <span>${team.ratio.toFixed(2)}</span>
        </div>`
        )
        .join("")}`;

    this.roundInfoElement.innerHTML = !started
      ? `<p class="timer-active"><strong>👆 Choose your team to start</strong></p>`
      : `
      <p><strong>Match:</strong> ${match}${mode?.isLeague && leagueLength ? `/${leagueLength}` : ""}</p>
      ${lastWin ? `<p><strong>Last:</strong> ${lastWin} won</p>` : ""}
      <p><strong>Credits:</strong> ${credits} 💰</p>
      ${
        !mechanics.timeless
          ? `<p class="timer-active"><strong>Time:</strong> ${Math.round(timeLeft / 1000)}s</p>`
          : ""
      }`;
  }
}
