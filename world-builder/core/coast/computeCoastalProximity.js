import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { REFERENCE_COASTAL_PROXIMITY_MAX_DISTANCE } from '../resourcePlacementScaling.js'

/** Land cells within this many ocean steps receive a coastal proximity score at REFERENCE_GRID_SIZE. */
export const COASTAL_PROXIMITY_MAX_DISTANCE = REFERENCE_COASTAL_PROXIMITY_MAX_DISTANCE

/**
 * Per-cell coastal proximity on land in [0, 1]; ocean cells are always 0.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @param {number} [params.maxDistance]
 * @returns {Float32Array}
 */
export function computeCoastalProximityOnLand({
  elevation,
  width,
  height,
  seaLevel = SEA_LEVEL,
  maxDistance = COASTAL_PROXIMITY_MAX_DISTANCE,
}) {
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const cellCount = width * height
  const dist = new Int32Array(cellCount).fill(-1)
  /** @type {number[]} */
  const queue = []

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) {
      dist[idx] = 0
      queue.push(idx)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head]
    head += 1
    const nextDist = dist[idx] + 1
    if (nextDist > maxDistance) continue
    const x = idx % width
    const y = Math.floor(idx / width)
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (dist[nIdx] >= 0) continue
      dist[nIdx] = nextDist
      queue.push(nIdx)
    }
  }

  const out = new Float32Array(cellCount)
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    const d = dist[idx]
    if (d > 0 && d <= maxDistance) {
      out[idx] = 1 - (d - 1) / maxDistance
    }
  }
  return out
}
