import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import {
  computeFlowPartitions,
  partitionsToFlowDirection,
} from './dInfinityFlow.js'
import { downstreamIndex } from './computeFlowAccumulation.js'

const NO_SINK = -2
const OCEAN_SINK = -1

/**
 * @param {Uint8Array} lakeMask
 * @param {import('../types.js').LakeRecord[]} lakes
 * @param {number} width
 * @param {number} height
 * @returns {Int32Array}
 */
export function buildLakeIdByCell(lakeMask, lakes, width, height) {
  const lakeIdByCell = new Int32Array(lakeMask.length).fill(-1)
  const visited = new Uint8Array(lakeMask.length)
  const components = []

  for (let idx = 0; idx < lakeMask.length; idx += 1) {
    if (!lakeMask[idx] || visited[idx]) continue
    /** @type {number[]} */
    const cells = []
    const stack = [idx]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined || visited[current] || !lakeMask[current]) continue
      visited[current] = 1
      cells.push(current)
      const x = current % width
      const y = Math.floor(current / width)
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        stack.push(ny * width + nx)
      }
    }
    components.push(cells)
  }

  for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
    const lake = lakes[lakeId]
    let matched = components.find((cells) => {
      if (lake.spillX !== undefined && lake.spillY !== undefined) {
        const spillIdx = lake.spillY * width + lake.spillX
        return cells.some((cellIdx) => isAdjacent(cellIdx, spillIdx, width))
      }
      if (lake.endorheic) {
        return cells.length === lake.area
      }
      return false
    })
    if (!matched && components.length > 0) {
      matched = components[lakeId] ?? components[0]
    }
    if (matched) {
      for (const cellIdx of matched) {
        lakeIdByCell[cellIdx] = lakeId
      }
    }
  }

  return lakeIdByCell
}

/**
 * @param {number} cellIdx
 * @param {number} otherIdx
 * @param {number} width
 */
function isAdjacent(cellIdx, otherIdx, width) {
  const x = cellIdx % width
  const y = Math.floor(cellIdx / width)
  const ox = otherIdx % width
  const oy = Math.floor(otherIdx / width)
  return Math.abs(x - ox) + Math.abs(y - oy) === 1
}

/**
 * Map each land cell to the lake id whose basin receives its runoff.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.lakeIdByCell
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {{ catchmentIndex: Int32Array, catchmentCellsByLake: number[][] }}
 */
export function deriveBasinCatchments({
  elevation,
  lakeIdByCell,
  width,
  height,
  seaLevel = SEA_LEVEL,
}) {
  const cellCount = width * height
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const partitions = computeFlowPartitions({ elevation, width, height, ocean, seaLevel })
  const flowDirection = partitionsToFlowDirection(partitions)
  const catchmentIndex = new Int32Array(cellCount).fill(NO_SINK)
  const lakeCount = lakeIdByCell.reduce((max, id) => Math.max(max, id + 1), 0)
  /** @type {number[][]} */
  const catchmentCellsByLake = Array.from({ length: lakeCount }, () => [])

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) {
      catchmentIndex[idx] = OCEAN_SINK
      continue
    }

    const lakeId = lakeIdByCell[idx]
    if (lakeId >= 0) {
      catchmentIndex[idx] = lakeId
      catchmentCellsByLake[lakeId].push(idx)
      continue
    }

    let current = idx
    const visited = new Set()
    let terminal = NO_SINK

    while (!visited.has(current)) {
      visited.add(current)
      if (ocean[current]) {
        terminal = OCEAN_SINK
        break
      }
      const onLake = lakeIdByCell[current]
      if (onLake >= 0) {
        terminal = onLake
        break
      }
      const downstream = downstreamIndex(current, width, flowDirection)
      if (downstream < 0 || visited.has(downstream)) {
        break
      }
      current = downstream
    }

    catchmentIndex[idx] = terminal
    if (terminal >= 0) {
      catchmentCellsByLake[terminal].push(idx)
    }
  }

  return { catchmentIndex, catchmentCellsByLake }
}

export { NO_SINK, OCEAN_SINK }
