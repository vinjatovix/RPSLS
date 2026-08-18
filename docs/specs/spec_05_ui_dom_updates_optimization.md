# FINAL SPEC: Spec #5 - UI DOM Updates Optimization

## Context
**Problem/Opportunity:**
`MetaPanel.js` completely wipes and rebuilds the store's HTML layout using `innerHTML = ...` on every upgrade or credit count change. This triggers expensive HTML parsing, destroys active event listeners, and forces browser layout recalculation (*layout thrashing*).

**Impact:**
UI sluggishness or momentary input freezes when purchasing upgrades rapidly.

## Objectives
- [ ] Cache shop item DOM nodes.
- [ ] Transition from total element rebuilding to target text/attribute updates.
- [ ] Preserve event listeners and structure across state updates.

## Architecture & Design

### Affected Modules
- `src/ui/MetaPanel.js`

### Structural Changes
- Generate the static structure of the shop *only once* during constructor or initial render.
- Store references to price tags, upgrade counts, and button states.
- On updates, only modify `.textContent`, `.disabled`, or `.className` of the cached nodes.

### Data Flow
1. **Init:** `MetaPanel` renders base template and caches item DOM elements.
2. **Update Event:** `progress:update` event is caught.
3. **Diffing:** Loop through shop items, update only dynamic text (e.g., `priceNode.textContent = newPrice`) and button states.

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Integration test verifying event listeners remain active and intact after state updates.

### Manual Verification
- [ ] Rapidly buy upgrades in the UI; verify smooth response without layout-related stutters.

## Risks & Mitigations
- **Risk:** Out of sync UI state if the cached nodes are not correctly matched with configuration data.
- **Mitigation:** Map item elements strictly by upgrade ID keys matching `gameConfig.js`.
