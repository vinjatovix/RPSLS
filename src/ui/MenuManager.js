/**
 * MenuManager - Menú de pausa y wizard de nueva partida
 * Pasos: pausa → elige equipo → elige nivel → jugar
 * - "Nueva partida" hace un reset total del progreso
 * - Controla la pausa del Game (game.paused) mientras el menú está abierto
 */

import { RACE_STATS } from "../config/gameConfig.js";

const LEVEL_MIN = 0;
const LEVEL_MAX = 2000;

export class MenuManager {
  /**
   * @param {Object} options
   * @param {() => import("../index.js").Game | null} options.getGame - Devuelve el Game actual
   * @param {(level: number) => void} options.onStart - Lanza una partida nueva con el nivel dado
   */
  constructor({ getGame, onStart }) {
    this.getGame = getGame;
    this.onStart = onStart;
    this.overlayEl = document.getElementById("menu-overlay");
    this.titleEl = document.getElementById("menu-title");
    this.bodyEl = document.getElementById("menu-body");
    this.actionsEl = document.getElementById("menu-actions");
    this.levelInput = null;
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

    const summary = this.#el("div", "menu-summary");
    summary.appendChild(this.#span(`Match: ${game?.match ?? 0}`));
    summary.appendChild(this.#span(`Equipo: ${team}`));
    summary.appendChild(this.#span(`Créditos: ${pm?.credits ?? 0} 💰`));

    const buttons = [];
    if (canResume) {
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
    this.#showTeam();
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
      {
        label: "Elegir",
        className: "primary js-elegir",
        disabled: true,
        onClick: () => {
          if (this.pendingTeam && this.#game()?.progressManager?.selectTeam(this.pendingTeam)) {
            this.#showLevel();
          }
        }
      },
      { label: "Atrás", onClick: () => this.close() }
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
    const m = stats.movement;

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
      </div>
      <div class="team-details-row">
        <span class="team-details-label">Stats:</span>
        <span>Vida ${stats.health.max} · Daño ${stats.damage.amount} · Vel ${m.maxSpeed} · Giro ${m.rotationSpeed}</span>
      </div>`;
  }

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
      if (e.key === "Enter") this.#start();
    });
    wrap.appendChild(label);
    wrap.appendChild(this.levelInput);

    const hint = this.#el("div", "menu-hint");
    hint.textContent = `Nivel inicial del match (0–${LEVEL_MAX})`;

    const body = this.#el("div");
    body.appendChild(wrap);
    body.appendChild(hint);

    this.#render("🎚️ Elige nivel", body, [
      { label: "Atrás", onClick: () => this.#showTeam() },
      { label: "Jugar", className: "primary", onClick: () => this.#start() }
    ]);
  }

  #start() {
    let level = +(this.levelInput?.value ?? 0);
    if (level < LEVEL_MIN || level > LEVEL_MAX || isNaN(level)) {
      level = 0;
    }
    this.onStart(level);
    this.close();
  }
}
