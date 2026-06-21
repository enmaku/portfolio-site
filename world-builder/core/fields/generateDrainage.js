import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { scaleForGridSize } from '../types.js'

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @returns {Float32Array}
 */
export function generateDrainage({ geographySeed, width, height } ) {
  const seed = deriveFieldSeed(geographySeed, 'drainage')
  return generateFbm2d({
    width,
    height,
    seed,
    octaves: 4,
    frequency: scaleForGridSize(0.018, width),
    persistence: 0.5,
  })
}
