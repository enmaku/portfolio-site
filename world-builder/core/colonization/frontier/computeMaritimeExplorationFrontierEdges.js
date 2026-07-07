/**
 * Sail-layer exploration frontier for dispatch budgeting and maritime eligibility.
 *
 * Land expeditions mark dry land visited but not sail cells, so the generic
 * visited↔unvisited edge count on the sail mask alone is often zero even when
 * explored coastlines border unexplored rivers and ocean. This metric also
 * counts unvisited sail cells that touch visited territory.
 *
 * @param {Uint8Array | null} visitRaster
 * @param {Uint8Array | null} sailMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {number}
 */
export function computeMaritimeExplorationFrontierEdges(
  visitRaster,
  sailMask,
  gridWidth,
  gridHeight,
) {
  if (!visitRaster || !sailMask || !gridWidth || !gridHeight) {
    return 0
  }

  const cellCount = gridWidth * gridHeight
  if (visitRaster.length !== cellCount || sailMask.length !== cellCount) {
    return 0
  }

  let edges = 0
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x
      if (sailMask[index] !== 1) continue

      const visited = visitRaster[index] === 1
      for (const neighbor of neighborCells4(x, y, gridWidth, gridHeight)) {
        const neighborIndex = neighbor.y * gridWidth + neighbor.x
        if (sailMask[neighborIndex] === 1) {
          const neighborVisited = visitRaster[neighborIndex] === 1
          if (visited !== neighborVisited) {
            edges += 1
          }
          continue
        }

        if (!visited && visitRaster[neighborIndex] === 1) {
          edges += 1
        }
      }
    }
  }
  return edges
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{ x: number, y: number }>}
 */
function neighborCells4(x, y, gridWidth, gridHeight) {
  /** @type {Array<{ x: number, y: number }>} */
  const neighbors = []
  if (y > 0) neighbors.push({ x, y: y - 1 })
  if (y + 1 < gridHeight) neighbors.push({ x, y: y + 1 })
  if (x > 0) neighbors.push({ x: x - 1, y })
  if (x + 1 < gridWidth) neighbors.push({ x: x + 1, y })
  return neighbors
}
