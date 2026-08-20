import { RACE_STATS } from "../config/gameConfig.js";

const LEVEL_MIN = 0;
const LEVEL_MAX = 2000;

const DEFAULT_GAME_MODES = {
  "infinite-death": { label: "Infinite Deathmatch", kind: "infinite", capture: false },
  "infinite-capture": { label: "Infinite Domination", kind: "infinite", capture: true },
  "league-death": { label: "Deathmatch League", kind: "league", isLeague: true, capture: false },
  "league-capture": { label: "Domination League", kind: "league", isLeague: true, capture: true },
  "level-death": { label: "Level Deathmatch", kind: "level", capture: false },
  "level-capture": { label: "Level Domination", kind: "level", capture: true }
};
const DEFAULT_LEAGUE_LENGTHS = [50, 100, 200];

const TEAM_STAT_BARS = [
  { label: "Health",       get: stats => stats.health.max },
  { label: "Damage",       get: stats => stats.damage.amount },
  { label: "Speed",        get: stats => stats.movement.maxSpeed },
  { label: "Acceleration", get: stats => stats.movement.acceleration },
  { label: "Turn",         get: stats => stats.movement.rotationSpeed }
];

export class MenuController {
  /**
   * @param {Object} options
   * @param {() => import("../index.js").Game | null} options.getGame
   * @param {(config: {mode: string, leagueLength: number, startLevel: number, team: string}) => void} options.onStart
   * @param {import("../config/gameConfig.js").RACE_STATS} [options.raceStats]
   */
  constructor({ getGame, onStart, raceStats = RACE_STATS }) {
    this.getGame = getGame;
    this.onStart = onStart;
    this.fallbackRaceStats = raceStats;
    this.overlayElement = document.getElementById("menu-overlay");
    this.titleElement   = document.getElementById("menu-title");
    this.bodyElement    = document.getElementById("menu-body");
    this.actionsElement = document.getElementById("menu-actions");
    this.levelInput          = null;
    this.pendingMode         = null;
    this.pendingLeagueLength = null;
    this.pendingTeam         = null;
    this.statMaxes = Object.fromEntries(
      TEAM_STAT_BARS.map(bar => [
        bar.label,
        Math.max(...Object.values(this.raceStats).map(s => bar.get(s)))
      ])
    );
  }

  get raceStats() {
    return this.#game()?.raceStats || this.fallbackRaceStats;
  }

  get gameModes() {
    return this.#game()?.gameModes || DEFAULT_GAME_MODES;
  }

  get leagueLengths() {
    return this.#game()?.leagueLengths || DEFAULT_LEAGUE_LENGTHS;
  }

  #game() {
    return this.getGame?.() ?? null;
  }

  #setPaused(paused) {
    const game = this.#game();
    if (game) game.matchManager.paused = paused;
  }

  #createElement(tag, className = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  #span(text, className = "") {
    const el = this.#createElement("span", className);
    el.textContent = text;
    return el;
  }

  #div(className = "", ...children) {
    const el = this.#createElement("div", className);
    for (const child of children) el.appendChild(child);
    return el;
  }

  #appendButton({ label, className = "", onClick, disabled = false }) {
    const btn = this.#createElement("button", `menu-btn ${className}`.trim());
    btn.type = "button";
    btn.textContent = label;
    if (disabled) btn.disabled = true;
    btn.addEventListener("click", onClick);
    this.actionsElement.appendChild(btn);
    return btn;
  }

  #render(title, bodyNode) {
    this.titleElement.textContent = title;
    this.bodyElement.innerHTML = "";
    if (bodyNode) this.bodyElement.appendChild(bodyNode);
    this.actionsElement.innerHTML = "";
    this.#open();
  }

  #open() {
    this.overlayElement.hidden = false;
    this.#setPaused(true);
  }

  isOpen() {
    return !this.overlayElement.hidden;
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.showPause(!!this.#game()?.progressManager?.isTeamChosen());
    }
  }

  close() {
    this.overlayElement.hidden = true;
    this.#setPaused(false);
  }

  #renderPauseHeader(game, pm) {
    const team = pm ? `${this.raceStats[pm.selectedTeam].emoji} ${pm.selectedTeam}` : "—";

    return this.#div("menu-summary",
      this.#span(`Match: ${game?.matchManager.match ?? 0}`),
      this.#span(`Team: ${team}`),
      this.#span(`Credits: ${pm?.credits ?? 0} 💰`)
    );
  }

  #appendExportButton(game) {
    this.#appendButton({
      label: "📥 Export Save",
      onClick: () => {
        if (game?.storageAdapter) {
          try {
            const base64 = game.storageAdapter.exportSave();
            const blob = new globalThis.Blob([base64], { type: "application/octet-stream" });
            const url = globalThis.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "idle-rps-save.dat";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            globalThis.URL.revokeObjectURL(url);
          } catch {
            if (typeof globalThis.alert === "function") {
              globalThis.alert("Export failed: The saved progress is corrupted or has been modified without authorization.");
            }
          }
        }
      }
    });
  }

  #appendImportButton(game) {
    this.#appendButton({
      label: "📤 Import Save",
      onClick: () => {
        if (!game?.storageAdapter) return;

        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".dat";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new globalThis.FileReader();
          reader.onload = (evt) => {
            const content = evt.target.result;
            try {
              game.storageAdapter.importSave(content);
              if (typeof window !== "undefined" && window.location && typeof window.location.reload === "function") {
                window.location.reload();
              }
            } catch {
              if (typeof globalThis.alert === "function") {
                globalThis.alert("Import failed: The save file is corrupted or has been tampered with.");
              }
            }
          };
          reader.readAsText(file);
        };
        input.click();
      }
    });
  }

  showPause(canResume) {
    const game = this.#game();
    const pm   = game?.progressManager;
    const leagueOver    = game?.mode?.isLeague && game.matchManager.match > game.leagueLength;
    const canResumeReal = !!canResume && !leagueOver;

    const body = this.#renderPauseHeader(game, pm);

    this.#render("⏸️ Pause", body);
    if (canResumeReal) this.#appendButton({ label: "Continue", className: "primary", onClick: () => this.close() });
    this.#appendButton({ label: "New game", onClick: () => this.#startNewGame() });

    this.#appendExportButton(game);
    this.#appendImportButton(game);
  }

  /**
   * @param {{ranking: Array<{name: string, emoji: string, score: number, kills: number, deaths: number}>, playerTeam: string, modeKey: string, leagueLength: number}} payload
   */
  showLeagueResult({ ranking, playerTeam, modeKey, leagueLength }) {
    const winner   = ranking[0];
    const won      = winner?.name === playerTeam;
    const position = ranking.findIndex(t => t.name === playerTeam) + 1;
    const config   = this.gameModes[modeKey] ?? {};

    const titleText = won ? "🏆 You won the league!" : `🏆 ${winner?.emoji} ${winner?.name} won`;
    const header = this.#div("league-result-head",
      this.#div("league-result-title", this.#span(titleText)),
      this.#div("menu-hint", this.#span(`${config.label ?? modeKey} · ${leagueLength} matches`))
    );

    const scoreHead = this.#div("score-head",
      this.#span("#"), this.#span("Team"), this.#span("Wins"), this.#span("Kills"), this.#span("Deaths")
    );
    const scoreRows = ranking.map((t, i) => this.#div(
      `score-item rank-${i}${t.name === playerTeam ? " player" : ""}`,
      this.#span(i === 0 ? "🏆" : String(i + 1)),
      this.#span(`${t.emoji} ${t.name}`),
      this.#span(String(t.score)),
      this.#span(String(t.kills)),
      this.#span(String(t.deaths))
    ));
    const grid = this.#div("", scoreHead, ...scoreRows);

    const footerText = won
      ? "Your team took the league. 🎉"
      : `Your team (${this.raceStats[playerTeam].emoji} ${playerTeam}) finished in position ${position}.`;

    const body = this.#div("", header, grid, this.#div("menu-hint", this.#span(footerText)));
    this.#render("📊 League results", body);
    this.#appendButton({ label: "Play again", className: "primary", onClick: () => this.#startNewGame() });
    this.#appendButton({ label: "Menu", onClick: () => this.showPause(false) });
  }

  #startNewGame() {
    const game = this.#game();
    if (game?.progressManager) game.progressManager.reset();
    this.#showMode();
  }

  #navigateFromMode(config) {
    if (!config) return;

    if (config.kind === "league") {
      this.#showLeagueLength();
    } else if (config.kind === "level") {
      this.#showLevel();
    } else {
      this.#showTeam();
    }
  }

  #createModeButtons(grid, description, nextBtn) {
    for (const [key, config] of Object.entries(this.gameModes)) {
      const btn = this.#createElement("button", "team-btn");
      btn.type = "button";
      btn.dataset.mode = key;
      btn.appendChild(this.#span(config.capture ? "🫳" : "☠️", "team-emoji"));
      btn.appendChild(document.createTextNode(config.label));
      btn.addEventListener("click", () => {
        this.pendingMode = key;
        grid.querySelectorAll(".team-btn").forEach(b => b.classList.toggle("selected", b === btn));
        this.#renderModeInfo(description, config);
        nextBtn.disabled = false;
      });
      grid.appendChild(btn);
    }
  }

  #showMode() {
    this.pendingMode = null;
    const description = this.#createElement("div", "team-details");
    const grid        = this.#createElement("div", "mode-pick-grid");

    this.#renderModeInfo(description, this.gameModes["infinite-death"]);

    const body = this.#div("mode-pick-body", grid, description);
    this.#render("🎮 Game mode", body);

    const nextBtn = this.#appendButton({
      label: "Next", className: "primary", disabled: true,
      onClick: () => {
        const config = this.gameModes[this.pendingMode];
        this.#navigateFromMode(config);
      }
    });

    this.#createModeButtons(grid, description, nextBtn);
  }

  #showLeagueLength() {
    this.pendingLeagueLength = null;
    const grid = this.#createElement("div", "league-pick-grid");
    const hint = this.#createElement("div", "menu-hint");
    hint.textContent = "The league is won by whoever ranks first when the matches end.";

    const body = this.#div("league-pick-body", grid, hint);
    this.#render("🎯 League length", body);
    this.#appendButton({ label: "Back", onClick: () => this.#showMode() });

    const nextBtn = this.#appendButton({
      label: "Next", className: "primary", disabled: true,
      onClick: () => this.#showTeam()
    });

    for (const length of this.leagueLengths) {
      const btn = this.#createElement("button", "team-btn");
      btn.type = "button";
      btn.textContent = `${length} matches`;
      btn.addEventListener("click", () => {
        this.pendingLeagueLength = length;
        grid.querySelectorAll(".team-btn").forEach(b => b.classList.toggle("selected", b === btn));
        nextBtn.disabled = false;
      });
      grid.appendChild(btn);
    }
  }

  #showLevel() {
    this.levelInput           = this.#createElement("input", "level-input");
    this.levelInput.type      = "number";
    this.levelInput.id        = "level-pick";
    this.levelInput.min       = LEVEL_MIN;
    this.levelInput.max       = LEVEL_MAX;
    this.levelInput.value     = 0;
    this.levelInput.addEventListener("keydown", e => { if (e.key === "Enter") this.#showTeam(); });

    const label       = this.#createElement("label");
    label.htmlFor     = "level-pick";
    label.textContent = "Level";

    const hint        = this.#createElement("div", "menu-hint");
    hint.textContent  = `Match starting level (${LEVEL_MIN}–${LEVEL_MAX})`;

    const body = this.#div("",
      this.#div("level-select-menu", label, this.levelInput),
      hint
    );
    this.#render("🎚️ Starting level", body);
    this.#appendButton({ label: "Back", onClick: () => this.#showMode() });
    this.#appendButton({ label: "Next", className: "primary", onClick: () => this.#showTeam() });
  }

  #navigateBackFromTeam() {
    const config = this.gameModes[this.pendingMode];

    if (config?.kind === "league") {
      this.#showLeagueLength();
    } else if (config?.kind === "level") {
      this.#showLevel();
    } else {
      this.#showMode();
    }
  }

  #createTeamButtons(grid, details, chooseBtn, teams) {
    for (const [team, stats] of teams) {
      const btn = this.#createElement("button", "team-btn");
      btn.type = "button";
      btn.dataset.team = team;
      btn.appendChild(this.#span(stats.emoji, "team-emoji"));
      btn.appendChild(document.createTextNode(team));
      btn.addEventListener("mouseenter", () => this.#renderTeamInfo(details, team));
      btn.addEventListener("focus",      () => this.#renderTeamInfo(details, team));
      btn.addEventListener("click", () => {
        this.pendingTeam = team;
        grid.querySelectorAll(".team-btn").forEach(b => b.classList.toggle("selected", b === btn));
        this.#renderTeamInfo(details, team);
        chooseBtn.disabled = false;
      });
      grid.appendChild(btn);
    }
  }

  #showTeam() {
    this.pendingTeam  = null;
    const details     = this.#createElement("div", "team-details");
    const grid        = this.#createElement("div", "team-pick-grid");
    const teams       = Object.entries(this.raceStats);

    this.#renderTeamInfo(details, teams[0][0]);

    const body = this.#div("team-pick-wrap", grid, details);
    this.#render("👥 Choose your team", body);

    this.#appendButton({ label: "Back", onClick: () => this.#navigateBackFromTeam() });

    const chooseBtn = this.#appendButton({
      label: "Choose", className: "primary", disabled: true,
      onClick: () => {
        const game = this.#game();

        if (this.pendingTeam && game?.progressManager?.selectTeam(this.pendingTeam)) {
          this.#start();
        }
      }
    });

    this.#createTeamButtons(grid, details, chooseBtn, teams);
  }

  #renderModeInfo(container, config) {
    container.innerHTML = "";

    const strong = this.#createElement("strong");
    strong.textContent = config.label;
    container.appendChild(this.#div("team-details-head",
      this.#span(config.capture ? "🫳" : "☠️", "team-emoji"),
      strong
    ));

    const durationText = config.isLeague
      ? "league with a fixed number of matches"
      : config.kind === "level"
        ? `selectable starting level (0–${LEVEL_MAX})`
        : "no limit";

    container.appendChild(this.#buildDetailRow("System:",
      config.capture
        ? "Capture — the defeated join the winner"
        : "Death — the defeated are eliminated"
    ));
    container.appendChild(this.#buildDetailRow("Duration:", durationText));
  }

  #renderTeamInfo(container, team) {
    const stats = this.raceStats[team];
    if (!stats) return;
    container.innerHTML = "";

    const predators = Object.keys(this.raceStats).filter(t => this.raceStats[t].aim.includes(team));
    const withEmoji = t => `${this.raceStats[t].emoji} ${t}`;

    const strong = this.#createElement("strong");
    strong.textContent = team;
    const headChildren = [this.#span(stats.emoji, "team-emoji"), strong];
    if (stats.description) headChildren.push(this.#span(stats.description, "team-details-desc"));
    container.appendChild(this.#div("team-details-head", ...headChildren));

    const barBox = this.#createElement("div", "stat-bar-box");
    for (const bar of TEAM_STAT_BARS) {
      const percent = Math.round((bar.get(stats) / this.statMaxes[bar.label]) * 100);
      const fill    = this.#createElement("span", "stat-bar-fill");
      fill.style.width      = `${percent}%`;
      fill.style.background = stats.color;
      const track   = this.#createElement("span", "stat-bar-track");
      track.appendChild(fill);
      barBox.appendChild(this.#div("stat-bar-row",
        this.#span(bar.label, "stat-bar-label"),
        track
      ));
    }
    container.appendChild(barBox);

    container.appendChild(this.#buildDetailRow("Beats:",    stats.aim.map(withEmoji).join(" · ")));
    container.appendChild(this.#buildDetailRow("Loses to:", predators.map(withEmoji).join(" · ") || "—"));
  }

  #buildDetailRow(labelText, valueText) {
    return this.#div("team-details-row",
      this.#span(labelText, "team-details-label"),
      this.#span(valueText)
    );
  }

  #start() {
    const config = this.gameModes[this.pendingMode] ?? this.gameModes["infinite-death"];
    let level    = +(this.levelInput?.value ?? 0);
    if (level < LEVEL_MIN || level > LEVEL_MAX || isNaN(level)) level = 0;
    this.onStart({
      mode:         this.pendingMode,
      leagueLength: this.pendingLeagueLength ?? 50,
      startLevel:   config.kind === "level" ? level : 0,
      team:         this.pendingTeam
    });
    this.close();
  }
}
