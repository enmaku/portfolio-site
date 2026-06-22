import {
  canDrainIntoRimCell,
  isRimCell,
} from '../fields/applyClosedIslandRim.js'

/** Legacy D8 direction indices used across hydrology graph tracing. */
export const D8_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

const LEGACY_D8_DIST = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2]

/** Clockwise facet ring from east for Tarboton D-infinity. */
const FACET_OFFSETS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]

const FACET_DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2]

/** @type {Map<string, number>} */
const LEGACY_DIR_BY_OFFSET = new Map(
  D8_OFFSETS.map((offset, index) => [`${offset[0]},${offset[1]}`, index]),
)

const PI_OVER_4 = Math.PI / 4

/** Cells with D8 upslope area at or below this use pure D8 routing. */
export const D8_FALLBACK_MAX_AREA = 1

/**
 * @typedef {Object} FlowPartition
 * @property {number} primaryDir D8 direction index for the dominant downstream neighbor
 * @property {number} primaryIdx flat index of primary downstream cell
 * @property {number} primaryFraction flux fraction to primary downstream
 * @property {number} secondaryDir D8 direction index for secondary downstream, or -1
 * @property {number} secondaryIdx flat index of secondary downstream, or -1
 * @property {number} secondaryFraction flux fraction to secondary downstream
 */

/**
 * @param {number} dx
 * @param {number} dy
 * @returns {number}
 */
function legacyDirFromOffset(dx, dy) {
  return LEGACY_DIR_BY_OFFSET.get(`${dx},${dy}`) ?? -1
}

/**
 * Tarboton D∞ facet slope for neighbors k and k+1 (mod 8).
 * @param {number} centerElev
 * @param {number} elev1
 * @param {number} elev2
 * @param {number} dist1
 * @param {number} dist2
 * @returns {{ magnitude: number, r: number } | null}
 */
export function facetSlope(centerElev, elev1, elev2, dist1, dist2) {
  let s1 = (centerElev - elev1) / dist1
  let s2 = (centerElev - elev2) / dist2
  if (s1 < 0) s1 = 0
  if (s2 < 0) s2 = 0
  if (s1 === 0 && s2 === 0) return null
  const magnitude = Math.hypot(s1, s2)
  const r = Math.max(0, Math.min(1, Math.atan2(s2, s1) / PI_OVER_4))
  return { magnitude, r }
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {boolean[]} params.ocean
 * @param {number} [params.seaLevel]
 * @returns {FlowPartition[]}
 */
export function computeFlowPartitions({
  elevation,
  width,
  height,
  ocean,
  seaLevel,
}) {
  const cellCount = width * height
  /** @type {FlowPartition[]} */
  const partitions = new Array(cellCount)
  /** @type {Int16Array} */
  const d8Direction = new Int16Array(cellCount).fill(-1)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (ocean[idx]) {
        partitions[idx] = emptyPartition()
        continue
      }

      let steepestDrop = 0
      let steepestDir = -1
      let bestMagnitude = 0
      let bestFacet = -1
      let bestR = 0

      for (let legacyDir = 0; legacyDir < D8_OFFSETS.length; legacyDir += 1) {
        const elev = legacyNeighborElevation(
          elevation,
          width,
          height,
          x,
          y,
          legacyDir,
          ocean,
          seaLevel,
          idx,
        )
        if (elev === null) continue
        const drop = (elevation[idx] - elev) / LEGACY_D8_DIST[legacyDir]
        if (drop > steepestDrop) {
          steepestDrop = drop
          steepestDir = legacyDir
        }
      }

      for (let facet = 0; facet < FACET_OFFSETS.length; facet += 1) {
        const n1 = facet
        const n2 = (facet + 1) % FACET_OFFSETS.length
        const elev1 = facetNeighborElevation(
          elevation,
          width,
          height,
          x,
          y,
          n1,
          ocean,
          seaLevel,
          idx,
        )
        const elev2 = facetNeighborElevation(
          elevation,
          width,
          height,
          x,
          y,
          n2,
          ocean,
          seaLevel,
          idx,
        )
        if (elev1 === null || elev2 === null) continue

        const slope = facetSlope(
          elevation[idx],
          elev1,
          elev2,
          FACET_DIST[n1],
          FACET_DIST[n2],
        )
        if (!slope) continue

        if (slope.magnitude > bestMagnitude) {
          bestMagnitude = slope.magnitude
          bestFacet = facet
          bestR = slope.r
        }
      }

      d8Direction[idx] = steepestDir

      if (bestFacet < 0) {
        partitions[idx] = emptyPartition()
        continue
      }

      const primaryOffset = FACET_OFFSETS[bestFacet]
      const secondaryOffset = FACET_OFFSETS[(bestFacet + 1) % FACET_OFFSETS.length]
      partitions[idx] = buildPartition(
        x,
        y,
        width,
        height,
        legacyDirFromOffset(primaryOffset[0], primaryOffset[1]),
        legacyDirFromOffset(secondaryOffset[0], secondaryOffset[1]),
        1 - bestR,
        bestR,
      )
    }
  }

  applyD8Fallback(partitions, d8Direction, width, height, ocean)
  return partitions
}

/**
 * @returns {FlowPartition}
 */
function emptyPartition() {
  return {
    primaryDir: -1,
    primaryIdx: -1,
    primaryFraction: 0,
    secondaryDir: -1,
    secondaryIdx: -1,
    secondaryFraction: 0,
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} primaryDir
 * @param {number} secondaryDir
 * @param {number} primaryFraction
 * @param {number} secondaryFraction
 * @returns {FlowPartition}
 */
function buildPartition(
  x,
  y,
  width,
  height,
  primaryDir,
  secondaryDir,
  primaryFraction,
  secondaryFraction,
) {
  const primaryIdx = legacyNeighborIndex(x, y, width, height, primaryDir)
  const secondaryIdx = legacyNeighborIndex(x, y, width, height, secondaryDir)
  return {
    primaryDir,
    primaryIdx,
    primaryFraction,
    secondaryDir,
    secondaryIdx,
    secondaryFraction,
  }
}

/**
 * @param {FlowPartition[]} partitions
 * @param {Int16Array} d8Direction
 * @param {number} width
 * @param {number} height
 * @param {boolean[]} ocean
 */
function applyD8Fallback(partitions, d8Direction, width, height, ocean) {
  const cellCount = width * height
  const upslopeArea = computeD8UpslopeArea(d8Direction, width, height, ocean)

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || upslopeArea[idx] > D8_FALLBACK_MAX_AREA) continue
    const dir = d8Direction[idx]
    if (dir < 0) {
      partitions[idx] = emptyPartition()
      continue
    }
    const x = idx % width
    const y = Math.floor(idx / width)
    partitions[idx] = buildPartition(x, y, width, height, dir, -1, 1, 0)
    partitions[idx].secondaryDir = -1
    partitions[idx].secondaryIdx = -1
    partitions[idx].secondaryFraction = 0
  }
}

/**
 * @param {Int16Array} d8Direction
 * @param {number} width
 * @param {number} height
 * @param {boolean[]} ocean
 * @returns {Int32Array}
 */
function computeD8UpslopeArea(d8Direction, width, height, ocean) {
  const cellCount = width * height
  const inDegree = new Int16Array(cellCount)
  const upslopeArea = new Int32Array(cellCount)

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    upslopeArea[idx] = 1
    const dir = d8Direction[idx]
    if (dir < 0) continue
    const x = idx % width
    const y = Math.floor(idx / width)
    const downstream = legacyNeighborIndex(x, y, width, height, dir)
    if (downstream >= 0 && !ocean[downstream]) {
      inDegree[downstream] += 1
    }
  }

  /** @type {number[]} */
  const queue = []
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!ocean[idx] && inDegree[idx] === 0) {
      queue.push(idx)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head]
    head += 1
    const dir = d8Direction[idx]
    if (dir < 0) continue
    const x = idx % width
    const y = Math.floor(idx / width)
    const downstream = legacyNeighborIndex(x, y, width, height, dir)
    if (downstream < 0 || ocean[downstream]) continue
    upslopeArea[downstream] += upslopeArea[idx]
    inDegree[downstream] -= 1
    if (inDegree[downstream] === 0) {
      queue.push(downstream)
    }
  }

  return upslopeArea
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} facetDir
 * @param {boolean[]} ocean
 * @param {number | undefined} seaLevel
 * @param {number} idx
 * @returns {number | null}
 */
function facetNeighborElevation(elevation, width, height, x, y, facetDir, ocean, seaLevel, idx) {
  const offset = FACET_OFFSETS[facetDir]
  return sampleNeighborElevation(
    elevation,
    width,
    height,
    x,
    y,
    offset[0],
    offset[1],
    ocean,
    seaLevel,
    idx,
  )
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} legacyDir
 * @param {boolean[]} ocean
 * @param {number | undefined} seaLevel
 * @param {number} idx
 * @returns {number | null}
 */
function legacyNeighborElevation(
  elevation,
  width,
  height,
  x,
  y,
  legacyDir,
  ocean,
  seaLevel,
  idx,
) {
  const offset = D8_OFFSETS[legacyDir]
  return sampleNeighborElevation(
    elevation,
    width,
    height,
    x,
    y,
    offset[0],
    offset[1],
    ocean,
    seaLevel,
    idx,
  )
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} dx
 * @param {number} dy
 * @param {boolean[]} ocean
 * @param {number | undefined} seaLevel
 * @param {number} idx
 * @returns {number | null}
 */
function sampleNeighborElevation(
  elevation,
  width,
  height,
  x,
  y,
  dx,
  dy,
  ocean,
  seaLevel,
  idx,
) {
  const nx = x + dx
  const ny = y + dy
  if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
    if (
      seaLevel !== undefined &&
      isRimCell(idx, width, height) &&
      !canDrainIntoRimCell(elevation[idx], seaLevel)
    ) {
      return null
    }
    return elevation[idx]
  }
  const nIdx = ny * width + nx
  return elevation[nIdx]
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} legacyDir
 * @returns {number}
 */
function legacyNeighborIndex(x, y, width, height, legacyDir) {
  if (legacyDir < 0) return -1
  const nx = x + D8_OFFSETS[legacyDir][0]
  const ny = y + D8_OFFSETS[legacyDir][1]
  if (nx < 0 || ny < 0 || nx >= width || ny >= height) return -1
  return ny * width + nx
}

/**
 * @param {FlowPartition[]} partitions
 * @returns {Int16Array}
 */
export function partitionsToFlowDirection(partitions) {
  const flowDirection = new Int16Array(partitions.length).fill(-1)
  for (let i = 0; i < partitions.length; i += 1) {
    flowDirection[i] = partitions[i].primaryDir
  }
  return flowDirection
}
