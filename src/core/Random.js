export function createPRNG(seed) {
  let s = seed;
  
  return function() {
    let state = s = (s + 0x6D2B79F5) | 0;
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

// Dynamically generate an initial seed based on Date.now()
const initialSeed = (Date.now() ^ 0x55555555) | 0;
let currentSeed = initialSeed;
let activeRNG = createPRNG(initialSeed);

// Separate independent PRNG stream for cosmetic effects to protect simulation determinism
const cosmeticSeed = (initialSeed ^ 0xDEADBEEF) | 0;
const cosmeticRNG = createPRNG(cosmeticSeed);

console.log(`[PRNG] Initialized default simulation seed: ${initialSeed}`);

export const Random = {
  next() {
    return activeRNG();
  },
  cosmeticNext() {
    return cosmeticRNG();
  },
  getSeed() {
    return currentSeed;
  },
  setSeed(seed) {
    if (seed === null || seed === undefined) {
      currentSeed = (Date.now() ^ 0x55555555) | 0;
      console.log(`[PRNG] No seed provided. Initialized with dynamic seed: ${currentSeed}`);
      activeRNG = createPRNG(currentSeed);
    } else {
      currentSeed = seed;
      activeRNG = createPRNG(seed);
    }
  },
  setMock(mockFunction) {
    activeRNG = mockFunction;
  },
  restore() {
    activeRNG = createPRNG(initialSeed);
    currentSeed = initialSeed;
  }
};
