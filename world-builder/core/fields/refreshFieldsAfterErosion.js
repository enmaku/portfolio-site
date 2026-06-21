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
 * @returns {import('../types.js').ScalarFields}
 */
export function refreshFieldsAfterErosion({
  geographySeed,
  prevailingWindDegrees,
  elevation,
  drainage,
  width,
  height,
}) {
  const temperature = generateTemperature({ geographySeed, width, height, elevation })
  const rainfall = generateRainfall({
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees,
  })
  const salidity = deriveSalidityFromOcean({ elevation, width, height })

  return { elevation, temperature, rainfall, drainage, salidity }
}
