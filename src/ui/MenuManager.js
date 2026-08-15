/**
 * MenuManager - Menú de pausa, wizard de nueva partida y resultado de liga
 * Pasos: pausa → modo → (longitud | nivel inicial) → equipo → jugar
 * - "Nueva partida" hace un reset total del progreso
 * - Controla la pausa del Game (game.paused) mientras el menú está abierto
 */

import { GAME_MODES, LEAGUE_LENGTHS, RACE_STATS } from "../config/gameConfig.js";

const LEVEL_MIN = 0;
const LEVEL_MAX = 2000;

export class MenuManager {
  /**
   * @param {Object} options
   * @param {() => import("../index.js").Game | null} options.getGame - Devuelve el Game actual
   * @param {(config: {mode: string, leagueLength: number, startLevel: number, team: string}) => void} options.onStart - Lanza una partida nueva
   */
  constructor({ getGame, onStart }) {
    this.getGame = getGame;
    this.onStart = onStart;
    this.overlayEl = document.getElementById("menu-overlay");
    this.titleEl = document.getElementById("menu-title");
    this.bodyEl = document.getElementById("menu-body");
    this.actionsEl = document.getElementById("menu-actions");
    this.levelInput = null;
    this.pendingMode = null;
    this.pendingLeagueLength = null;
    this.pendingTeam = null;
  }

  #game() {
    return this.getGame?.() ?? null;
  }

  #setPaused(paused) {
    const game = this.#game();
    if (game) game.paused = paused;
  }

  isOpen() {
    return !this.overlayEl.hidden;
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.showPause(!!this.#game()?.progressManager?.isTeamChosen());
    }
  }

  close() {
    this.overlayEl.hidden = true;
    this.#setPaused(false);
  }

  #open() {
    this.overlayEl.hidden = false;
    this.#setPaused(true);
  }

  #el(tag, className = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  #span(text) {
    const el = this.#el("span");
    el.textContent = text;
    return el;
  }

  #makeButton({ label, className = "", onClick, disabled = false }) {
    const btn = this.#el("button", `menu-btn ${className}`.trim());
    btn.type = "button";
    btn.textContent = label;
    if (disabled) btn.disabled = true;
    btn.addEventListener("click", onClick);
    return btn;
  }

  #render(title, bodyNode, buttons) {
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = "";
    if (bodyNode) {
      this.bodyEl.appendChild(bodyNode);
    }
    this.actionsEl.innerHTML = "";
    for (const btn of buttons) {
      this.actionsEl.appendChild(this.#makeButton(btn));
    }
    this.#open();
  }

  showPause(canResume) {
    const game = this.#game();
    const pm = game?.progressManager;
    const team = pm ? `${RACE_STATS[pm.selectedTeam].emoji} ${pm.selectedTeam}` : "—";

    const leagueOver = game?.mode?.isLeague && game.match > game.leagueLength;
    const canResumeReal = !!canResume && !leagueOver;

    const summary = this.#el("div", "menu-summary");
    summary.appendChild(this.#span(`Match: ${game?.match ?? 0}`));
    summary.appendChild(this.#span(`Equipo: ${team}`));
    summary.appendChild(this.#span(`Créditos: ${pm?.credits ?? 0} 💰`));

    const buttons = [];
    if (canResumeReal) {
      buttons.push({ label: "Continuar", className: "primary", onClick: () => this.close() });
    }
    buttons.push({ label: "Nueva partida", onClick: () => this.#handleNewGame() });

    this.#render("⏸️ Pausa", summary, buttons);
  }

  #handleNewGame() {
    const game = this.#game();
    if (game?.progressManager) {
      game.progressManager.reset();
    }
    this.#showMode();
  }

  /**
   * Paso 1: elegir modo de juego
   */
  #showMode() {
    this.pendingMode = null;
    const grid = this.#el("div", "mode-pick-grid");
    const desc = this.#el("div", "team-details");

    for (const [key, cfg] of Object.entries(GAME_MODES)) {
      const btn = this.#el("button", "team-btn");
      btn.type = "button";
      btn.dataset.mode = key;
      btn.innerHTML = `<span class="team-emoji">${cfg.capture ? "🫳" : "☠️"}</span>${cfg.label}`;
      btn.addEventListener("click", () => {
        this.pendingMode = key;
        grid.querySelectorAll(".team-btn").forEach(b => b.classList.toggle("selected", b === btn));
        this.#renderModeInfo(desc, cfg);
        if (this.siguienteBtn) this.siguienteBtn.disabled = false;
      });
      grid.appendChild(btn);
    }

    const body = this.#el("div", "mode-pick-body");
    body.appendChild(grid);
    body.appendChild(desc);
    this.#renderModeInfo(desc, GAME_MODES["infinito-muerte"]);

    this.#render("🎮 Modo de juego", body, [
      {
        label: "Siguiente",
        className: "primary js-siguiente",
        disabled: true,
        onClick: () => {
          const cfg = GAME_MODES[this.pendingMode];
          if (!cfg) return;
          if (cfg.kind === "league") {
            this.#showLeagueLength();
          } else if (cfg.kind === "level") {
            this.#showLevel();
          } else {
            this.#showTeam();
          }
        }
      }
    ]);

    this.siguienteBtn = this.actionsEl.querySelector(".js-siguiente");
  }

  #renderModeInfo(container, cfg) {
    container.innerHTML = `
      <div class="team-details-head">
        <span class="team-emoji">${cfg.capture ? "🫳" : "☠️"}</span>
        <strong>${cfg.label}</strong>
      </div>
      <div class="team-details-row">
        <span class="team-details-label">Sistema:</span>
        <span>${cfg.capture ? "Captura — los derrotados se unen al vencedor" : "Muerte — los derrotados se eliminan"}</span>
      </div>
      <div class="team-details-row">
        <span class="team-details-label">Duración:</span>
        <span>${
          cfg.isLeague
            ? "liga con un número fijo de matches"
            : cfg.kind === "level"
              ? "nivel inicial elegible (0–" + LEVEL_MAX + ")"
              : "sin límite"
        }</span>
      </div>`;
  }

  /**
   * Paso 2 (solo ligas): elegir longitud
   */
  #showLeagueLength() {
    this.pendingLeagueLength = null;
    const grid = this.#el("div", "league-pick-grid");
    const hint = this.#el("div", "menu-hint");
    hint.textContent = "Gana la liga quien quede primero en el ranking al terminar los matches.";

    for (const len of LEAGUE_LENGTHS) {
      const btn = this.#el("button", "team-btn");
      btn.type = "button";
      btn.textContent = `${len} matches`;
      btn.addEventListener("click", () => {
        this.pendingLeagueLength = len;
        grid.querySelectorAll(".team-btn").forEach(b => b.classList.toggle("selected", b === btn));
        if (this.siguienteBtn) this.siguienteBtn.disabled = false;
      });
      grid.appendChild(btn);
    }

    const body = this.#el("div", "league-pick-body");
    body.appendChild(grid);
    body.appendChild(hint);

    this.#render("🎯 Longitud de la liga", body, [
      { label: "Atrás", onClick: () => this.#showMode() },
      {
        label: "Siguiente",
        className: "primary js-siguiente",
        disabled: true,
        onClick: () => this.#showTeam()
      }
    ]);

    this.siguienteBtn = this.actionsEl.querySelector(".js-siguiente");
  }

  /**
   * Paso 2 (solo modos nivel): nivel inicial
   */
  #showLevel() {
    const wrap = this.#el("div", "level-select-menu");
    const label = this.#el("label");
    label.htmlFor = "level-pick";
    label.textContent = "Nivel";
    this.levelInput = this.#el("input", "level-input");
    this.levelInput.type = "number";
    this.levelInput.id = "level-pick";
    this.levelInput.min = LEVEL_MIN;
    this.levelInput.max = LEVEL_MAX;
    this.levelInput.value = 0;
    this.levelInput.addEventListener("keydown", e => {
      if (e.key === "Enter") this.#showTeam();
    });
    wrap.appendChild(label);
    wrap.appendChild(this.levelInput);

    const hint = this.#el("div", "menu-hint");
    hint.textContent = `Nivel inicial del match (${LEVEL_MIN}–${LEVEL_MAX})`;

    const body = this.#el("div");
    body.appendChild(wrap);
    body.appendChild(hint);

    this.#render("🎚️ Nivel inicial", body, [
      { label: "Atrás", onClick: () => this.#showMode() },
      { label: "Siguiente", className: "primary", onClick: () => this.#showTeam() }
    ]);
  }

  #showTeam() {
    this.pendingTeam = null;
    const wrap = this.#el("div", "team-pick-wrap");
    const grid = this.#el("div", "team-pick-grid");
    const details = this.#el("div", "team-details");

    const teams = Object.entries(RACE_STATS);
    for (const [team, stats] of teams) {
      const btn = this.#el("button", "team-btn");
      btn.type = "button";
      btn.dataset.team = team;
      btn.innerHTML = `<span class="team-emoji">${stats.emoji}</span>${team}`;
      btn.addEventListener("mouseenter", () => this.#renderTeamInfo(details, team));
      btn.addEventListener("focus", () => this.#renderTeamInfo(details, team));
      btn.addEventListener("click", () => {
        this.pendingTeam = team;
        grid.querySelectorAll(".team-btn").forEach(b => b.classList.toggle("selected", b === btn));
        this.#renderTeamInfo(details, team);
        if (this.elegirBtn) this.elegirBtn.disabled = false;
      });
      grid.appendChild(btn);
    }

    wrap.appendChild(grid);
    wrap.appendChild(details);
    this.#renderTeamInfo(details, teams[0][0]);

    this.#render("👥 Elige tu equipo", wrap, [
      { label: "Atrás", onClick: () => this.#showMode() },
      {
        label: "Elegir",
        className: "primary js-elegir",
        disabled: true,
        onClick: () => {
          if (this.pendingTeam && this.#game()?.progressManager?.selectTeam(this.pendingTeam)) {
            this.#start();
          }
        }
      }
    ]);

    this.elegirBtn = this.actionsEl.querySelector(".js-elegir");
  }

  /**
   * Ficha de una raza: descripción, ventajas (a quién gana),
   * desventajas (quién le gana) y stats. Los depredadores se
   * calculan recorriendo RACE_STATS para no duplicar datos.
   */
  #renderTeamInfo(container, team) {
    const stats = RACE_STATS[team];
    if (!stats) return;
    const predators = Object.keys(RACE_STATS).filter(t => RACE_STATS[t].aim.includes(team));
    const withEmoji = t => `${RACE_STATS[t].emoji} ${t}`;

    container.innerHTML = `
      <div class="team-details-head">
        <span class="team-emoji">${stats.emoji}</span>
        <strong>${team}</strong>
        ${stats.description ? `<span class="team-details-desc">${stats.description}</span>` : ""}
      </div>
      <div class="team-details-row">
        <span class="team-details-label">Gana a:</span>
        <span>${stats.aim.map(withEmoji).join(" · ")}</span>
      </div>
      <div class="team-details-row">
        <span class="team-details-label">Le ganan:</span>
        <span>${predators.map(withEmoji).join(" · ") || "—"}</span>
      </div>`;
  }

  #start() {
    const cfg = GAME_MODES[this.pendingMode] ?? GAME_MODES["infinito-muerte"];
    let level = +(this.levelInput?.value ?? 0);
    if (level < LEVEL_MIN || level > LEVEL_MAX || isNaN(level)) {
      level = 0;
    }
    this.onStart({
      mode: this.pendingMode,
      leagueLength: this.pendingLeagueLength ?? 50,
      startLevel: cfg.kind === "level" ? level : 0,
      team: this.pendingTeam
    });
    this.close();
  }

  /**
   * Resultado de una liga terminada
   * @param {{ranking: Array<{name: string, emoji: string, score: number, kills: number, deaths: number}>, playerTeam: string, modeKey: string, leagueLength: number}} payload
   */
  showLeagueResult({ ranking, playerTeam, modeKey, leagueLength }) {
    const winner = ranking[0];
    const won = winner?.name === playerTeam;
    const pos = ranking.findIndex(t => t.name === playerTeam) + 1;
    const cfg = GAME_MODES[modeKey] ?? {};

    const head = this.#el("div", "league-result-head");
    head.innerHTML = `
      <div class="league-result-title">${won ? "🏆 ¡Ganaste la liga!" : `🏆 Ha ganado ${winner?.emoji} ${winner?.name}`}</div>
      <div class="menu-hint">${cfg.label ?? modeKey} · ${leagueLength} matches</div>`;

    const grid = this.#el("div");
    grid.innerHTML = `
      <div class="score-head">
        <span>#</span><span>Team</span><span>Wins</span><span>Kills</span><span>Deaths</span>
      </div>
      ${ranking
        .map(
          (t, i) => `
        <div class="score-item rank-${i}${t.name === playerTeam ? " player" : ""}">
          <span>${i === 0 ? "🏆" : i + 1}</span>
          <span>${t.emoji} ${t.name}</span>
          <span>${t.score}</span>
          <span>${t.kills}</span>
          <span>${t.deaths}</span>
        </div>`
        )
        .join("")}`;

    const footer = this.#el("div", "menu-hint");
    footer.textContent = won
      ? "Tu equipo se llevó la liga. 🎉"
      : `Tu equipo (${RACE_STATS[playerTeam].emoji} ${playerTeam}) quedó en la posición ${pos}.`;

    const body = this.#el("div");
    body.appendChild(head);
    body.appendChild(grid);
    body.appendChild(footer);

    this.#render("📊 Resultado de la liga", body, [
      { label: "Jugar de nuevo", className: "primary", onClick: () => this.#handleNewGame() },
      { label: "Menú", onClick: () => this.showPause(false) }
    ]);
  }
}
