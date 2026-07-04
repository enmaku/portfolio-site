/** Random bearings to try when the picked cell is visited or out of bounds. */
export const EXPLORATION_TARGET_ATTEMPTS = 12

/**
 * @param {{ x: number, y: number }} settlement
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function maxEuclideanReach(settlement, gridWidth, gridHeight) {
  const maxDx = Math.max(settlement.x, gridWidth - 1 - settlement.x)
  const maxDy = Math.max(settlement.y, gridHeight - 1 - settlement.y)
  return Math.hypot(maxDx, maxDy)
}

/**
 * @param {number} horizon
 * @param {number} gridReach
 */
function explorationDistanceRange(horizon, gridReach) {
  const maxDistance = Math.min(horizon * 3, gridReach)
  let minDistance = Math.min(horizon, maxDistance)
  if (minDistance >= maxDistance) {
    minDistance = Math.max(1, Math.floor(maxDistance * 0.5))
  }
  if (minDistance >= maxDistance) {
    minDistance = 1
  }
  return { minDistance, maxDistance }
}

/**
 * Pick an unvisited cell by choosing a random bearing and distance beyond the
 * settlement haul-shed. The haul-shed is already marked visited at founding, so
 * targets must lie outside that range (up to two haul-days out).
 *
 * @param {{
 *   doc: { gridWidth: number, gridHeight: number },
 *   visitRaster: Uint8Array,
 *   settlement: { x: number, y: number },
 *   random: () => number,
 *   horizonCells: number,
 * }} params
 * @returns {{ x: number, y: number } | null}
 */
export function pickExplorationTarget(params) {
  const { doc, visitRaster, settlement, random, horizonCells } = params
  const { gridWidth, gridHeight } = doc
  const horizon = Math.max(2, horizonCells)
  const { minDistance, maxDistance } = explorationDistanceRange(
    horizon,
    maxEuclideanReach(settlement, gridWidth, gridHeight),
  )

  for (let attempt = 0; attempt < EXPLORATION_TARGET_ATTEMPTS; attempt += 1) {
    const bearing = random() * Math.PI * 2
    const distance = minDistance + random() * Math.max(0, maxDistance - minDistance)
    const x = Math.round(settlement.x + Math.cos(bearing) * distance)
    const y = Math.round(settlement.y + Math.sin(bearing) * distance)
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
    if (visitRaster[y * gridWidth + x] === 1) continue
    return { x, y }
  }

  return null
}
