import { SEA_LEVEL } from '../../biomeIds.js'
import { isOceanCell } from '../../fields/applyClosedIslandRim.js'
import { deriveSailOverlayMask } from '../../sail/deriveSailOverlayMask.js'
import { DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from '../roads/roadNetwork.js'
import { isMaritimeExpeditionMode, resolveExpeditionMode } from './expeditionConstants.js'

/**
 * @typedef {import('./expeditionConstants.js').ExpeditionMode} ExpeditionMode
 */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {boolean[]}
 */
export function buildOceanMask(doc) {
  const { gridWidth, gridHeight } = doc
  const elevation = doc.fields?.elevation ?? new Float32Array(gridWidth * gridHeight).fill(0.5)
  return isOceanCell(elevation, gridWidth, gridHeight, SEA_LEVEL)
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {Uint8Array | null}
 */
export function resolveSailTraversableMask(doc) {
  const { gridWidth, gridHeight } = doc
  const elevation = doc.fields?.elevation
  if (!elevation || !gridWidth || !gridHeight) return null
  return deriveSailOverlayMask({
    elevation,
    lakeMask: doc.lakeMask ?? new Uint8Array(gridWidth * gridHeight),
    riverCorridorMask: doc.riverCorridorMask ?? new Uint8Array(gridWidth * gridHeight),
    gridWidth,
    gridHeight,
    seaLevel: SEA_LEVEL,
  })
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Array<{ x: number, y: number }>} cells
 * @param {ExpeditionMode} mode
 * @param {Uint8Array | null} [roadCellMask]
 * @param {number} [roadMultiplier]
 */
export function estimateRouteTravelTime(
  doc,
  cells,
  mode,
  roadCellMask = null,
  roadMultiplier = DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
) {
  if (!cells || cells.length <= 1) return 0
  const { gridWidth } = doc
  let total = 0
  for (let i = 1; i < cells.length; i += 1) {
    const prev = cells[i - 1]
    const next = cells[i]
    const index = next.y * gridWidth + next.x
    const step =
      isMaritimeExpeditionMode(resolveExpeditionMode(mode))
        ? 0.6
        : stepTravelCost(doc, index, roadCellMask, roadMultiplier)
    const diagonal = prev.x !== next.x && prev.y !== next.y ? Math.SQRT2 : 1
    total += step * diagonal
  }
  return total
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} cellIndex
 * @param {Uint8Array | null} roadCellMask
 * @param {number} roadMultiplier
 */
function stepTravelCost(doc, cellIndex, roadCellMask, roadMultiplier) {
  const movementCost = doc.movementCost
  let base = 1
  if (movementCost && Number.isFinite(movementCost[cellIndex]) && movementCost[cellIndex] > 0) {
    base = movementCost[cellIndex]
  }
  if (roadCellMask?.[cellIndex] === 1) {
    return base * roadMultiplier
  }
  return base
}

/**
 * @param {Array<{ x: number, y: number }>} routeCells
 * @param {number} progressIndex
 * @returns {Array<{ x: number, y: number }>}
 */
export function routeCellsUpToProgress(routeCells, progressIndex) {
  if (!routeCells.length) return []
  const end = Math.max(0, Math.min(progressIndex, routeCells.length - 1))
  return routeCells.slice(0, end + 1)
}

/**
 * @param {Array<{ x: number, y: number }>} routeCells
 * @param {number} progressIndex
 * @returns {{ x: number, y: number }}
 */
export function routePositionAtProgress(routeCells, progressIndex) {
  if (!routeCells.length) return { x: 0, y: 0 }
  const index = Math.max(0, Math.min(progressIndex, routeCells.length - 1))
  return routeCells[index]
}

/**
 * Integer grid line between two cells (8-connected Bresenham).
 *
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @returns {Array<{ x: number, y: number }>}
 */
export function rasterizeGridLine(from, to) {
  /** @type {Array<{ x: number, y: number }>} */
  const cells = []
  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const sx = from.x < to.x ? 1 : -1
  const sy = from.y < to.y ? 1 : -1
  let err = dx - dy

  while (true) {
    cells.push({ x, y })
    if (x === to.x && y === to.y) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }

  return cells
}

/**
 * Insert grid steps between sparse route waypoints so corridors stay connected.
 *
 * @param {Array<{ x: number, y: number }>} routeCells
 * @returns {Array<{ x: number, y: number }>}
 */
export function densifyRouteCells(routeCells) {
  if (!routeCells || routeCells.length <= 1) {
    return routeCells ?? []
  }

  /** @type {Array<{ x: number, y: number }>} */
  const dense = []
  for (let i = 0; i < routeCells.length - 1; i += 1) {
    const line = rasterizeGridLine(routeCells[i], routeCells[i + 1])
    if (dense.length > 0) {
      line.shift()
    }
    dense.push(...line)
  }
  return dense
}

/**
 * Corridor cells = routed cell plus immediate neighbors along traveled path.
 *
 * @param {Array<{ x: number, y: number }>} traveledCells
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
export function buildCorridorCells(traveledCells, gridWidth, gridHeight) {
  /** @type {Map<string, { x: number, y: number }>} */
  const corridor = new Map()
  for (const cell of densifyRouteCells(traveledCells)) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cell.x + dx
        const ny = cell.y + dy
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
        corridor.set(`${nx},${ny}`, { x: nx, y: ny })
      }
    }
  }
  return [...corridor.values()]
}
