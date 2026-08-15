import { UPGRADES, RACE_STATS } from "../config/gameConfig.js";

export class MetaPanel {
  constructor({ progressManager, game }) {
    this.progressManager = progressManager;
    this.game = game;
    this.shopListElement = document.getElementById("shop-list");
    this.creditsElement = document.getElementById("credits");

    this.progressManager.eventBus.subscribe("credits-updated", () => this.render());
    this.render();
  }

  render() {
    const selected = this.progressManager.selectedTeam;
    this.creditsElement.textContent = this.progressManager.credits;
    this.#renderShop(selected);
  }

  #renderShop(selected) {
    this.shopListElement.innerHTML = "";

    const perRace = Object.entries(UPGRADES).filter(([, config]) => config.perRace);
    const globalUpgrades = Object.entries(UPGRADES).filter(([, config]) => !config.perRace);

    const raceHeader = document.createElement("div");
    raceHeader.className = "shop-section-title";
    raceHeader.textContent = `${RACE_STATS[selected].emoji} ${selected}`;
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
      this.render();
    });
    container.appendChild(item);
  }
}
