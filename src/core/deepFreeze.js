/**
 * Should only be applied in the browser bootstrap: the balance harness
 * (headless-campaign/sweep) mutates RACE_STATS and GAME_CONFIG in Node.
 */

export function deepFreeze(value) {
  const seen = new WeakSet();

  function freeze(node) {
    if (node === null || typeof node !== "object") return node;
    if (seen.has(node)) return node;
    seen.add(node);
    for (const key of Object.getOwnPropertyNames(node)) {
      freeze(node[key]);
    }
    return Object.freeze(node);
  }

  return freeze(value);
}
