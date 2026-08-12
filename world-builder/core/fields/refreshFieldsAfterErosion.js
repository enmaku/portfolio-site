import { generateTemperature } from './generateTemperature.js'
import { generateRainfall } from './generateRainfall.js'
import { deriveSalinityFromOcean } from './deriveSalinityFromOcean.js'
import { normalizeWindDegrees } from './prevailingWindField.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'
import { isThenable } from '../asyncValue.js'

/**
 * Recompute climate scalar fields after erosion; wind rose bearings unchanged.
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.prevailingWindDegrees
 * @param {number} params.secondaryMaximumDegrees
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.drainage
 * @param {number} params.width
 * @param {number} params.height
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @param {(progress: number) => void} [params.onProgress] rainfall lobe progress 0..1
 * @param {() => void | Promise<void>} [params.yield]
 * @returns {import('../types.js').ScalarFields | Promise<import('../types.js').ScalarFields>}
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
  onProgress,
  yield: yieldFn,
}) {
  const temperature = generateTemperature({ geographySeed, width, height, elevation, options })
  const resolved = resolveWorldGenerationOptions(options)

  const rainfallResult = generateRainfall({
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees: normalizeWindDegrees(prevailingWindDegrees),
    secondaryMaximumDegrees: normalizeWindDegrees(secondaryMaximumDegrees),
    options,
    onProgress,
    yield: yieldFn,
  })

  const finish = (rainfall) => ({
    elevation,
    temperature,
    rainfall,
    drainage,
    salinity: deriveSalinityFromOcean({
      elevation,
      width,
      height,
      seaLevel: resolved.seaLevel,
    }),
  })

  if (isThenable(rainfallResult)) {
    return rainfallResult.then(finish)
  }
  return finish(rainfallResult)
}
