export class MetaPanel {
  #state = {
    selectedTeam: null,
    credits: 0
  };

  constructor({ progressManager, eventBus, raceStats, upgrades }) {
    if (!raceStats) {
      throw new TypeError("raceStats is required");
    }
    if (!upgrades) {
      throw new TypeError("upgrades is required");
    }
    this.progressManager = progressManager;
    this.eventBus = eventBus;
    this.raceStats = raceStats;
    this.upgrades = upgrades;
    this.shopListElement = document.getElementById("shop-list");
    this.creditsElement = document.getElementById("credits");

    this._handlers = {
      "progress:update": (e) => this.#handleProgressUpdate(e),
      "game:match-start": (e) => this.#handleMatchStart(e)
    };

    for (const [event, handler] of Object.entries(this._handlers)) {
      this.eventBus.subscribe(event, handler);
    }

    this.#updateInternalState();
    this.draw();
  }

  #updateInternalState() {
    this.#state.selectedTeam = this.progressManager.selectedTeam;
    this.#state.credits = this.progressManager.credits;
  }

  #handleProgressUpdate({ credits }) {
    this.#state.credits = credits;
    this.draw();
  }

  #handleMatchStart() {
    this.#updateInternalState();
    this.draw();
  }

  destroy() {
    for (const [event, handler] of Object.entries(this._handlers)) {
      this.eventBus.unsubscribe(event, handler);
    }
  }

  draw() {
    const { selectedTeam, credits } = this.#state;
    if (!selectedTeam) return;

    if (this.creditsElement) {
      this.creditsElement.textContent = credits;
    }

    this.#renderShop(selectedTeam);
  }

  #renderShop(selected) {
    if (!this.shopListElement) return;

    this.shopListElement.innerHTML = "";

    const perRace = Object.entries(this.upgrades).filter(([, config]) => config.perRace);
    const globalUpgrades = Object.entries(this.upgrades).filter(([, config]) => !config.perRace);

    const raceHeader = document.createElement("div");
    raceHeader.className = "shop-section-title";
    raceHeader.textContent = `${this.raceStats[selected].emoji} ${selected}`;
    this.shopListElement.appendChild(raceHeader);

    perRace.forEach(([key, config]) => {
      this.#renderItem(this.shopListElement, key, config, selected);
    });

    const globalHeader = document.createElement("div");
    globalHeader.className = "shop-section-title";
    globalHeader.textContent = "Global";
    this.shopListElement.appendChild(globalHeader);

    globalUpgrades.forEach(([key, config]) => {
      this.#renderItem(this.shopListElement, key, config, null);
    });
  }

  #renderItem(container, key, config, team) {
    const level = this.progressManager.getUpgradeLevel(key, team);
    const cost = this.progressManager.getUpgradeCost(key, team);
    const canAfford = this.progressManager.credits >= cost;

    const item = document.createElement("div");
    item.className = "shop-item";
    item.innerHTML = `
      <span class="shop-emoji">${config.emoji}</span>
      <div class="shop-info">
        <span class="shop-name">${config.label}</span>
        <span class="shop-desc">${config.description} · Lv.${level}</span>
      </div>
      <button type="button" class="shop-btn" ${canAfford ? "" : "disabled"}>${cost} 💰</button>
    `;
     item.querySelector(".shop-btn").addEventListener("click", () => {
       this.progressManager.buyUpgrade(key, team);
     });
    container.appendChild(item);
  }
}
