import { SEA_LEVEL } from '../biomeIds.js'
import {
  canDrainIntoRimCell,
  isOceanCell,
  isRimCell,
} from '../fields/applyClosedIslandRim.js'

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

const D8_DIST = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414]

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @param {Float32Array} [params.meltContribution] extra flow units per land cell (e.g. snow melt)
 * @returns {{ flowDirection: Int16Array, flowAccumulation: Float32Array, ocean: boolean[] }}
 */
export function computeFlowAccumulation({
  elevation,
  width,
  height,
  seaLevel = SEA_LEVEL,
  meltContribution,
}) {
  const cellCount = width * height
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const inDegree = new Int16Array(cellCount)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (ocean[idx]) continue

      let steepestDrop = 0
      let steepestDir = -1

      for (let d = 0; d < D8_OFFSETS.length; d += 1) {
        const nx = x + D8_OFFSETS[d][0]
        const ny = y + D8_OFFSETS[d][1]
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (isRimCell(nIdx, width, height) && !canDrainIntoRimCell(elevation[idx], seaLevel)) {
          continue
        }
        const drop = (elevation[idx] - elevation[nIdx]) / D8_DIST[d]
        if (drop > steepestDrop) {
          steepestDrop = drop
          steepestDir = d
        }
      }

      if (steepestDir >= 0) {
        flowDirection[idx] = steepestDir
        const nx = x + D8_OFFSETS[steepestDir][0]
        const ny = y + D8_OFFSETS[steepestDir][1]
        inDegree[ny * width + nx] += 1
      }
    }
  }

  const flowAccumulation = new Float32Array(cellCount)
  const queue = []

  for (let i = 0; i < cellCount; i += 1) {
    if (ocean[i]) {
      flowAccumulation[i] = 0
    } else {
      flowAccumulation[i] = 1 + (meltContribution?.[i] ?? 0)
    }
    if (!ocean[i] && inDegree[i] === 0) {
      queue.push(i)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head]
    head += 1
    const dir = flowDirection[idx]
    if (dir < 0) continue

    const x = idx % width
    const y = Math.floor(idx / width)
    const nx = x + D8_OFFSETS[dir][0]
    const ny = y + D8_OFFSETS[dir][1]
    const downstream = ny * width + nx
    flowAccumulation[downstream] += flowAccumulation[idx]

    inDegree[downstream] -= 1
    if (inDegree[downstream] === 0 && !ocean[downstream]) {
      queue.push(downstream)
    }
  }

  return { flowDirection, flowAccumulation, ocean }
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {Int16Array} flowDirection
 * @returns {number}
 */
export function downstreamIndex(idx, width, flowDirection) {
  const dir = flowDirection[idx]
  if (dir < 0) return -1
  const x = idx % width
  const y = Math.floor(idx / width)
  const nx = x + D8_OFFSETS[dir][0]
  const ny = y + D8_OFFSETS[dir][1]
  return ny * width + nx
}

export { D8_OFFSETS }
