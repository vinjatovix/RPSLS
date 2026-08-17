# AGENTS.md

## Execution Protocol
**Permission**: Ask before running shell commands. User executes `npm test` and `npm run balance` manually to minimize token usage.

## Critical Constraints
1. **Balance Threshold**: Win-rates must stay within **±5pp** of 20% (5 teams). 
   - **Action**: If deviation >±5pp, propose stat adjustments.
   - **Goal**: Rock (High HP, Low Turn), Paper (Best Turn), Scissors (Max DMG, Low HP), Lizard (Speed), Sp																																	Spock (Acc/Braking).
2. **Test Guard**: `npm test` fails if deviation >**±7pp**.
3. **Immutability**: `src/config/gameConfig.js` is frozen. Do not suggest runtime mutations.
4. **Determinism**: Logic must be deterministic (seeded PRNG). No `Math.random()`.
5. **Code Style**: Strict adherence to **SOLID, DRY, KISS, YAGNI**.
   - **Parameter Rule**: Functions with >3 arguments **must** use a single options object.

## Workflow
1. Propose code changes.
2. **Ask me**: "Please run `npm run balance` and share the output."
3. Analyze results and iterate.

## Architecture Quick-Ref
- **Logic**: Pure RPS (Rock-Paper-Scissors-Lizard-Spock) TTK/Overlap.
- **Entry**: `src/index.js`   