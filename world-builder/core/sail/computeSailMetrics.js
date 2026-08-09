import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import {
  cellX,
  cellY,
  collectConnectedComponents,
  forEachNeighbor8,
} from '../grid/gridTopology.js'

/**
 * @typedef {Object} SailMetrics
 * @property {number} largestComponentCellCount
 * @property {boolean} hasCoastalRiverAccess
 * @property {number} coastToInteriorPathLength
 */

/**
 * @param {Uint8Array} mask
 * @param {Object} context
 * @param {Float32Array} context.elevation
 * @param {Uint8Array} [context.lakeMask]
 * @param {Uint8Array} [context.riverCorridorMask]
 * @param {number} context.gridWidth
 * @param {number} context.gridHeight
 * @param {number} [context.seaLevel]
 * @returns {SailMetrics}
 */
export function computeSailMetrics(
  mask,
  { elevation, lakeMask, riverCorridorMask, gridWidth, gridHeight, seaLevel = SEA_LEVEL },
) {
  const cellCount = gridWidth * gridHeight
  const ocean = isOceanCell(elevation, gridWidth, gridHeight, seaLevel)
  const inlandWaterSource = new Uint8Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    if (elevation[i] < seaLevel) continue
    if (lakeMask?.[i] || riverCorridorMask?.[i]) {
      inlandWaterSource[i] = 1
    }
  }
  const components = collectConnectedComponents(mask, gridWidth, gridHeight, 8)

  let largestComponentCellCount = 0
  let hasCoastalRiverAccess = false
  let coastToInteriorPathLength = 0

  for (const component of components) {
    let touchesOcean = false
    let touchesInlandWaterSource = false
    /** @type {Set<number>} */
    const componentSet = new Set(component)

    for (const cellIdx of component) {
      if (ocean[cellIdx]) {
        touchesOcean = true
      }
      if (inlandWaterSource[cellIdx]) {
        touchesInlandWaterSource = true
      }
    }

    if (touchesInlandWaterSource) {
      largestComponentCellCount = Math.max(largestComponentCellCount, component.length)
    }

    if (touchesOcean && touchesInlandWaterSource) {
      hasCoastalRiverAccess = true
      const inlandReach = computeCoastToInteriorPathLength(
        componentSet,
        ocean,
        inlandWaterSource,
        gridWidth,
        gridHeight,
      )
      coastToInteriorPathLength = Math.max(coastToInteriorPathLength, inlandReach)
    }
  }

  return {
    largestComponentCellCount,
    hasCoastalRiverAccess,
    coastToInteriorPathLength,
  }
}

/**
 * Longest shortest 8-connected path from any ocean cell to any inland water source cell.
 * Uses one multi-source BFS from all ocean cells in the component.
 * @param {Set<number>} component
 * @param {Uint8Array | boolean[]} ocean
 * @param {Uint8Array} inlandWaterSource
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function computeCoastToInteriorPathLength(component, ocean, inlandWaterSource, gridWidth, gridHeight) {
  /** @type {Map<number, number>} */
  const distanceByCell = new Map()
  /** @type {number[]} */
  const queue = []

  for (const idx of component) {
    if (!ocean[idx]) continue
    distanceByCell.set(idx, 0)
    queue.push(idx)
  }

  let longest = 0
  for (let head = 0; head < queue.length; head += 1) {
    const cellIdx = queue[head]
    const distance = distanceByCell.get(cellIdx) ?? 0

    const x = cellX(cellIdx, gridWidth)
    const y = cellY(cellIdx, gridWidth)
    forEachNeighbor8(x, y, gridWidth, gridHeight, (nx, ny, nIdx) => {
      if (!component.has(nIdx) || distanceByCell.has(nIdx)) return
      distanceByCell.set(nIdx, distance + 1)
      queue.push(nIdx)
    })
  }

  for (const idx of component) {
    if (!inlandWaterSource[idx]) continue
    const distance = distanceByCell.get(idx)
    if (distance !== undefined) {
      longest = Math.max(longest, distance)
    }
  }

  return longest
}
