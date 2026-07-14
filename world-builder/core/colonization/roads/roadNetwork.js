/** Road cells multiply movement cost by this factor (< 1 = faster travel). */
export const DEFAULT_ROAD_MOVEMENT_MULTIPLIER = 0.5

/**
 * @typedef {Object} RoadSegment
 * @property {Array<{ x: number, y: number }>} cells
 * @property {string[]} [settlementIds]
 * @property {'land' | 'inland_sail' | 'open_sea'} [mode] Missing mode resolves as land route for backward compatibility.
 */

/** @typedef {'land' | 'inland_sail' | 'open_sea'} RouteSegmentMode */

/**
 * @param {unknown} mode
 * @returns {RouteSegmentMode}
 */
export function resolveRouteSegmentMode(mode) {
  if (mode === 'open_sea') return 'open_sea'
  if (mode === 'inland_sail' || mode === 'sail') return 'inland_sail'
  return 'land'
}

/**
 * @param {RoadSegment[] | null | undefined} roads
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {{ landOnly?: boolean }} [options]
 * @returns {Uint8Array}
 */
function buildRouteCellMaskInternal(roads, gridWidth, gridHeight, options = {}) {
  const mask = new Uint8Array(gridWidth * gridHeight)
  if (!Array.isArray(roads)) {
    return mask
  }
  for (const segment of roads) {
    if (!Array.isArray(segment?.cells)) continue
    if (options.landOnly && segment.mode !== undefined && segment.mode !== 'land') continue
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
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
export function buildRoadCellMask(roads, gridWidth, gridHeight) {
  return buildRouteCellMaskInternal(roads, gridWidth, gridHeight)
}

/**
 * Land route cells only — used for movement cost, haul-shed, and primary claim bonuses.
 *
 * @param {RoadSegment[] | null | undefined} roads
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8Array}
 */
export function buildLandRouteCellMask(roads, gridWidth, gridHeight) {
  return buildRouteCellMaskInternal(roads, gridWidth, gridHeight, { landOnly: true })
}

/**
 * @param {RoadSegment[] | null | undefined} roads
 * @param {Array<{ x: number, y: number }>} pathCells
 * @param {string[]} [settlementIds]
 * @param {'land' | 'inland_sail' | 'open_sea' | 'sail'} [mode]
 * @returns {RoadSegment[]}
 */
export function appendRoadSegment(roads, pathCells, settlementIds = [], mode = 'land') {
  const next = Array.isArray(roads) ? [...roads] : []
  if (!Array.isArray(pathCells) || pathCells.length === 0) {
    return next
  }
  next.push({
    cells: pathCells.map((cell) => ({ x: cell.x, y: cell.y })),
    settlementIds: [...settlementIds],
    mode: resolveRouteSegmentMode(mode),
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
      mode: resolveRouteSegmentMode(record.mode),
    })
  }
  return resolved
}
