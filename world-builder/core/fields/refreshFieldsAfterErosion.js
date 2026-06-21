import { generateTemperature } from './generateTemperature.js'
import { generateRainfall } from './generateRainfall.js'
import { deriveSalidityFromOcean } from './deriveSalidityFromOcean.js'

/**
 * Recompute climate scalar fields after erosion; prevailing wind unchanged.
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.prevailingWindDegrees
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.drainage
 * @param {number} params.width
 * @param {number} params.height
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @returns {import('../types.js').ScalarFields}
 */
export function refreshFieldsAfterErosion({
  geographySeed,
  prevailingWindDegrees,
  elevation,
  drainage,
  width,
  height,
  options,
}) {
  const temperature = generateTemperature({ geographySeed, width, height, elevation, options })
  const rainfall = generateRainfall({
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees,
    options,
  })
  const salidity = deriveSalidityFromOcean({ elevation, width, height })

  return { elevation, temperature, rainfall, drainage, salidity }
}
