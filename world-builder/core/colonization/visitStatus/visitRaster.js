import { computeHaulShedIsochrone } from '../computeHaulShedIsochrone.js'

/**
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
export function createEmptyVisitRaster(gridWidth, gridHeight) {
  return new Uint8Array(gridWidth * gridHeight)
}

/**
 * @param {Uint8Array | null | undefined} raster
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
export function resolveVisitRaster(raster, gridWidth, gridHeight) {
  const cellCount = gridWidth * gridHeight
  if (raster instanceof Uint8Array && raster.length === cellCount) {
    return new Uint8Array(raster)
  }
  return createEmptyVisitRaster(gridWidth, gridHeight)
}

/**
 * @param {Uint8Array} raster
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @returns {boolean}
 */
export function isCellVisited(raster, x, y, gridWidth) {
  return raster[y * gridWidth + x] === 1
}

/**
 * @param {Uint8Array} raster
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 */
export function markCellVisited(raster, x, y, gridWidth) {
  raster[y * gridWidth + x] = 1
}

/**
 * @param {Uint8Array} raster
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} gridWidth
 */
export function markCellsVisited(raster, cells, gridWidth) {
  for (const cell of cells) {
    markCellVisited(raster, cell.x, cell.y, gridWidth)
  }
}

/**
 * Mark a local disc around a cell as visited (logistics node survey clearing).
 *
 * @param {Uint8Array} raster
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} [radius]
 */
export function markVisitDisc(raster, x, y, gridWidth, gridHeight, radius = 1) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      markCellVisited(raster, nx, ny, gridWidth)
    }
  }
}

/**
 * Seed founding or daughter haul-shed cells as visited.
 *
 * @param {Uint8Array} raster
 * @param {{
 *   origin: { x: number, y: number },
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 *   roadCellMask?: Uint8Array | null,
 *   roadMultiplier?: number,
 * }} params
 */
export function seedHaulShedVisited(raster, params) {
  const cells = computeHaulShedIsochrone({
    origin: params.origin,
    budget: params.budget,
    gridWidth: params.gridWidth,
    gridHeight: params.gridHeight,
    movementCost: params.movementCost,
    roadCellMask: params.roadCellMask,
    roadMultiplier: params.roadMultiplier,
  })
  markCellsVisited(raster, cells, params.gridWidth)
}

/**
 * JSON-safe serialization for session persistence.
 *
 * @param {Uint8Array | null | undefined} raster
 * @returns {number[] | null}
 */
export function serializeVisitRaster(raster) {
  if (!(raster instanceof Uint8Array)) {
    return null
  }
  return Array.from(raster)
}

/**
 * @param {unknown} value
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
export function deserializeVisitRaster(value, gridWidth, gridHeight) {
  const cellCount = gridWidth * gridHeight
  if (Array.isArray(value) && value.length === cellCount) {
    const raster = new Uint8Array(cellCount)
    for (let i = 0; i < cellCount; i += 1) {
      raster[i] = value[i] === 1 ? 1 : 0
    }
    return raster
  }
  return createEmptyVisitRaster(gridWidth, gridHeight)
}
