import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { scaleForGridSize } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @returns {Float32Array}
 */
export function generateDrainage({ geographySeed, width, height, options }) {
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'drainage')
  const raw = generateFbm2d({
    width,
    height,
    seed,
    octaves: 4,
    frequency: scaleForGridSize(0.018, width),
    persistence: 0.5,
  })

  if (resolved.soilDrainageScale === 1) {
    return raw
  }

  const drainage = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    drainage[i] = Math.min(1, Math.max(0, raw[i] * resolved.soilDrainageScale))
  }
  return drainage
}
