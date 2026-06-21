import {
  SNOW_CAP_ELEVATION_MIN,
  SNOW_CAP_TEMPERATURE_MAX,
} from '../biomeIds.js'

/** Base melt flow added on top of the default rainfall catchment unit. */
export const SNOW_MELT_BASE_FLOW = 10

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.temperature
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {Uint8Array}
 */
export function deriveSnowCapMask({
  elevation,
  temperature,
  width,
  height,
  seaLevel,
}) {
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i += 1) {
    if (seaLevel !== undefined && elevation[i] < seaLevel) continue
    if (
      elevation[i] >= SNOW_CAP_ELEVATION_MIN &&
      temperature[i] <= SNOW_CAP_TEMPERATURE_MAX
    ) {
      mask[i] = 1
    }
  }
  return mask
}

/**
 * Extra flow accumulation units from snow melt on snow-cap cells.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.temperature
 * @param {Uint8Array} params.snowCapMask
 * @returns {Float32Array}
 */
export function deriveSnowMeltContribution({ elevation, temperature, snowCapMask }) {
  const melt = new Float32Array(elevation.length)
  for (let i = 0; i < melt.length; i += 1) {
    if (!snowCapMask[i]) continue
    const elevExcess = Math.max(0, elevation[i] - SNOW_CAP_ELEVATION_MIN)
    const coldness = Math.max(0, SNOW_CAP_TEMPERATURE_MAX - temperature[i])
    melt[i] = SNOW_MELT_BASE_FLOW + elevExcess * 36 + coldness * 18
  }
  return melt
}
