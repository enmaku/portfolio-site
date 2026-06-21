import { SEA_LEVEL } from '../biomeIds.js'
import { minLakeAreaForGrid } from '../types.js'

/**
 * Depression-fill lakes; ignore micro-basins below area cutoff.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {boolean[]} params.ocean
 * @param {number} [params.seaLevel]
 * @param {number} [params.minLakeAreaScale]
 * @returns {{ lakeMask: Uint8Array, lakes: import('../types.js').LakeRecord[], filledElevation: Float32Array }}
 */
export function fillLakes({ elevation, width, height, ocean, seaLevel = SEA_LEVEL, minLakeAreaScale = 1 }) {
  const cellCount = width * height
  const filled = new Float32Array(elevation)
  const lakeMask = new Uint8Array(cellCount)
  const lakes = []
  const minArea = Math.max(1, Math.round(minLakeAreaForGrid(width) * minLakeAreaScale))
  const processed = new Uint8Array(cellCount)

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || processed[idx] || !isDepressionCell(filled, ocean, width, height, idx)) {
      continue
    }

    const basin = collectBasin(filled, ocean, processed, width, height, idx)
    if (basin.cells.length < minArea) continue

    const spill = findSpillLevel(filled, ocean, basin.cells, width, height, seaLevel)
    if (!spill) continue

    for (const cellIdx of basin.cells) {
      if (filled[cellIdx] < spill.level) {
        filled[cellIdx] = spill.level
        lakeMask[cellIdx] = 1
      }
    }

    const endorheic = spill.outsideIdx < 0 || ocean[spill.outsideIdx]
    lakes.push({
      id: lakes.length,
      area: basin.cells.length,
      endorheic,
      spillX: spill.outsideIdx >= 0 ? spill.outsideIdx % width : undefined,
      spillY: spill.outsideIdx >= 0 ? Math.floor(spill.outsideIdx / width) : undefined,
    })
  }

  return { lakeMask, lakes, filledElevation: filled }
}

/**
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {number} idx
 */
function isDepressionCell(elevation, ocean, width, height, idx) {
  const elev = elevation[idx]
  const x = idx % width
  const y = Math.floor(idx / width)
  let hasHigherNeighbor = false

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (ocean[nIdx]) continue
      if (elevation[nIdx] < elev) return false
      if (elevation[nIdx] > elev) hasHigherNeighbor = true
    }
  }

  return hasHigherNeighbor
}

/**
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {Uint8Array} processed
 * @param {number} width
 * @param {number} height
 * @param {number} startIdx
 */
function collectBasin(elevation, ocean, processed, width, height, startIdx) {
  const floorElev = elevation[startIdx]
  const cells = []
  const stack = [startIdx]
  const localVisited = new Set()

  while (stack.length > 0) {
    const idx = stack.pop()
    if (localVisited.has(idx) || ocean[idx]) continue
    if (elevation[idx] > floorElev + 0.0001) continue

    localVisited.add(idx)
    processed[idx] = 1
    cells.push(idx)

    const x = idx % width
    const y = Math.floor(idx / width)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        stack.push(ny * width + nx)
      }
    }
  }

  return { cells }
}

/**
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {number[]} cells
 * @param {number} width
 * @param {number} height
 * @param {number} seaLevel
 */
function findSpillLevel(elevation, ocean, cells, width, height, seaLevel) {
  const cellSet = new Set(cells)
  let spillLevel = Infinity
  let outsideIdx = -1

  for (const idx of cells) {
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
      if (cellSet.has(nIdx)) continue
      const neighborElev = ocean[nIdx] ? seaLevel : elevation[nIdx]
      if (neighborElev < spillLevel) {
        spillLevel = neighborElev
        outsideIdx = nIdx
      }
    }
  }

  if (spillLevel === Infinity) return null
  return { level: spillLevel, outsideIdx }
}
