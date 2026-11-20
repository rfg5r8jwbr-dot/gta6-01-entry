// Solmar Heat — a small seeded random number generator, written from scratch.
// mulberry32 is a tiny, well-behaved PRNG: given the same seed it always
// produces the same stream, which keeps the city, traffic and screenshots
// deterministic for a given seed.

export function createRng(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random number in [min, max).
export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Random integer in [min, max] inclusive.
export function rngInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Pick one element of an array at random.
export function rngPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Chance roll: true with probability p (0..1).
export function rngChance(rng, p) {
  return rng() < p;
}

// Shuffle a list in place (Fisher-Yates) with the seeded RNG, so a shuffled
// pick — fare intersections, for one — stays deterministic for a seed.
export function rngShuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}
