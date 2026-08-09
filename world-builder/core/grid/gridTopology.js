import { isOceanCell } from '../fields/applyClosedIslandRim.js'

export const D4_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

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

export const D8_DIST = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2]

const COAST_DISTANCE_ORTH = 1
const COAST_DISTANCE_DIAG = 1.41421356237

/**
 * @param {number} value
 * @param {number} [min]
 * @param {number} [max]
 */
export function clamp01(value, min = 0, max = 1) {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
export function isInBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
export function cellIndex(x, y, width) {
  return y * width + x
}

/**
 * @param {(x: number, y: number, idx: number) => void} visit
 */
export function forEachCell(width, height, visit) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      visit(x, y, cellIndex(x, y, width))
    }
  }
}

/**
 * @param {number} idx
 * @param {number} width
 */
export function cellX(idx, width) {
  return idx % width
}

/**
 * @param {number} idx
 * @param {number} width
 */
export function cellY(idx, width) {
  return Math.floor(idx / width)
}

/**
 * @param {(nx: number, ny: number, nIdx: number) => void} visit
 */
export function forEachNeighbor4(x, y, width, height, visit) {
  for (const [dx, dy] of D4_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    if (!isInBounds(nx, ny, width, height)) continue
    visit(nx, ny, cellIndex(nx, ny, width))
  }
}

/**
 * @param {(nx: number, ny: number, nIdx: number) => void} visit
 */
export function forEachNeighbor8(x, y, width, height, visit) {
  for (const [dx, dy] of D8_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    if (!isInBounds(nx, ny, width, height)) continue
    visit(nx, ny, cellIndex(nx, ny, width))
  }
}

/**
 * @param {Uint8Array | boolean[]} mask
 * @param {number} width
 * @param {number} height
 * @param {4 | 8} [connectivity]
 * @returns {number[][]}
 */
export function collectConnectedComponents(mask, width, height, connectivity = 4) {
  /** @type {number[][]} */
  const components = []
  const visited = new Uint8Array(mask.length)
  const visitNeighbor = connectivity === 8 ? forEachNeighbor8 : forEachNeighbor4

  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || visited[idx]) continue

    /** @type {number[]} */
    const cells = []
    const stack = [idx]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined || visited[current] || !mask[current]) continue
      visited[current] = 1
      cells.push(current)

      const x = cellX(current, width)
      const y = cellY(current, width)
      visitNeighbor(x, y, width, height, (nx, ny, nIdx) => {
        stack.push(nIdx)
      })
    }

    components.push(cells)
  }

  return components
}

/**
 * @param {Uint8Array | boolean[]} mask
 * @param {number} width
 * @param {number} height
 * @param {4 | 8} [connectivity]
 * @returns {{ labels: Int32Array, componentCount: number }}
 */
export function labelConnectedComponents(mask, width, height, connectivity = 4) {
  const labels = new Int32Array(mask.length).fill(-1)
  const visitNeighbor = connectivity === 8 ? forEachNeighbor8 : forEachNeighbor4
  let componentCount = 0

  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || labels[idx] >= 0) continue

    const stack = [idx]
    labels[idx] = componentCount
    while (stack.length > 0) {
      const current = stack.pop()
      const x = cellX(current, width)
      const y = cellY(current, width)
      visitNeighbor(x, y, width, height, (nx, ny, nIdx) => {
        if (!mask[nIdx] || labels[nIdx] >= 0) return
        labels[nIdx] = componentCount
        stack.push(nIdx)
      })
    }

    componentCount += 1
  }

  return { labels, componentCount }
}

/**
 * Two-pass chamfer distance from each land cell to the nearest ocean cell.
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} seaLevel
 * @returns {Float32Array}
 */
export function computeLandCoastDistance(elevation, width, height, seaLevel) {
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const distances = new Float32Array(width * height)

  for (let i = 0; i < elevation.length; i += 1) {
    distances[i] = ocean[i] ? 0 : Number.POSITIVE_INFINITY
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = cellIndex(x, y, width)
      if (ocean[idx]) continue

      let best = distances[idx]
      if (x > 0) {
        best = Math.min(best, distances[idx - 1] + COAST_DISTANCE_ORTH)
      }
      if (y > 0) {
        best = Math.min(best, distances[idx - width] + COAST_DISTANCE_ORTH)
      }
      if (x > 0 && y > 0) {
        best = Math.min(best, distances[idx - width - 1] + COAST_DISTANCE_DIAG)
      }
      if (x < width - 1 && y > 0) {
        best = Math.min(best, distances[idx - width + 1] + COAST_DISTANCE_DIAG)
      }
      distances[idx] = best
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const idx = cellIndex(x, y, width)
      if (ocean[idx]) continue

      let best = distances[idx]
      if (x < width - 1) {
        best = Math.min(best, distances[idx + 1] + COAST_DISTANCE_ORTH)
      }
      if (y < height - 1) {
        best = Math.min(best, distances[idx + width] + COAST_DISTANCE_ORTH)
      }
      if (x < width - 1 && y < height - 1) {
        best = Math.min(best, distances[idx + width + 1] + COAST_DISTANCE_DIAG)
      }
      if (x > 0 && y < height - 1) {
        best = Math.min(best, distances[idx + width - 1] + COAST_DISTANCE_DIAG)
      }
      distances[idx] = best
    }
  }

  return distances
}

/**
 * Maximum absolute elevation delta to any Moore neighbor.
 * @param {Float32Array} elevation
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
export function localSlopeMaxAbsDelta(elevation, x, y, width, height) {
  const idx = cellIndex(x, y, width)
  const center = elevation[idx]
  let maxDelta = 0

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (!isInBounds(nx, ny, width, height)) continue
      const delta = Math.abs(elevation[cellIndex(nx, ny, width)] - center)
      if (delta > maxDelta) maxDelta = delta
    }
  }

  return maxDelta
}

/**
 * Maximum downhill gradient to any Moore neighbor, normalized by distance.
 * @param {Float32Array} elevation
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 */
export function localSlopeMaxDropPerDistance(elevation, idx, width, height) {
  const x = cellX(idx, width)
  const y = cellY(idx, width)
  const center = elevation[idx]
  let maxDrop = 0

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (!isInBounds(nx, ny, width, height)) continue
      const neighbor = elevation[cellIndex(nx, ny, width)]
      const drop = center - neighbor
      const distance = Math.hypot(dx, dy)
      maxDrop = Math.max(maxDrop, drop / distance)
    }
  }

  return Math.max(maxDrop, 0)
}

/**
 * @param {number} cellIdx
 * @param {number} otherIdx
 * @param {number} width
 */
export function manhattanAdjacent(cellIdx, otherIdx, width) {
  const x = cellX(cellIdx, width)
  const y = cellY(cellIdx, width)
  const ox = cellX(otherIdx, width)
  const oy = cellY(otherIdx, width)
  return Math.abs(x - ox) + Math.abs(y - oy) === 1
}

/**
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {number} width
 */
export function cellDistance(fromIdx, toIdx, width) {
  const fx = cellX(fromIdx, width)
  const fy = cellY(fromIdx, width)
  const tx = cellX(toIdx, width)
  const ty = cellY(toIdx, width)
  return Math.hypot(tx - fx, ty - fy)
}
