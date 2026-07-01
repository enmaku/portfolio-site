import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from './applyClosedIslandRim.js'
import { scaleForGridSize } from '../types.js'

const REFERENCE_MAX_INLAND_DISTANCE = 24

/**
 * Salinity from distance to ocean / closed island rim (1 at sea, taper inland).
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {Float32Array}
 */
export function deriveSalinityFromOcean({ elevation, width, height, seaLevel = SEA_LEVEL }) {
  const maxInlandDistance = scaleForGridSize(REFERENCE_MAX_INLAND_DISTANCE, width)
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const distance = new Float32Array(width * height)
  const queue = []

  for (let i = 0; i < ocean.length; i += 1) {
    if (ocean[i]) {
      distance[i] = 0
      queue.push(i)
    } else {
      distance[i] = Infinity
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head]
    head += 1
    const x = idx % width
    const y = Math.floor(idx / width)
    const nextDist = distance[idx] + 1

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (nextDist < distance[nIdx]) {
        distance[nIdx] = nextDist
        queue.push(nIdx)
      }
    }
  }

  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i += 1) {
    if (ocean[i]) {
      out[i] = 1
    } else {
      const d = distance[i]
      out[i] = Math.max(0, 1 - d / maxInlandDistance)
    }
  }

  return out
}
