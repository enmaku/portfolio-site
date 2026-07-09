/**
 * Count visited↔unvisited adjacency edges on a traversable mask (frontier perimeter proxy).
 *
 * @param {Uint8Array | null} visitRaster
 * @param {Uint8Array | boolean[] | null} traversableMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {number}
 */
export function computeFrontierBoundaryEdges(visitRaster, traversableMask, gridWidth, gridHeight) {
  if (!visitRaster || !traversableMask || !gridWidth || !gridHeight) {
    return 0
  }

  const cellCount = gridWidth * gridHeight
  if (visitRaster.length !== cellCount) {
    return 0
  }

  let edges = 0
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x
      if (!isTraversable(traversableMask, index)) continue

      const visited = visitRaster[index] === 1
      for (const neighbor of neighborCells4(x, y, gridWidth, gridHeight)) {
        const neighborIndex = neighbor.y * gridWidth + neighbor.x
        if (!isTraversable(traversableMask, neighborIndex)) continue
        const neighborVisited = visitRaster[neighborIndex] === 1
        if (visited !== neighborVisited) {
          edges += 1
        }
      }
    }
  }
  return edges
}

/**
 * @param {Uint8Array | boolean[]} mask
 * @param {number} index
 * @returns {boolean}
 */
function isTraversable(mask, index) {
  const value = mask[index]
  return value === 1 || value === true
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
