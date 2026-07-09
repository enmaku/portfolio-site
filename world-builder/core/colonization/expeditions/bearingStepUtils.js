/** @typedef {'blocked' | 'range_cap' | 'survey_complete' | 'founded'} ExpeditionEndReason */

/**
 * @param {number} radians
 * @returns {number}
 */
export function normalizeBearingRadians(radians) {
  const twoPi = Math.PI * 2
  let value = radians % twoPi
  if (value < 0) value += twoPi
  return value
}

/**
 * @param {number} fromBearing
 * @param {number} toBearing
 * @returns {number}
 */
export function bearingAlignmentDelta(fromBearing, toBearing) {
  const delta = Math.abs(normalizeBearingRadians(toBearing) - normalizeBearingRadians(fromBearing))
  return Math.min(delta, Math.PI * 2 - delta)
}

/**
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @returns {number}
 */
export function stepBearingRadians(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/**
 * @param {{ x: number, y: number }} center
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{ x: number, y: number }>}
 */
export function neighborCells8(center, gridWidth, gridHeight) {
  /** @type {Array<{ x: number, y: number }>} */
  const neighbors = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = center.x + dx
      const ny = center.y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      neighbors.push({ x: nx, y: ny })
    }
  }
  return neighbors
}

/**
 * @param {Uint8Array} visitRaster
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @returns {boolean}
 */
export function isVisitRasterCellVisited(visitRaster, x, y, gridWidth) {
  return visitRaster[y * gridWidth + x] === 1
}
