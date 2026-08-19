/**
 * Deeply freezes an object recursively to prevent any runtime mutations.
 * Safe to apply globally to config structures since balance harnesses and tests
 * clone the config as needed.
 */

export function deepFreeze(value) {
  const seen = new WeakSet();

  function freeze(node) {
    if (node === null || typeof node !== "object") return node;
    if (seen.has(node)) return node;
    seen.add(node);
    for (const key of Object.getOwnPropertyNames(node)) {
      const desc = Object.getOwnPropertyDescriptor(node, key);
      if (desc && (desc.get || desc.set)) continue; // Avoid invoking getters/setters during freeze
      freeze(node[key]);
    }

    return Object.freeze(node);
  }

  return freeze(value);
}
