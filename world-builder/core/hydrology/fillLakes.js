import { SEA_LEVEL } from '../biomeIds.js'
import { minLakeAreaForGrid } from '../types.js'
import { DEFAULT_BREACH_THRESHOLD } from '../worldGenerationOptions.js'
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
 * Depression-fill lakes via priority-flood, then hybrid breach-and-fill for closed basins.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {boolean[]} params.ocean
 * @param {number} [params.seaLevel]
 * @param {number} [params.minLakeAreaScale]
 * @param {number} [params.breachThreshold]
 * @param {boolean} [params.useDryFloorInitialLevel]
 * @returns {{
 *   lakeMask: Uint8Array,
 *   lakes: import('../types.js').LakeRecord[],
 *   lakeMeta: import('../types.js').LakeMetaRecord[],
 *   filledElevation: Float32Array,
 *   spillOutlet: Int32Array,
 *   lakeIdByCell: Int32Array,
 *   basinCellsByLake: number[][],
 *   breachCount: number,
 *   endorheicCount: number,
 * }}
 */
export function fillLakes({
  elevation,
  width,
  height,
  ocean,
  seaLevel = SEA_LEVEL,
  minLakeAreaScale = 1,
  breachThreshold = DEFAULT_BREACH_THRESHOLD,
  useDryFloorInitialLevel = false,
}) {
  const cellCount = width * height
  const { filledElevation, spillOutlet } = priorityFloodFill({
    elevation,
    width,
    height,
    ocean,
    seaLevel,
  })
  const lakeMask = new Uint8Array(cellCount)
  const lakeIdByCell = new Int32Array(cellCount).fill(-1)
  const lakes = []
  const lakeMeta = []
  /** @type {number[][]} */
  const basinCellsByLake = []
  const minArea = Math.max(1, Math.round(minLakeAreaForGrid(width) * minLakeAreaScale))
  const processed = new Uint8Array(cellCount)
  let breachCount = 0
  let endorheicCount = 0

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || processed[idx] || filledElevation[idx] <= elevation[idx] + FILL_EPSILON) {
      continue
    }

    const basin = collectFilledBasin({
      elevation,
      filledElevation,
      ocean,
      processed,
      width,
      height,
      startIdx: idx,
    })
    if (basin.cells.length < minArea) continue

    const spillsToOcean = basinSpillsToOcean(basin.cells, spillOutlet, ocean)
    const floorElev = basin.cells.reduce(
      (min, cellIdx) => Math.min(min, elevation[cellIdx]),
      Number.POSITIVE_INFINITY,
    )
    const pitCells = basin.cells.filter(
      (cellIdx) => elevation[cellIdx] <= floorElev + FILL_EPSILON,
    )
    const { outletIdx, saddleElev, spillDepth } = findBasinSaddle(
      pitCells.length > 0 ? pitCells : basin.cells,
      elevation,
      width,
      height,
    )
    const spillElev =
      outletIdx >= 0 ? saddleElev : basin.cells.reduce(
        (max, cellIdx) => Math.max(max, filledElevation[cellIdx]),
        Number.NEGATIVE_INFINITY,
      )
    const basinDepth = spillElev - floorElev
    const spillRatio =
      basinDepth > FILL_EPSILON && outletIdx >= 0 ? spillDepth / basinDepth : 0
    const shouldBreach =
      outletIdx >= 0 && !spillsToOcean && spillRatio <= breachThreshold + FILL_EPSILON
    const initialSurfaceElev =
      useDryFloorInitialLevel && !shouldBreach && !spillsToOcean
        ? floorElev
        : shouldBreach
          ? floorElev
          : spillElev

    if (shouldBreach) {
      for (const cellIdx of basin.cells) {
        filledElevation[cellIdx] = elevation[cellIdx]
      }
      filledElevation[outletIdx] = Math.min(floorElev, saddleElev) - BREACH_EPSILON
      breachCount += 1
    } else if (!spillsToOcean) {
      for (const cellIdx of basin.cells) {
        lakeMask[cellIdx] = 1
        filledElevation[cellIdx] = initialSurfaceElev
      }
      if (outletIdx >= 0) {
        endorheicCount += 1
      }
    } else {
      for (const cellIdx of basin.cells) {
        lakeMask[cellIdx] = 1
        filledElevation[cellIdx] = useDryFloorInitialLevel ? initialSurfaceElev : spillElev
      }
    }

    const lakeId = lakes.length
    for (const cellIdx of basin.cells) {
      if (lakeMask[cellIdx]) {
        lakeIdByCell[cellIdx] = lakeId
      }
    }
    basinCellsByLake.push([...basin.cells])

    const endorheic = !shouldBreach && !spillsToOcean && outletIdx >= 0
    const outletX = shouldBreach ? outletIdx % width : undefined
    const outletY = shouldBreach ? Math.floor(outletIdx / width) : undefined
    const spillOutletIdx = findPrioritySpillOutlet(basin.cells, spillOutlet, filledElevation)
    const spillX =
      spillsToOcean && spillOutletIdx >= 0 ? spillOutletIdx % width : undefined
    const spillY =
      spillsToOcean && spillOutletIdx >= 0 ? Math.floor(spillOutletIdx / width) : undefined

    lakes.push({
      id: lakes.length,
      area: basin.cells.length,
      endorheic,
      spillX,
      spillY,
    })
    lakeMeta.push({
      endorheic,
      surfaceElevation: initialSurfaceElev,
      floorElevation: floorElev,
      spillElevation: outletIdx >= 0 ? saddleElev : spillElev,
      waterLevel: initialSurfaceElev,
      outletX: shouldBreach ? outletX : undefined,
      outletY: shouldBreach ? outletY : undefined,
    })
  }

  return {
    lakeMask,
    lakes,
    lakeMeta,
    filledElevation,
    spillOutlet,
    lakeIdByCell,
    basinCellsByLake,
    breachCount,
    endorheicCount,
  }
}

/**
 * @param {number[]} basinCells
 * @param {Int32Array} spillOutlet
 * @param {boolean[]} ocean
 */
function basinSpillsToOcean(basinCells, spillOutlet, ocean) {
  return basinCells.some((cellIdx) => {
    const outlet = spillOutlet[cellIdx]
    return outlet >= 0 && ocean[outlet]
  })
}

/**
 * Lowest saddle on the basin rim and spill depth to the highest neighboring rim cell.
 * @param {number[]} seedCells
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 */
function findBasinSaddle(seedCells, elevation, width, height) {
  const seedSet = new Set(seedCells)
  let outletIdx = -1
  let saddleElev = Number.POSITIVE_INFINITY
  let maxBorderElev = Number.NEGATIVE_INFINITY

  for (const cellIdx of seedCells) {
    const x = cellIdx % width
    const y = Math.floor(cellIdx / width)
    for (const [dx, dy] of D4_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighborIdx = ny * width + nx
      if (seedSet.has(neighborIdx)) continue

      const neighborElev = elevation[neighborIdx]
      maxBorderElev = Math.max(maxBorderElev, neighborElev)
      if (neighborElev < saddleElev) {
        saddleElev = neighborElev
        outletIdx = neighborIdx
      }
    }
  }

  const spillDepth = outletIdx >= 0 ? maxBorderElev - saddleElev : Number.POSITIVE_INFINITY
  return { outletIdx, saddleElev, spillDepth }
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
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.filledElevation
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.processed
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.startIdx
 */
function collectFilledBasin({
  elevation,
  filledElevation,
  ocean,
  processed,
  width,
  height,
  startIdx,
}) {
  const cells = []
  const stack = [startIdx]
  const localVisited = new Set()

  while (stack.length > 0) {
    const idx = stack.pop()
    if (localVisited.has(idx) || ocean[idx]) continue
    if (filledElevation[idx] <= elevation[idx] + FILL_EPSILON) continue

    localVisited.add(idx)
    processed[idx] = 1
    cells.push(idx)

    const x = idx % width
    const y = Math.floor(idx / width)
    for (const [dx, dy] of D4_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      stack.push(ny * width + nx)
    }
  }

  return { cells }
}
