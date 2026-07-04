/** Road cells multiply movement cost by this factor (< 1 = faster travel). */
export const DEFAULT_ROAD_MOVEMENT_MULTIPLIER = 0.5

/**
 * @typedef {Object} RoadSegment
 * @property {Array<{ x: number, y: number }>} cells
 * @property {string[]} [settlementIds]
 */

/**
 * @param {RoadSegment[] | null | undefined} roads
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
export function buildRoadCellMask(roads, gridWidth, gridHeight) {
  const mask = new Uint8Array(gridWidth * gridHeight)
  if (!Array.isArray(roads)) {
    return mask
  }
  for (const segment of roads) {
    if (!Array.isArray(segment?.cells)) continue
    for (const cell of segment.cells) {
      if (
        Number.isInteger(cell.x) &&
        Number.isInteger(cell.y) &&
        cell.x >= 0 &&
        cell.y >= 0 &&
        cell.x < gridWidth &&
        cell.y < gridHeight
      ) {
        mask[cell.y * gridWidth + cell.x] = 1
      }
    }
  }
  return mask
}

/**
 * @param {RoadSegment[] | null | undefined} roads
 * @param {Array<{ x: number, y: number }>} pathCells
 * @param {string[]} [settlementIds]
 * @returns {RoadSegment[]}
 */
export function appendRoadSegment(roads, pathCells, settlementIds = []) {
  const next = Array.isArray(roads) ? [...roads] : []
  if (!Array.isArray(pathCells) || pathCells.length === 0) {
    return next
  }
  next.push({
    cells: pathCells.map((cell) => ({ x: cell.x, y: cell.y })),
    settlementIds: [...settlementIds],
  })
  return next
}

/**
 * @param {unknown} value
 * @returns {RoadSegment[]}
 */
export function resolveRoadSegments(value) {
  if (!Array.isArray(value)) {
    return []
  }
  /** @type {RoadSegment[]} */
  const resolved = []
  for (const segment of value) {
    if (!segment || typeof segment !== 'object') continue
    const record = /** @type {RoadSegment} */ (segment)
    if (!Array.isArray(record.cells)) continue
    resolved.push({
      cells: record.cells
        .filter((cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
        .map((cell) => ({ x: /** @type {number} */ (cell.x), y: /** @type {number} */ (cell.y) })),
      settlementIds: Array.isArray(record.settlementIds) ? [...record.settlementIds] : [],
    })
  }
  return resolved
}
