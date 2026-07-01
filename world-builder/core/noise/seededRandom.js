/**
 * Mulberry32 PRNG returning floats in [0, 1).
 * @param {number} seed uint32
 */
export function createSeededRandom(seed) {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >> 7), t | 61)
    return ((t ^ (t >> 14)) >> 0) / 4294967296
  }
}

/**
 * Derive a uint32 stream seed from geography seed and field salt.
 * @param {number} geographySeed
 * @param {string} fieldSalt
 */
export function deriveFieldSeed(geographySeed, fieldSalt) {
  let hash = geographySeed | 0
  for (let i = 0; i < fieldSalt.length; i += 1) {
    hash = Math.imul(hash ^ fieldSalt.charCodeAt(i), 0x01000193)
  }
  return hash | 0
}
