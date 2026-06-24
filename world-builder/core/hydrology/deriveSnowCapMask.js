import {
  SNOW_CAP_ELEVATION_MIN,
  SNOW_CAP_TEMPERATURE_MAX,
} from '../biomeIds.js'
import { prevailingWindUpwindVector } from '../fields/prevailingWindField.js'
import { scaleForGridSize } from '../types.js'
import { scoreUpwindSnowDeposition } from './snowWindEffects.js'

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
 * Minimum spacing between melt outlets along a snow-cap perimeter.
 * @param {number} gridSize
 * @returns {number}
 */
export function meltOutletSpacingForGrid(gridSize) {
  return Math.max(
    4,
    Math.min(Math.round(gridSize / 3), Math.round(scaleForGridSize(18, gridSize))),
  )
}

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
 * Steepest drop from a cap edge cell to a non-cap neighbor (melt exit gradient).
 * @param {Float32Array} elevation
 * @param {Uint8Array} snowCapMask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function scoreExitDrop(elevation, snowCapMask, width, height, x, y) {
  const idx = y * width + x
  let maxDrop = 0
  let hasNonSnowNeighbor = false
  for (let d = 0; d < D8_OFFSETS.length; d += 1) {
    const nx = x + D8_OFFSETS[d][0]
    const ny = y + D8_OFFSETS[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
      hasNonSnowNeighbor = true
      maxDrop = Math.max(maxDrop, elevation[idx] * 0.25)
      continue
    }
    const nIdx = ny * width + nx
    if (snowCapMask[nIdx]) continue
    hasNonSnowNeighbor = true
    maxDrop = Math.max(maxDrop, elevation[idx] - elevation[nIdx])
  }
  if (!hasNonSnowNeighbor) return 0
  return Math.max(maxDrop, 0.01)
}

/**
 * @param {Uint8Array} snowCapMask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function countSnowCapNeighbors(snowCapMask, width, height, x, y) {
  let count = 0
  for (let d = 0; d < D8_OFFSETS.length; d += 1) {
    const nx = x + D8_OFFSETS[d][0]
    const ny = y + D8_OFFSETS[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    if (snowCapMask[ny * width + nx]) count += 1
  }
  return count
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
 * Extra flow from selective snow-melt outlets on cap perimeters.
 * Outlets favor steep exit gradients, leeward snow accumulation, and broad catchments.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.temperature
 * @param {Uint8Array} params.snowCapMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.prevailingWindDegrees]
 * @returns {Float32Array}
 */
export function deriveSnowMeltContribution({
  elevation,
  temperature,
  snowCapMask,
  width,
  height,
  prevailingWindDegrees = 0,
}) {
  const melt = new Float32Array(elevation.length)
  const { upwindX, upwindY } = prevailingWindUpwindVector(prevailingWindDegrees)
  const outletSpacing = meltOutletSpacingForGrid(width)

  /** @type {{ idx: number, score: number, x: number, y: number, elevExcess: number, coldness: number }[]} */
  const candidates = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (!snowCapMask[idx]) continue
      if (!isSnowCapEdgeCell(snowCapMask, width, height, x, y)) continue

      const exitDrop = scoreExitDrop(elevation, snowCapMask, width, height, x, y)
      if (exitDrop <= 0) continue

      const elevExcess = Math.max(0, elevation[idx] - SNOW_CAP_ELEVATION_MIN)
      const coldness = Math.max(0, SNOW_CAP_TEMPERATURE_MAX - temperature[idx])
      const windDeposition = scoreUpwindSnowDeposition(
        snowCapMask,
        width,
        height,
        x,
        y,
        upwindX,
        upwindY,
      )
      const snowNeighbors = countSnowCapNeighbors(snowCapMask, width, height, x, y)
      const score =
        exitDrop * 14 +
        windDeposition * 2.8 +
        snowNeighbors * 0.45 +
        elevExcess * 3 +
        coldness * 1.5

      candidates.push({ idx, score, x, y, elevExcess, coldness })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  /** @type {{ x: number, y: number }[]} */
  const selected = []
  for (const candidate of candidates) {
    const tooClose = selected.some((other) =>
      Math.hypot(candidate.x - other.x, candidate.y - other.y) < outletSpacing,
    )
    if (tooClose) continue

    selected.push({ x: candidate.x, y: candidate.y })
    melt[candidate.idx] =
      SNOW_MELT_BASE_FLOW + candidate.elevExcess * 36 + candidate.coldness * 18
  }

  return melt
}
