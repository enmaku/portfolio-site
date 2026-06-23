import { SEA_LEVEL } from '../biomeIds.js'
import { priorityFloodFill } from './priorityFloodFill.js'

const FILL_EPSILON = 1e-5
const BREACH_EPSILON = 1e-4

const D4_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * Post-incision lake equilibrium: flatten disturbed lake surfaces, refresh spill edges,
 * and keep breached/endorheic metadata consistent with the elevation layer.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.lakeMask
 * @param {import('../types.js').LakeRecord[]} params.lakes
 * @param {import('../types.js').LakeMetaRecord[]} params.lakeMeta
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {{
 *   elevation: Float32Array,
 *   lakes: import('../types.js').LakeRecord[],
 *   lakeMeta: import('../types.js').LakeMetaRecord[],
 *   spillOutlet: Int32Array,
 * }}
 */
export function settleLakeEquilibrium({
  elevation,
  lakeMask,
  lakes,
  lakeMeta,
  ocean,
  width,
  height,
  seaLevel = SEA_LEVEL,
}) {
  const settledElevation = new Float32Array(elevation)
  const updatedLakes = lakes.map((lake) => ({ ...lake }))
  const updatedMeta = lakeMeta.map((meta) => ({ ...meta }))
  const components = collectLakeComponents(lakeMask, width, height)
  components.sort((left, right) => Math.min(...left) - Math.min(...right))
  const componentLakeIds = matchComponentsToLakeIds(
    components,
    updatedLakes,
    updatedMeta,
    elevation,
    width,
  )

  for (let i = 0; i < components.length; i += 1) {
    const cells = components[i]
    const lakeId = componentLakeIds[i]
    if (lakeId === undefined) continue
    const meta = updatedMeta[lakeId]
    const surface = meta.waterLevel ?? meta.surfaceElevation
    applyFlatSurface(settledElevation, cells, surface)
    meta.surfaceElevation = surface
  }

  const { filledElevation, spillOutlet: refreshedSpill } = priorityFloodFill({
    elevation: settledElevation,
    width,
    height,
    ocean,
    seaLevel,
  })

  for (let i = 0; i < components.length; i += 1) {
    const cells = components[i]
    const lakeId = componentLakeIds[i]
    if (lakeId === undefined) continue
    const meta = updatedMeta[lakeId]
    const lake = updatedLakes[lakeId]

    if (meta.endorheic) {
      continue
    }

    if (lake.spillX === undefined || lake.spillY === undefined) {
      continue
    }

    const spillIdx = findPrioritySpillOutlet(cells, refreshedSpill, filledElevation)
    if (spillIdx < 0) {
      continue
    }

    const surfaceElev = meta.waterLevel ?? filledElevation[cells[0]]
    applyFlatSurface(settledElevation, cells, surfaceElev)
    meta.surfaceElevation = surfaceElev
    lake.spillX = spillIdx % width
    lake.spillY = Math.floor(spillIdx / width)
    lake.endorheic = false
    meta.endorheic = false
  }

  for (let lakeId = 0; lakeId < updatedLakes.length; lakeId += 1) {
    const meta = updatedMeta[lakeId]
    if (meta.endorheic || meta.outletX === undefined || meta.outletY === undefined) {
      continue
    }

    const outletIdx = meta.outletY * width + meta.outletX
    const floorElev = localBasinFloor(settledElevation, outletIdx, width, height, lakeMask)
    settledElevation[outletIdx] = Math.min(
      settledElevation[outletIdx],
      floorElev - BREACH_EPSILON,
    )
    updatedLakes[lakeId].endorheic = false
    meta.endorheic = false
  }

  return {
    elevation: settledElevation,
    lakes: updatedLakes,
    lakeMeta: updatedMeta,
    spillOutlet: refreshedSpill,
  }
}

/**
 * Pair lake-mask components with lake records. Lake ids follow fill order, which can
 * diverge from min-cell component order when earlier basins were breached.
 * @param {number[][]} components
 * @param {import('../types.js').LakeRecord[]} lakes
 * @param {import('../types.js').LakeMetaRecord[]} lakeMeta
 * @param {Float32Array} elevation
 * @param {number} width
 * @returns {Array<number | undefined>}
 */
function matchComponentsToLakeIds(components, lakes, lakeMeta, elevation, width) {
  /** @type {Array<number | undefined>} */
  const assignments = new Array(components.length).fill(undefined)
  const usedLakeIds = new Set()

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const cells = components[componentIndex]
    const cellSet = new Set(cells)
    let matchedLakeId

    for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
      if (usedLakeIds.has(lakeId)) continue
      const lake = lakes[lakeId]
      if (lake.endorheic || lake.spillX === undefined || lake.spillY === undefined) continue
      const spillIdx = lake.spillY * width + lake.spillX
      if (isAdjacentToCells(spillIdx, cellSet, width)) {
        matchedLakeId = lakeId
        break
      }
    }

    if (matchedLakeId === undefined) {
      const meanElev = cells.reduce((sum, cellIdx) => sum + elevation[cellIdx], 0) / cells.length
      let bestDelta = Number.POSITIVE_INFINITY
      for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
        if (usedLakeIds.has(lakeId) || !lakeMeta[lakeId].endorheic) continue
        const delta = Math.abs(lakeMeta[lakeId].surfaceElevation - meanElev)
        if (delta < bestDelta || (delta === bestDelta && lakeId < (matchedLakeId ?? Number.MAX_SAFE_INTEGER))) {
          bestDelta = delta
          matchedLakeId = lakeId
        }
      }
      if (matchedLakeId === undefined) {
        bestDelta = Number.POSITIVE_INFINITY
        for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
          if (usedLakeIds.has(lakeId)) continue
          const delta = Math.abs(lakeMeta[lakeId].surfaceElevation - meanElev)
          if (delta < bestDelta || (delta === bestDelta && lakeId < (matchedLakeId ?? Number.MAX_SAFE_INTEGER))) {
            bestDelta = delta
            matchedLakeId = lakeId
          }
        }
      }
    }

    if (matchedLakeId !== undefined) {
      assignments[componentIndex] = matchedLakeId
      usedLakeIds.add(matchedLakeId)
    }
  }

  return assignments
}

/**
 * @param {number} cellIdx
 * @param {Set<number>} cellSet
 * @param {number} width
 */
function isAdjacentToCells(cellIdx, cellSet, width) {
  const x = cellIdx % width
  const y = Math.floor(cellIdx / width)
  for (const [dx, dy] of D4_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    if (cellSet.has(ny * width + nx)) return true
  }
  return false
}

/**
 * @param {Float32Array} elevation
 * @param {number[]} cells
 * @param {number} surfaceElev
 */
function applyFlatSurface(elevation, cells, surfaceElev) {
  for (const cellIdx of cells) {
    elevation[cellIdx] = surfaceElev
  }
}

/**
 * @param {Uint8Array} lakeMask
 * @param {number} width
 * @param {number} height
 * @returns {number[][]}
 */
function collectLakeComponents(lakeMask, width, height) {
  /** @type {number[][]} */
  const components = []
  const visited = new Uint8Array(lakeMask.length)

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
      for (const [dx, dy] of D4_OFFSETS) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        stack.push(ny * width + nx)
      }
    }

    components.push(cells)
  }

  return components
}

/**
 * @param {number[]} basinCells
 * @param {Int32Array} spillOutlet
 * @param {Float32Array} filledElevation
 */
function findPrioritySpillOutlet(basinCells, spillOutlet, filledElevation) {
  return basinCells.reduce((chosen, cellIdx) => {
    const candidate = spillOutlet[cellIdx]
    if (candidate < 0) return chosen
    if (chosen < 0) return candidate
    return filledElevation[candidate] < filledElevation[chosen] ? candidate : chosen
  }, -1)
}

/**
 * @param {Float32Array} elevation
 * @param {number} outletIdx
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} lakeMask
 */
function localBasinFloor(elevation, outletIdx, width, height, lakeMask) {
  const x = outletIdx % width
  const y = Math.floor(outletIdx / width)
  let floorElev = elevation[outletIdx]

  for (const [dx, dy] of D4_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const neighborIdx = ny * width + nx
    if (lakeMask[neighborIdx]) continue
    floorElev = Math.min(floorElev, elevation[neighborIdx])
  }

  return floorElev + FILL_EPSILON
}
