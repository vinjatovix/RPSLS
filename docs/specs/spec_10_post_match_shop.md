# Spec: Spec #10 - Post-Match Shop & Interstitial System

## Context
**Problem/Opportunity:**
Currently, the player manages upgrades (training and global) via a persistent sidebar (`MetaPanel`) during the match. This creates cognitive load by requiring attention to the UI during intense gameplay. There is an opportunity to move this "management" phase to a dedicated intermission between matches, allowing the player to focus entirely on combat during the match and strategy between matches.

**Impact:**
High. This requires a refactor of the `MetaPanel`, the introduction of a new `ShopService` and `ShopUI`, and the implementation of a new `MatchResultModal` orchestrated by the `MenuController`.

## Objectives
- [ ] **Decouplig:** Extract shopping/upgrade logic from `MetaPanel` into a specialized `ShopService`.
- [ ] **New UI Component:** Create a standalone `ShopUI` that renders upgradeable items.
- [ ] **Interstital Flow:** Implement a `MatchResultModal` that appears at `game:match-end`.
- [ ] **Decision Point:** The modal must provide two clear paths: `Next Match` (resets arena) and `Shop` (opens the upgrade interface).
- [ ] **Regression Safety:** Ensure existing "Global" and "Per-Race" upgrade mechanics in `ProgressManager` remain functional and unmodified.

## Architecture & Design

### Affected Modules
- `src/ui/MetaPanel.js`: Refactor to remove shop rendering and interactable buttons; retain only persistent HUD elements (e.g., credits).
- `src/ui/MenuController.js`: Update to orchestrate the new `MatchResultModal` lifecycle.
- `src/ui/ScorePanel.js`: Ensure `game:match-end` events trigger the new modal flow.

### New Modules (SOLID)
- `src/services/ShopService.js` (**Domain/Service Layer**): 
  - Wraps `ProgressManager`.
  - Provides `getAvailableUpgrades()` (formatted for UI).
  - Provides `executePurchase(key, team)` (delegates to `ProgressManager.buyUpgrade`).
- `src/ui/ShopUI.js` (**Presentation Layer**):
  - Purely functional component.
  - Renders HTML based on data from `ShopService`.
  - Emits upgrade requests.
- `src/ui/MatchResultModal.js` (**Orchestration/Component Layer**):
  - Displays match statistics (winner, kills, deaths).
  - Hosts the `ShopUI` when the "Shop" button is clicked.

### Data Flow
1. **Match Ends** $\rightarrow$ `EventBus` emits `game:match-end`.
2. **`MenuController`** intercepts $\rightarrow$ Instantiates `MatchResultModal`.
3. **`MatchResultModal`** $\rightarrow$ Requests upgrade list from `ShopService`.
4. **`ShopUI`** $\rightarrow$ Renders list $\rightarrow$ User clicks upgrade $\rightarrow$ `ShopService.executePurchase()`.
5. **`ProgressManager`** $\rightarrow$ Updates `credits` and `upgrades` $\rightarrow$ `EventBus` notifies updates.

## Verification Plan (Definition of Done)

### Automated Tests
- [ ] **Unit Test (`ShopService`):** Verify `getAvailableUpgrades` returns the correct structure and prices.
- [ ] **Unit Test (`ShopService`):** Verify `executePurchase` returns `false` if credits are insufficient.
- [ ] **Integration Test:** Verify that a purchase via `ShopService` correctly updates the `ProgressManager` state.

### Manual Verification
- [ ] Confirm the sidebar no longer contains interactive upgrade buttons during a match.
- [ ] Verify that when a match ends, the `MatchResultModal` appears with correct stats.
- [ ] Verify that clicking "Shop" within the modal correctly displays the new upgrade interface.
- [ ] Ensure "Next Match" correctly resets the arena for the next round.

## Risks & Mitigations
- **Risk:** Breaking the existing `ProgressManager` upgrade logic.
- **Mitigation:** The `ShopService` will be a thin wrapper; the core logic stays in the proven `ProgressManager`.
- **Risk:** Increased complexity in the `MenuController` due to new modal states.
- **Mitigation:** Use a strictly defined state machine for the Modal (Result $\rightarrow$ Shop $\rightarrow$ Next Match).
