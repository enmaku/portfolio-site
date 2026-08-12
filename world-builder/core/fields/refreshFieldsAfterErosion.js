import { generateTemperature } from './generateTemperature.js'
import { generateRainfall } from './generateRainfall.js'
import { deriveSalinityFromOcean } from './deriveSalinityFromOcean.js'
import { normalizeWindDegrees } from './prevailingWindField.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'

/**
 * Recompute climate scalar fields after erosion; wind rose bearings unchanged.
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.prevailingWindDegrees
 * @param {number} [params.secondaryMaximumDegrees]
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
  secondaryMaximumDegrees,
  elevation,
  drainage,
  width,
  height,
  options,
}) {
  const temperature = generateTemperature({ geographySeed, width, height, elevation, options })
  const prevailing = normalizeWindDegrees(prevailingWindDegrees)
  const secondary =
    secondaryMaximumDegrees === undefined
      ? normalizeWindDegrees(prevailing + 90)
      : normalizeWindDegrees(secondaryMaximumDegrees)
  const rainfall = generateRainfall({
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees: prevailing,
    secondaryMaximumDegrees: secondary,
    options,
  })
  const resolved = resolveWorldGenerationOptions(options)
  const salinity = deriveSalinityFromOcean({
    elevation,
    width,
    height,
    seaLevel: resolved.seaLevel,
  })

  return { elevation, temperature, rainfall, drainage, salinity }
}
