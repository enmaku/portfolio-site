import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { applyClosedIslandRim } from './applyClosedIslandRim.js'
import { scaleElevationAroundSeaLevel } from './scaleElevationAroundSeaLevel.js'
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
export function generateElevation({ geographySeed, width, height, options } ) {
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'elevation')
  const elevation = generateFbm2d({
    width,
    height,
    seed,
    octaves: resolved.elevationOctaves,
    frequency: scaleForGridSize(0.008 * resolved.elevationFrequencyScale, width),
    persistence: resolved.elevationPersistence,
  })
  scaleElevationAroundSeaLevel(elevation, resolved.seaLevel, resolved.elevationScale)
  applyClosedIslandRim(elevation, width, height)
  return elevation
}
