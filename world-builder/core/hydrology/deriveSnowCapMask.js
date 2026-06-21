import {
  SNOW_CAP_ELEVATION_MIN,
  SNOW_CAP_TEMPERATURE_MAX,
} from '../biomeIds.js'

/** Base melt flow added on top of the default rainfall catchment unit. */
export const SNOW_MELT_BASE_FLOW = 10

const D8_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/**
 * @param {Uint8Array} snowCapMask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isSnowCapEdgeCell(snowCapMask, width, height, x, y) {
  for (let d = 0; d < D8_OFFSETS.length; d += 1) {
    const nx = x + D8_OFFSETS[d][0]
    const ny = y + D8_OFFSETS[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true
    if (!snowCapMask[ny * width + nx]) return true
  }
  return false
}

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
 * Extra flow accumulation units from snow melt on snow-cap edge cells only.
 * Interior ice holds no melt sources; ablation is modeled at the cap perimeter.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.temperature
 * @param {Uint8Array} params.snowCapMask
 * @param {number} params.width
 * @param {number} params.height
 * @returns {Float32Array}
 */
export function deriveSnowMeltContribution({
  elevation,
  temperature,
  snowCapMask,
  width,
  height,
}) {
  const melt = new Float32Array(elevation.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (!snowCapMask[i]) continue
      if (!isSnowCapEdgeCell(snowCapMask, width, height, x, y)) continue

      const elevExcess = Math.max(0, elevation[i] - SNOW_CAP_ELEVATION_MIN)
      const coldness = Math.max(0, SNOW_CAP_TEMPERATURE_MAX - temperature[i])
      melt[i] = SNOW_MELT_BASE_FLOW + elevExcess * 36 + coldness * 18
    }
  }
  return melt
}
