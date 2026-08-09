import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeCellRunoff } from './computeCellRunoff.js'
import {
  computeFlowPartitions,
  D8_OFFSETS,
  partitionsToFlowDirection,
} from './dInfinityFlow.js'

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} [params.meltContribution]
 * @param {Float32Array} [params.cellRunoff]
 * @param {Float32Array} [params.soilDrainage]
 * @param {number} [params.soilDrainageScale]
 * @returns {{ flowDirection: Int16Array, flowAccumulation: Float32Array, ocean: boolean[] }}
 */
export function computeFlowAccumulation({
  elevation,
  width,
  height,
  seaLevel = SEA_LEVEL,
  rainfall,
  meltContribution,
  soilDrainage,
  soilDrainageScale = 1,
  cellRunoff: cellRunoffOverride,
}) {
  if (!rainfall && !cellRunoffOverride) {
    throw new Error('rainfall is required for precipitation-weighted flow accumulation')
  }

  const cellCount = width * height
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const cellRunoff = cellRunoffOverride ?? computeCellRunoff({
    rainfall,
    meltContribution,
    soilDrainage,
    soilDrainageScale,
    ocean,
  })
  const partitions = computeFlowPartitions({
    elevation,
    width,
    height,
    ocean,
    seaLevel,
  })
  const flowDirection = partitionsToFlowDirection(partitions)

  const inDegree = new Int16Array(cellCount)
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    const partition = partitions[idx]
    if (isInGridCell(partition.primaryIdx, cellCount) && !ocean[partition.primaryIdx]) {
      inDegree[partition.primaryIdx] += 1
    }
    if (
      isInGridCell(partition.secondaryIdx, cellCount) &&
      partition.secondaryIdx !== partition.primaryIdx &&
      partition.secondaryFraction > 0 &&
      !ocean[partition.secondaryIdx]
    ) {
      inDegree[partition.secondaryIdx] += 1
    }
  }

  const flowAccumulation = new Float32Array(cellCount)
  /** @type {number[]} */
  const queue = []

  for (let i = 0; i < cellCount; i += 1) {
    flowAccumulation[i] = ocean[i] ? 0 : cellRunoff[i]
    if (!ocean[i] && inDegree[i] === 0) {
      queue.push(i)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head]
    head += 1
    const total = flowAccumulation[idx]
    const partition = partitions[idx]

    if (isInGridCell(partition.primaryIdx, cellCount) && partition.primaryFraction > 0) {
      sendFlow(
        total * partition.primaryFraction,
        partition.primaryIdx,
        cellCount,
        ocean,
        inDegree,
        flowAccumulation,
        queue,
      )
    }
    if (isInGridCell(partition.secondaryIdx, cellCount) && partition.secondaryFraction > 0) {
      sendFlow(
        total * partition.secondaryFraction,
        partition.secondaryIdx,
        cellCount,
        ocean,
        inDegree,
        flowAccumulation,
        queue,
      )
    }
  }

  return { flowDirection, flowAccumulation, ocean }
}

/**
 * @param {number} idx
 * @param {number} cellCount
 */
function isInGridCell(idx, cellCount) {
  return idx >= 0 && idx < cellCount
}

/**
 * @param {number} amount
 * @param {number} downstream
 * @param {number} cellCount
 * @param {boolean[]} ocean
 * @param {Int16Array} inDegree
 * @param {Float32Array} flowAccumulation
 * @param {number[]} queue
 */
function sendFlow(amount, downstream, cellCount, ocean, inDegree, flowAccumulation, queue) {
  if (!isInGridCell(downstream, cellCount) || ocean[downstream]) return
  flowAccumulation[downstream] += amount
  inDegree[downstream] -= 1
  if (inDegree[downstream] === 0) {
    queue.push(downstream)
  }
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
  const height = flowDirection.length / width
  const x = idx % width
  const y = Math.floor(idx / width)
  const nx = x + D8_OFFSETS[dir][0]
  const ny = y + D8_OFFSETS[dir][1]
  if (nx < 0 || ny < 0 || nx >= width || ny >= height) return -1
  return ny * width + nx
}

export { D8_OFFSETS }
