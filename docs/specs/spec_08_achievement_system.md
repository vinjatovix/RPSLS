# Spec: Spec #8 - Achievement System

## Context
**Problem/Opportunity:**
The game lacks a long-term progression and prestige layer to reward high-skill play and specific playstyles (e.g., playing without upgrades).

**Impact:**
Reduced player retention and lack of "end-game" goals for veteran players.

## Objectives
- [ ] Implement an `AchievementManager` service to track game milestones.
 	- [ ] Define achievement categories: Combat Multiplier, Win Rate (Scaling by League Size), Purist (No Global Upgrades), and Untrained (No Training Upgrades).
- [ ] Implement obfuscated `localStorage` persistence for unlocked achievements.
- [ ] Integrate with `EventBus` to trigger checks on matches, upgrades, and league completions.

## Architecture & Design

### Affected Modules
- `src/services/AchievementManager.js` (New)
- `src/core/EventBus.js` (To listen for achievement-triggering events)
- `src/entities/ScoreManager.js` (To provide K/D and Win Rate data)
- `src/entities/ProgressManager.js` (To track league progress and upgrades)

### Structural Changes
- **`AchievementManager`**: A singleton service that listens to `match_end`, `upgrade_purchased`, and `league_complete`.
- **`localStorage`**: Will store only unlocked achievement IDs using an obfuscated key (e.g., `_a7_p_enc_`) and encoded values (Base64/XOR) to prevent easy tampering.

### Achievement Definitions
**1. Combat Multiplier (K/D Ratio)**
*Triggered when Kills = X $\times$ Deaths.*
- `bully` (K/D = 2)
- `predator` (K/D = 3)
- `terminator` (K/D = 4)

**2. Win Rate (Scaling Difficulty by League Size)**
*Larger leagues (Jr) are easier to maintain high win percentages because there is more time to stabilize.*
- **Raider (>50%):** `raider_jr` (200m), `raider_mid` (100m), `raider_sr` (50m)
- **Conqueror (>60%):** `conqueror_jr` (200m), `conqueror_mid` (100m), `conqueror_sr` (50m)
- **Sovereign (>70%):** `sovereign_jr` (200m), `sovereign_mid` (100m), `sovereign_sr` (50m)

**3. Purist (No Global Upgrades - Time Accelerator)**
- `purist_50`, `purist_100`, `purist_200`

**4. Untrained (No Training Upgrades)**
- `untrained_bronze`, `untrained_silver`, `untrained_gold`

**5. Idlegod (no Global upgrade, no training upgrade, and no mouseclick on power ups in all the league)**
- `laozi`, `buddha`, `fukuoka`

## Verification Plan (Definition of Done)
### Automated Tests
- [ ] Unit test: `AchievementManager` correctly identifies a `bully` event.
- [ ] Unit test: `AchievementManager` ignores `upgrade_purchased` for "Purist" tracking.
- [ ] Test: `localStorage` does not contain unearned achievement IDs.

### Manual Verification
- [ ] Verify that an achievement appears in the UI/Storage only after meeting criteria.
- [ ] Ensure `localStorage` keys and values are non-human-readable in DevTools.

## Risks & Mitigations
- **Risk:** Performance overhead of checking multiple achievements on every match end.
- **Mitigation:** Use an event-driven approach where only relevant stats are evaluated.
- **Risk:** Players finding a way to bypass obfuscation.
- **Mitigation:** Use string encoding and non-obvious keys to deter casual cheating.
