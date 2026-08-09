import {
  WIND_OROGRAPHIC_SAMPLE_STEPS,
  prevailingWindUpwindVector,
  windRayStepSizeForGrid,
} from './prevailingWindField.js'

/** Minimum windward rise (cell minus immediate upwind cell) before orographic lift applies. */
const LIFT_THRESHOLD = 0.04

/** Converts a windward rise into a lift fraction. */
const LIFT_GAIN = 3

/** Minimum upwind barrier height above a cell before leeward drying applies. */
const SHADOW_THRESHOLD = 0.08

/** Converts an upwind barrier height into a shadow fraction. */
const SHADOW_GAIN = 2.2

/** Cap on how much drying a full shadow removes at rainShadowStrength 1. */
const SHADOW_MAX = 0.75

const MULTIPLIER_FLOOR = 0.25
const MULTIPLIER_CEIL = 1.75

function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Bidirectional orographic moisture pass: enhances rainfall on windward slopes
 * forced to lift air, and dries cells sheltered behind upwind barriers. Wind
 * bearing is meteorological (0 = north, 90 = east).
 * @param {Object} params
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees
 * @param {number} [params.rainShadowStrength]
 * @param {number} [params.liftStrength] defaults to rainShadowStrength so wind rotation
 *   moves wet and dry sides together; pass 0 for leeward-only (legacy) behavior.
 * @returns {Float32Array}
 */
export function applyOrographicMoisture({
  rainfall,
  elevation,
  width,
  height,
  prevailingWindDegrees,
  rainShadowStrength = 1,
  liftStrength,
}) {
  const lift = liftStrength === undefined ? rainShadowStrength : liftStrength
  const out = new Float32Array(rainfall)
  const { upwindX, upwindY } = prevailingWindUpwindVector(prevailingWindDegrees)
  const stepSize = windRayStepSizeForGrid(width)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const cellElevation = elevation[idx]

      let maxUpwindElevation = cellElevation
      for (let step = 1; step <= WIND_OROGRAPHIC_SAMPLE_STEPS; step += 1) {
        const sampleX = Math.round(x + upwindX * step * stepSize)
        const sampleY = Math.round(y + upwindY * step * stepSize)
        if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
          continue
        }
        const sampleElevation = elevation[sampleY * width + sampleX]
        if (sampleElevation > maxUpwindElevation) {
          maxUpwindElevation = sampleElevation
        }
      }

      const upwindX1 = Math.round(x + upwindX * stepSize)
      const upwindY1 = Math.round(y + upwindY * stepSize)
      const immediateUpwindElevation =
        upwindX1 < 0 || upwindY1 < 0 || upwindX1 >= width || upwindY1 >= height
          ? cellElevation
          : elevation[upwindY1 * width + upwindX1]

      let multiplier = 1

      const rise = cellElevation - immediateUpwindElevation
      if (lift > 0 && rise > LIFT_THRESHOLD) {
        multiplier += lift * Math.min(1, rise * LIFT_GAIN)
      }

      const uplift = maxUpwindElevation - cellElevation
      if (uplift > SHADOW_THRESHOLD) {
        const shadow = Math.min(1, uplift * SHADOW_GAIN)
        multiplier *= 1 - shadow * SHADOW_MAX * rainShadowStrength
      }

      if (multiplier < MULTIPLIER_FLOOR) multiplier = MULTIPLIER_FLOOR
      if (multiplier > MULTIPLIER_CEIL) multiplier = MULTIPLIER_CEIL

      out[idx] = clamp01(rainfall[idx] * multiplier)
    }
  }

  return out
}
