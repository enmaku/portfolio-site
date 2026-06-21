import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { applyClosedIslandRim } from './applyClosedIslandRim.js'
import { scaleForGridSize } from '../types.js'

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @returns {Float32Array}
 */
export function generateElevation({ geographySeed, width, height } ) {
  const seed = deriveFieldSeed(geographySeed, 'elevation')
  const elevation = generateFbm2d({
    width,
    height,
    seed,
    octaves: 6,
    frequency: scaleForGridSize(0.008, width),
    persistence: 0.55,
  })
  applyClosedIslandRim(elevation, width, height)
  return elevation
}
