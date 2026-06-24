import { prevailingWindUpwindVector } from '../fields/prevailingWindField.js'
import { MIN_HIGHLAND_ELEVATION } from '../types.js'

const EPSILON = 1e-6

/**
 * @typedef {Object} WindRainfallAsymmetry
 * @property {number} asymmetry absolute windward/leeward rainfall gap, normalized by their mean
 * @property {number} signedAsymmetry windwardMean − leewardMean (positive when windward is wetter)
 * @property {number} windwardMean
 * @property {number} leewardMean
 * @property {number} highlandCellCount
 */

/**
 * Wind-driven rainfall asymmetry across highland terrain. Highland cells are split
 * into windward and leeward half-planes relative to the highland centroid along the
 * prevailing wind, then mean rainfall is compared. Orographic lift makes the
 * windward flank wetter, so a wind-sensitive world shows positive signed asymmetry.
 * @param {Object} params
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees
 * @param {number} [params.highlandElevation]
 * @returns {WindRainfallAsymmetry}
 */
export function computeWindRainfallAsymmetry({
  rainfall,
  elevation,
  width,
  height,
  prevailingWindDegrees,
  highlandElevation = MIN_HIGHLAND_ELEVATION,
}) {
  const { upwindX, upwindY } = prevailingWindUpwindVector(prevailingWindDegrees)

  let sumX = 0
  let sumY = 0
  let highlandCellCount = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (elevation[y * width + x] < highlandElevation) continue
      sumX += x
      sumY += y
      highlandCellCount += 1
    }
  }

  if (highlandCellCount === 0) {
    return {
      asymmetry: 0,
      signedAsymmetry: 0,
      windwardMean: 0,
      leewardMean: 0,
      highlandCellCount: 0,
    }
  }

  const centroidX = sumX / highlandCellCount
  const centroidY = sumY / highlandCellCount

  let windwardSum = 0
  let windwardCount = 0
  let leewardSum = 0
  let leewardCount = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (elevation[idx] < highlandElevation) continue
      const projection = (x - centroidX) * upwindX + (y - centroidY) * upwindY
      if (projection > 0) {
        windwardSum += rainfall[idx]
        windwardCount += 1
      } else if (projection < 0) {
        leewardSum += rainfall[idx]
        leewardCount += 1
      }
    }
  }

  const windwardMean = windwardCount > 0 ? windwardSum / windwardCount : 0
  const leewardMean = leewardCount > 0 ? leewardSum / leewardCount : 0
  const signedAsymmetry = windwardMean - leewardMean
  const overallMean = (windwardMean + leewardMean) / 2
  const asymmetry = overallMean > EPSILON ? Math.abs(signedAsymmetry) / overallMean : 0

  return { asymmetry, signedAsymmetry, windwardMean, leewardMean, highlandCellCount }
}
