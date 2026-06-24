import { applyOrographicMoisture } from './applyOrographicMoisture.js'

/**
 * Reduce rainfall leeward of upwind high terrain (legacy leeward-only rain shadow).
 * Retained as a thin wrapper over {@link applyOrographicMoisture} with windward lift
 * disabled, for callers that want the historical drying-only behavior.
 * @param {Object} params
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees meteorological bearing (0 = north, 90 = east)
 * @param {number} [params.rainShadowStrength]
 * @returns {Float32Array}
 */
export function applyRainShadow({
  rainfall,
  elevation,
  width,
  height,
  prevailingWindDegrees,
  rainShadowStrength = 1,
}) {
  return applyOrographicMoisture({
    rainfall,
    elevation,
    width,
    height,
    prevailingWindDegrees,
    rainShadowStrength,
    liftStrength: 0,
  })
}
