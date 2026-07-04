/** Random bearings to try when the picked cell is visited or out of bounds. */
export const EXPLORATION_TARGET_ATTEMPTS = 12

/**
 * Pick an unvisited cell by choosing a random bearing and distance within the
 * settlement's exploration horizon. Explorers do not survey or rank the map.
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
  const minDistance = Math.max(1, Math.floor(horizon * 0.2))

  for (let attempt = 0; attempt < EXPLORATION_TARGET_ATTEMPTS; attempt += 1) {
    const bearing = random() * Math.PI * 2
    const distance = minDistance + random() * Math.max(0, horizon - minDistance)
    const x = Math.round(settlement.x + Math.cos(bearing) * distance)
    const y = Math.round(settlement.y + Math.sin(bearing) * distance)
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue
    if (visitRaster[y * gridWidth + x] === 1) continue
    return { x, y }
  }

  return null
}
