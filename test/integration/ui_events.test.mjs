import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import test from 'node:test';

import { RACE_STATS, UPGRADES } from '../../src/config/gameConfig.js';
import { EventBus } from '../../src/core/index.js';
import { InfoPanel, MenuController, MetaPanel, ScorePanel } from '../../src/ui/index.js';

function createTestEnvironment() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="score-list"></div>
    <div id="round-info"></div>
    <div id="credits"></div>
    <div id="shop-list"></div>
  </body></html>`);
  
  const { window } = dom;
  global.document = window.document;
  global.window = window;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  
  return { dom, window };
}

function createMenuTestEnvironment() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="score-list"></div>
    <div id="round-info"></div>
    <div id="credits"></div>
    <div id="shop-list"></div>
    <div id="menu-overlay" hidden></div>
    <div id="menu-title"></div>
    <div id="menu-body"></div>
    <div id="menu-actions"></div>
  </body></html>`);
  
  const { window } = dom;
  global.document = window.document;
  global.window = window;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  
  return { dom, window };
}

function setupUIContext(customProgress = {}, customScoreManagerRanking = []) {
  createTestEnvironment();
  const eventBus = new EventBus();
  
  const mockProgress = { 
    credits: 0, 
    selectedTeam: 'rocks',
    getPowerupLuck: () => 1,
    getUpgradeLevel: () => 0,
    getUpgradeCost: () => 0,
    eventBus,
    ...customProgress
  };
  
  const getRanking = typeof customScoreManagerRanking === 'function' 
    ? customScoreManagerRanking 
    : () => customScoreManagerRanking;

  const scoreManagerMock = {
    eventBus,
    getRanking
  };
  
  return { eventBus, mockProgress, scoreManagerMock };
}

test('UI Event-Driven Architecture', async (t) => {
  await t.test('InfoPanel reacts to game:match-start event', async () => {
    const { eventBus, mockProgress, scoreManagerMock } = setupUIContext();
    new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 5, mode: { isLeague: false } });
  
    assert.ok(document.body.textContent.includes('Match: 5'), 'Round info should reflect match 5');
  });

  await t.test('InfoPanel shows last winner after game:match-end', async () => {
    const { eventBus, mockProgress, scoreManagerMock } = setupUIContext();
    new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 5, mode: { isLeague: false } });
    eventBus.emit('game:match-end', { winners: 'rocks', leagueLength: 0, modeKey: 'deathmatch' });
    eventBus.emit('game:match-start', { matchNumber: 6, mode: { isLeague: false } });
  
    assert.ok(document.body.textContent.includes('Match: 6'), 'Should show current match number');
    assert.ok(document.body.textContent.includes('Last winner: rocks'), 'Should show the last winner');
  });

  await t.test('MetaPanel reacts to progress:update event', async () => {
    const { eventBus, mockProgress } = setupUIContext();
    new MetaPanel({ progressManager: mockProgress, eventBus, raceStats: RACE_STATS, upgrades: UPGRADES });
  
    mockProgress.credits = 100;
    eventBus.emit('progress:update', { credits: 100 });
  
    const creditsElem = document.getElementById('credits');
    assert.strictEqual(creditsElem.textContent, '100', 'Credits element should show 100');
  });

  await t.test('ScorePanel displays team name and ranking data', async () => {
    const { eventBus, scoreManagerMock } = setupUIContext({}, [
      { emoji: '\u{1FAA8}', score: 10, kills: 5, deaths: 2, ratio: 2.5, name: 'rocks' },
      { emoji: '\u{1F4C4}', score: 5, kills: 2, deaths: 3, ratio: 0.66, name: 'papers' }
    ]);
    const panel = new ScorePanel({ 
      scoreManager: scoreManagerMock, 
      eventBus 
    });
  
    panel.draw();
  
    assert.ok(document.body.textContent.includes('\u{1FAA8} rocks'), 'Should show rocks with emoji and name');
    assert.ok(document.body.textContent.includes('\u{1F4C4} papers'), 'Should show papers with emoji and name');
    assert.ok(document.body.textContent.includes('2.50'), 'Should show ratio formatted');
  });

  await t.test('InfoPanel cleans up subscriptions on destroy', async () => {
    const { eventBus, mockProgress, scoreManagerMock } = setupUIContext();
    const panel = new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 5, mode: { isLeague: false } });
    
    assert.ok(document.body.textContent.includes('Match: 5'), 'Should reflect match 5 initially');
  
    panel.destroy();
  
    eventBus.emit('game:match-start', { matchNumber: 10, mode: { isLeague: false } });
    assert.ok(!document.body.textContent.includes('Match: 10'), 'Should NOT reflect match 10 after destroy');
  });

  await t.test('ScorePanel reacts to score:update event', async () => {
    let callCount = 0;
    const { eventBus, scoreManagerMock } = setupUIContext({}, () => {
      callCount++;

      return [
        { emoji: '\u{1FAA8}', score: 10, kills: 5, deaths: 2, ratio: 2.5, name: 'rocks' }
      ];
    });
    new ScorePanel({ 
      scoreManager: scoreManagerMock, 
      eventBus 
    });
  
    const before = callCount;
    eventBus.emit('score:update');
  
    assert.ok(callCount > before, 'ScorePanel should call getRanking after score:update event');
    assert.ok(document.body.textContent.includes('\u{1FAA8} rocks'), 'Should render ranking data');
  });

  await t.test('InfoPanel reacts to tick event', async () => {
    const { eventBus, mockProgress, scoreManagerMock } = setupUIContext();
    new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 1, mode: { isLeague: false }, timeLeft: 30000 });
    eventBus.emit('tick', { timeLeft: 25000 });
  
    assert.ok(document.body.textContent.includes('25s'), 'Should show updated time after tick');
  });

  await t.test('InfoPanel reacts to game:mechanics-change event', async () => {
    const { eventBus, mockProgress, scoreManagerMock } = setupUIContext();
    new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 1, mode: { isLeague: false }, timeLeft: 30000, timeless: true });
    assert.ok(!document.body.textContent.includes('Time:'), 'Should NOT show time when timeless');
  
    eventBus.emit('game:mechanics-change', { timeless: false });
    assert.ok(document.body.textContent.includes('Time:'), 'Should show time after mechanics-change to non-timeless');
  });

  await t.test('InfoPanel reacts to progress:update event', async () => {
    const { eventBus, mockProgress, scoreManagerMock } = setupUIContext();
    new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 1, mode: { isLeague: false } });
  
    mockProgress.credits = 42;
    eventBus.emit('progress:update', { credits: 42 });
  
    assert.ok(document.body.textContent.includes('42'), 'Should show updated credits after progress:update');
  });

  await t.test('ScorePanel cleans up subscriptions on destroy', async () => {
    let callCount = 0;
    const { eventBus, scoreManagerMock } = setupUIContext({}, () => {
      callCount++;

      return [];
    });
    const panel = new ScorePanel({ 
      scoreManager: scoreManagerMock, 
      eventBus 
    });
  
    const before = callCount;
    eventBus.emit('score:update');
    assert.ok(callCount > before, 'Should react before destroy');
  
    panel.destroy();
  
    const afterDestroy = callCount;
    eventBus.emit('score:update');
    assert.strictEqual(callCount, afterDestroy, 'Should NOT react after destroy');
  });

  await t.test('MetaPanel cleans up subscriptions on destroy', async () => {
    const { eventBus, mockProgress } = setupUIContext();
  
    const panel = new MetaPanel({ progressManager: mockProgress, eventBus, raceStats: RACE_STATS, upgrades: UPGRADES });
  
    mockProgress.credits = 50;
    eventBus.emit('progress:update', { credits: 50 });
    assert.strictEqual(document.getElementById('credits').textContent, '50', 'Should react before destroy');
  
    panel.destroy();
  
    mockProgress.credits = 99;
    eventBus.emit('progress:update', { credits: 99 });
    assert.strictEqual(document.getElementById('credits').textContent, '50', 'Should NOT react after destroy');
  });

  await t.test('MenuController custom initialization', async (st) => {
    await st.test('MenuController accepts custom raceStats and calculates statMaxes correctly', () => {
      createMenuTestEnvironment();
      
      const customRaceStats = {
        rocks: {
          emoji: '🪨',
          health: { max: 1000 },
          damage: { amount: 5 },
          movement: { maxSpeed: 2, acceleration: 0.1, rotationSpeed: 0.01 }
        },
        papers: {
          emoji: '📄',
          health: { max: 500 },
          damage: { amount: 10 },
          movement: { maxSpeed: 4, acceleration: 0.2, rotationSpeed: 0.02 }
        }
      };

      const menu = new MenuController({
        getGame: () => null,
        onStart: () => {},
        raceStats: customRaceStats
      });

      assert.strictEqual(menu.raceStats, customRaceStats, 'Should use the custom raceStats');
      assert.strictEqual(menu.statMaxes.Health, 1000, 'Max health should be 1000');
      assert.strictEqual(menu.statMaxes.Damage, 10, 'Max damage should be 10');
      assert.strictEqual(menu.statMaxes.Speed, 4, 'Max speed should be 4');
    });

    await st.test('MenuController handles custom gameModes', () => {
      createMenuTestEnvironment();

      const customGameModes = {
        'custom-mode': { label: 'Custom Mode', kind: 'infinite', capture: false }
      };

      const mockGame = {
        raceStats: RACE_STATS,
        gameModes: customGameModes,
        leagueLengths: [10, 20]
      };

      const menu = new MenuController({
        getGame: () => mockGame,
        onStart: () => {}
      });

      assert.deepEqual(menu.gameModes, customGameModes, 'Should resolve custom gameModes from game');
      assert.deepEqual(menu.leagueLengths, [10, 20], 'Should resolve custom leagueLengths from game');
    });
  });

  await t.test('InfoPanel reacts to game:match-start event and draws state correctly', async () => {
    const { eventBus, mockProgress } = setupUIContext({
      isTeamChosen: () => true,
      credits: 150
    });

    const panel = new InfoPanel({
      progressManager: mockProgress,
      eventBus
    });

    try {
      eventBus.emit('game:match-start', {
        matchNumber: 3,
        timeLeft: 12000,
        timeless: false,
        mode: { isLeague: true, modeKey: 'deathmatch' },
        leagueLength: 10
      });

      const textContent = document.body.textContent;
      assert.ok(textContent.includes('Match: 3/10'), 'Should display Match 3 of league of 10');
      assert.ok(textContent.includes('12s'), 'Should display remaining time of 12 seconds');
      assert.ok(textContent.includes('150'), 'Should display progress credits');
    } finally {
      panel.destroy();
    }
  });
});
