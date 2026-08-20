import { CanvasAdapter } from "./canvas/index.js";
import { GAME_CONFIG } from "./config/gameConfig.js";
import { deepFreeze } from "./core/index.js";
import { Enemy, EntityManager, PowerUp, RACE_CLASSES } from "./entities/index.js";
import { InputHandler } from "./input/InputHandler.js";
import { ParticleSystem } from "./particles/index.js";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter.js";
import { InfoPanel, MenuController, MetaPanel, ScorePanel } from "./ui/index.js";
import { Game } from "./index.js";

document.addEventListener("DOMContentLoaded", () => {
  if (window.__NO_AUTOSTART__) return;

  // Anti-hack barrier: deep-freezes the prototypes of the
  // game classes to prevent runtime manipulation in the browser.
  for (const gameClass of [
    Game,
    EntityManager,
    ScorePanel,
    InfoPanel,
    MetaPanel,
    ParticleSystem,
    MenuController,
    PowerUp,
    Enemy,
    ...Object.values(RACE_CLASSES)
  ]) {
    if (gameClass && gameClass.prototype) deepFreeze(gameClass.prototype);
  }

  let game = null;
  let scorePanel = null;
  let infoPanel = null;
  let metaPanel = null;
  let animationFrameId = null;
  let inputHandler = null;

  const start = (config = {}) => {
    const { mode = "infinite-death", leagueLength = 50, startLevel = 0, team = null } = config;
    let level = +startLevel;
    if (level < 0 || level > 2000 || isNaN(level)) {
      level = 0;
    }

    if (game) {
      game.destroy();
      if (inputHandler && typeof inputHandler.destroy === "function") {
        inputHandler.destroy();
      }
      if (scorePanel && typeof scorePanel.destroy === "function") scorePanel.destroy();
      if (infoPanel && typeof infoPanel.destroy === "function") infoPanel.destroy();
      if (metaPanel && typeof metaPanel.destroy === "function") metaPanel.destroy();
    }
    cancelAnimationFrame(animationFrameId);

    inputHandler = new InputHandler();
    const storageAdapter = new LocalStorageAdapter();
    const canvasAdapter = new CanvasAdapter({
      canvasId: "canvas1",
      displayConfig: GAME_CONFIG.display
    });

    const instance = new Game({
      startLevel: level,
      mode,
      leagueLength,
      team,
      adapters: {
        inputHandler,
        storageAdapter,
        canvasAdapter
      }
    });
    game = instance;

    scorePanel = new ScorePanel({
      scoreManager: instance.scoreManager,
      eventBus: instance.eventBus
    });
    infoPanel = new InfoPanel({
      progressManager: instance.progressManager,
      eventBus: instance.eventBus
    });
    metaPanel = new MetaPanel({
      progressManager: instance.progressManager,
      eventBus: instance.eventBus,
      raceStats: instance.raceStats,
      upgrades: instance.upgrades
    });

    instance.start();

    instance.onLeagueEnd = payload => menu.showLeagueResult(payload);

    const animate = () => {
      if (instance.destroyed) return;
      instance.run();
      animationFrameId = instance.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  };

  const menu = new MenuController({
    getGame: () => game,
    onStart: start
  });

  start();

  if (!game.progressManager.isTeamChosen()) {
    menu.showPause(false);
  }

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (menu.isOpen()) {
        menu.close();
      } else {
        menu.showPause(!!game?.progressManager?.isTeamChosen());
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!game) return;
    if (document.hidden) {
      game.matchManager.paused = true;
    } else {
      // Avoid the giant deltaTime of the resumption (rAF stops in the
      // background and Date.now() would accumulate all that time).
      game.clock.reset();
      if (!menu.isOpen()) {
        game.matchManager.paused = false;
      }
    }
  });
});
