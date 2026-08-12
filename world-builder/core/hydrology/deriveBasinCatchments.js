import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import {
  collectConnectedComponents,
  manhattanAdjacent,
} from '../grid/gridTopology.js'
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
  const components = collectConnectedComponents(lakeMask, width, height, 4)

  for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
    const lake = lakes[lakeId]
    let matched = components.find((cells) => {
      if (lake.spillX !== undefined && lake.spillY !== undefined) {
        const spillIdx = lake.spillY * width + lake.spillX
        return cells.some((cellIdx) => manhattanAdjacent(cellIdx, spillIdx, width))
      }
      if (lake.endorheic) {
        return cells.length === lake.area
      }
      return false
    })
    if (!matched) {
      throw new Error(
        `Could not match lake record ${lakeId} to a lake-mask component (area=${lake.area}, endorheic=${lake.endorheic})`,
      )
    }
    for (const cellIdx of matched) {
      lakeIdByCell[cellIdx] = lakeId
    }
  }

  return lakeIdByCell
}

/**
 * Map each land cell to the lake id whose basin receives its runoff.
 * Downhill walks memoize the terminal sink onto every visited cell so shared
 * flow paths are resolved once.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Int32Array | Uint8Array} params.lakeIdByCell
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
  /** @type {number[]} */
  const path = []

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

    if (catchmentIndex[idx] !== NO_SINK) {
      continue
    }

    path.length = 0
    let current = idx
    let terminal = NO_SINK

    while (true) {
      if (ocean[current]) {
        terminal = OCEAN_SINK
        break
      }
      const onLake = lakeIdByCell[current]
      if (onLake >= 0) {
        terminal = onLake
        break
      }
      if (catchmentIndex[current] !== NO_SINK) {
        terminal = catchmentIndex[current]
        break
      }

      path.push(current)
      const downstream = downstreamIndex(current, width, flowDirection)
      if (downstream < 0) {
        break
      }
      let looping = false
      for (let i = 0; i < path.length; i += 1) {
        if (path[i] === downstream) {
          looping = true
          break
        }
      }
      if (looping) {
        break
      }
      current = downstream
    }

    for (let i = 0; i < path.length; i += 1) {
      const cellIdx = path[i]
      catchmentIndex[cellIdx] = terminal
      if (terminal >= 0) {
        catchmentCellsByLake[terminal].push(cellIdx)
      }
    }
  }

  return { catchmentIndex, catchmentCellsByLake }
}

export { NO_SINK, OCEAN_SINK }
