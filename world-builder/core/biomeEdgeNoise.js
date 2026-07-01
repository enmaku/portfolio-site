import { generateFbm2d } from './noise/fbm2d.js'
import { deriveFieldSeed } from './noise/seededRandom.js'

/** Peak inland climate perturbation at strength 1 along biome classification thresholds. */
export const BIOME_EDGE_NOISE_AMPLITUDE = {
  temperature: 0.045,
  rainfall: 0.055,
  drainage: 0.04,
}

/** Base frequency for biome-edge fractal noise (grid-cell space). */
export const BIOME_EDGE_NOISE_FREQUENCY = 0.085

/** Fractal detail layers stacked on biome-edge noise. */
export const BIOME_EDGE_NOISE_OCTAVES = 4

/**
 * @typedef {Object} BiomeEdgeNoiseOffsets
 * @property {Float32Array} temperature
 * @property {Float32Array} rainfall
 * @property {Float32Array} drainage
 */

/**
 * Deterministic per-cell climate offsets that roughen inland biome boundaries.
 * @param {number} geographySeed
 * @param {number} width
 * @param {number} height
 * @param {number} [strength] 0 disables; 1 uses full configured amplitudes
 * @returns {BiomeEdgeNoiseOffsets | null}
 */
export function generateBiomeEdgeNoiseOffsets(geographySeed, width, height, strength = 1) {
  if (strength <= 0) return null

  return {
    temperature: centeredFbmField(
      geographySeed,
      'biome-edge-temperature',
      width,
      height,
      BIOME_EDGE_NOISE_AMPLITUDE.temperature * strength,
    ),
    rainfall: centeredFbmField(
      geographySeed,
      'biome-edge-rainfall',
      width,
      height,
      BIOME_EDGE_NOISE_AMPLITUDE.rainfall * strength,
    ),
    drainage: centeredFbmField(
      geographySeed,
      'biome-edge-drainage',
      width,
      height,
      BIOME_EDGE_NOISE_AMPLITUDE.drainage * strength,
    ),
  }
}

/**
 * @param {number} geographySeed
 * @param {string} fieldSalt
 * @param {number} width
 * @param {number} height
 * @param {number} amplitude
 * @returns {Float32Array}
 */
function centeredFbmField(geographySeed, fieldSalt, width, height, amplitude) {
  const seed = deriveFieldSeed(geographySeed, fieldSalt)
  const noise = generateFbm2d({
    width,
    height,
    seed,
    octaves: BIOME_EDGE_NOISE_OCTAVES,
    frequency: BIOME_EDGE_NOISE_FREQUENCY,
  })
  const out = new Float32Array(noise.length)
  for (let i = 0; i < noise.length; i += 1) {
    out[i] = (noise[i] - 0.5) * 2 * amplitude
  }
  return out
}
