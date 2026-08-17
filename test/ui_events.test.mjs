import test from 'node:test';
import assert from 'node:assert';
import { EventBus } from '../src/core/EventBus.js';
import { InfoPanel } from '../src/ui/InfoPanel.js';
import { MetaPanel } from '../src/ui/MetaPanel.js';
import { ScorePanel } from '../src/ui/ScorePanel.js';
import { JSDOM } from 'jsdom';

function createTestEnvironment() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="score-list"></div>
    <div id="round-info"></div>
    <div id="credits"></div>
    <div id="shop-list"></div>
    <div id="upgrades"></div>
  </body></html>`);
  
  const { window } = dom;
  global.document = window.document;
  global.window = window;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  
  return { dom, window };
}

test('UI Event-Driven Architecture', async (t) => {
  await t.test('InfoPanel reacts to game:match-start event', async () => {
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1 
    };
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => []
    };
    const panel = new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 5, mode: { isLeague: false } });
  
    assert.ok(document.body.textContent.includes('Match: 5'), 'Round info should reflect match 5');
  });

  await t.test('InfoPanel shows last winner after game:match-end', async () => {
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1 
    };
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => []
    };
    const panel = new InfoPanel({ 
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
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1,
      getUpgradeLevel: () => 0,
      getUpgradeCost: () => 0,
      eventBus: eventBus
    };
  
    const panel = new MetaPanel({ progressManager: mockProgress, eventBus });
  
    mockProgress.credits = 100;
    eventBus.emit('progress:update', { credits: 100 });
  
    const creditsElem = document.getElementById('credits');
    assert.strictEqual(creditsElem.textContent, '100', 'Credits element should show 100');
  });

  await t.test('ScorePanel displays team name and ranking data', async () => {
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => [
        { emoji: '\u{1FAA8}', score: 10, kills: 5, deaths: 2, ratio: 2.5, name: 'rocks' },
        { emoji: '\u{1F4C4}', score: 5, kills: 2, deaths: 3, ratio: 0.66, name: 'papers' }
      ]
    };
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
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1 
    };
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => []
    };
  
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
    createTestEnvironment();
    const eventBus = new EventBus();
    
    let callCount = 0;
    const scoreManagerMock = {
      eventBus,
      getRanking: () => {
        callCount++;
        return [
          { emoji: '\u{1FAA8}', score: 10, kills: 5, deaths: 2, ratio: 2.5, name: 'rocks' }
        ];
      }
    };
    const panel = new ScorePanel({ 
      scoreManager: scoreManagerMock, 
      eventBus 
    });
  
    const before = callCount;
    eventBus.emit('score:update');
  
    assert.ok(callCount > before, 'ScorePanel should call getRanking after score:update event');
    assert.ok(document.body.textContent.includes('\u{1FAA8} rocks'), 'Should render ranking data');
  });

  await t.test('InfoPanel reacts to tick event', async () => {
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1 
    };
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => []
    };
    const panel = new InfoPanel({ 
      scoreManager: scoreManagerMock, 
      progressManager: mockProgress, 
      eventBus 
    });
  
    eventBus.emit('game:match-start', { matchNumber: 1, mode: { isLeague: false }, timeLeft: 30000 });
    eventBus.emit('tick', { timeLeft: 25000 });
  
    assert.ok(document.body.textContent.includes('25s'), 'Should show updated time after tick');
  });

  await t.test('InfoPanel reacts to game:mechanics-change event', async () => {
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1 
    };
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => []
    };
    const panel = new InfoPanel({ 
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
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1 
    };
    
    const scoreManagerMock = {
      eventBus,
      getRanking: () => []
    };
    const panel = new InfoPanel({ 
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
    createTestEnvironment();
    const eventBus = new EventBus();
    
    let callCount = 0;
    const scoreManagerMock = {
      eventBus,
      getRanking: () => {
        callCount++;
        return [];
      }
    };
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
    assert.equal(callCount, afterDestroy, 'Should NOT react after destroy');
  });

  await t.test('MetaPanel cleans up subscriptions on destroy', async () => {
    createTestEnvironment();
    const eventBus = new EventBus();
    
    const mockProgress = { 
      credits: 0, 
      selectedTeam: 'rocks',
      getPowerupLuck: () => 1,
      getUpgradeLevel: () => 0,
      getUpgradeCost: () => 0,
      eventBus: eventBus
    };
  
    const panel = new MetaPanel({ progressManager: mockProgress, eventBus });
  
    mockProgress.credits = 50;
    eventBus.emit('progress:update', { credits: 50 });
    assert.strictEqual(document.getElementById('credits').textContent, '50', 'Should react before destroy');
  
    panel.destroy();
  
    mockProgress.credits = 99;
    eventBus.emit('progress:update', { credits: 99 });
    assert.strictEqual(document.getElementById('credits').textContent, '50', 'Should NOT react after destroy');
  });
});
