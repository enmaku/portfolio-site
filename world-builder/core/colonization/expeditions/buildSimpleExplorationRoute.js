import { buildOceanMask } from './expeditionRouting.js'

/**
 * @typedef {Object} SimpleExplorationRoute
 * @property {'land'} mode
 * @property {Array<{ x: number, y: number }>} cells
 */

/**
 * @param {boolean[]} ocean
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 */
function isLandCell(ocean, x, y, gridWidth) {
  return ocean[y * gridWidth + x] !== true
}

/**
 * @param {{ x: number, y: number }} current
 * @param {{ x: number, y: number }} target
 * @param {boolean[]} ocean
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {{ x: number, y: number } | null}
 */
function pickGreedyLandStep(current, target, ocean, gridWidth, gridHeight) {
  let best = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = current.x + dx
      const ny = current.y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (!isLandCell(ocean, nx, ny, gridWidth)) continue
      const distance = Math.hypot(nx - target.x, ny - target.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = { x: nx, y: ny }
      }
    }
  }

  return best
}

/**
 * Greedy land walk toward a bearing target. No grid-wide pathfinding.
 *
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} maxSteps
 * @returns {SimpleExplorationRoute | null}
 */
export function buildSimpleExplorationRoute(doc, from, to, maxSteps) {
  const { gridWidth, gridHeight } = doc
  if (!gridWidth || !gridHeight || maxSteps < 1) {
    return null
  }

  const ocean = buildOceanMask(doc)
  if (!isLandCell(ocean, from.x, from.y, gridWidth)) {
    return null
  }

  /** @type {Array<{ x: number, y: number }>} */
  const cells = [{ x: from.x, y: from.y }]
  let current = from
  const stepLimit = Math.max(2, Math.floor(maxSteps))

  for (let step = 0; step < stepLimit; step += 1) {
    if (current.x === to.x && current.y === to.y) {
      break
    }

    const next = pickGreedyLandStep(current, to, ocean, gridWidth, gridHeight)
    if (!next) {
      break
    }
    if (next.x === current.x && next.y === current.y) {
      break
    }

    cells.push(next)
    current = next
  }

  if (cells.length < 2) {
    return null
  }

  return { mode: 'land', cells }
}

/**
 * @param {Array<{ x: number, y: number }>} routeCells
 * @param {number} progressIndex
 * @param {number} cellsPerEpoch
 * @returns {number}
 */
export function advanceExplorationProgress(routeCells, progressIndex, cellsPerEpoch) {
  if (!routeCells.length) {
    return progressIndex
  }
  const maxIndex = routeCells.length - 1
  const step = Math.max(1, Math.floor(cellsPerEpoch))
  return Math.min(maxIndex, progressIndex + step)
}

/**
 * Cells newly entered since the previous progress index (exclusive of prior tip).
 *
 * @param {Array<{ x: number, y: number }>} routeCells
 * @param {number} previousIndex
 * @param {number} progressIndex
 * @returns {Array<{ x: number, y: number }>}
 */
export function routeCellsEnteredSince(routeCells, previousIndex, progressIndex) {
  if (!routeCells.length || progressIndex <= previousIndex) {
    return []
  }
  const start = Math.max(0, previousIndex + 1)
  return routeCells.slice(start, progressIndex + 1)
}
