import { SEA_LEVEL } from '../../biomeIds.js'
import { isOceanCell } from '../../fields/applyClosedIslandRim.js'
import { findLeastResistancePath } from '../../hydrology/riverPathfinding.js'
import { deriveSailOverlayMask } from '../../sail/deriveSailOverlayMask.js'
import { DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from '../roads/roadNetwork.js'
import { isMaritimeExpeditionMode, resolveExpeditionMode } from './expeditionConstants.js'
import {
  resolveExpeditionOceanMask,
  resolveExpeditionSailMask,
} from './expeditionRouteContext.js'

/**
 * @typedef {import('./expeditionConstants.js').ExpeditionMode} ExpeditionMode
 */

/**
 * @typedef {Object} ExpeditionRouteLeg
 * @property {ExpeditionMode} mode
 * @property {Array<{ x: number, y: number }>} cells
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
 * @typedef {import('./expeditionRouteContext.js').ExpeditionRouteContext} ExpeditionRouteContext
 */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {ExpeditionRouteContext | null} [routeContext]
 * @returns {ExpeditionRouteLeg | null}
 */
export function computeLandRouteLeg(doc, from, to, routeContext = null) {
  const { gridWidth, gridHeight } = doc
  const ocean = routeContext
    ? resolveExpeditionOceanMask(routeContext)
    : buildOceanMask(doc)
  const elevation = doc.fields?.elevation ?? new Float32Array(gridWidth * gridHeight).fill(0.5)
  const fromIdx = from.y * gridWidth + from.x
  const toIdx = to.y * gridWidth + to.x
  const pathIndices = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width: gridWidth,
    height: gridHeight,
    preferDownhill: true,
  })
  if (!pathIndices) return null
  return {
    mode: 'land',
    cells: pathIndices.map((idx) => ({ x: idx % gridWidth, y: Math.floor(idx / gridWidth) })),
  }
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {ExpeditionRouteContext | null} [routeContext]
 * @returns {ExpeditionRouteLeg | null}
 */
export function computeSailRouteLeg(doc, from, to, routeContext = null) {
  const sailMask = routeContext
    ? resolveExpeditionSailMask(routeContext)
    : resolveSailTraversableMask(doc)
  if (!sailMask) return null
  const { gridWidth, gridHeight } = doc
  const path = findSailPath(sailMask, from, to, gridWidth, gridHeight)
  if (!path || path.length === 0) return null
  return { mode: 'inland_sail', cells: path }
}

/**
 * @param {Uint8Array} sailMask
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{ x: number, y: number }> | null}
 */
function findSailPath(sailMask, from, to, gridWidth, gridHeight) {
  const startIndex = from.y * gridWidth + from.x
  const goalIndex = to.y * gridWidth + to.x
  if (sailMask[startIndex] !== 1 || sailMask[goalIndex] !== 1) {
    return null
  }

  const cellCount = gridWidth * gridHeight
  const cameFrom = new Int32Array(cellCount).fill(-1)
  const closed = new Uint8Array(cellCount)
  /** @type {number[]} */
  const queue = [startIndex]
  cameFrom[startIndex] = startIndex

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (closed[current]) continue
    closed[current] = 1
    if (current === goalIndex) {
      return reconstructGridPath(cameFrom, goalIndex, gridWidth)
    }
    const cx = current % gridWidth
    const cy = Math.floor(current / gridWidth)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
        const next = ny * gridWidth + nx
        if (closed[next] || sailMask[next] !== 1) continue
        if (cameFrom[next] !== -1) continue
        cameFrom[next] = current
        queue.push(next)
      }
    }
  }
  return null
}

/**
 * @param {Int32Array} cameFrom
 * @param {number} goalIndex
 * @param {number} gridWidth
 */
function reconstructGridPath(cameFrom, goalIndex, gridWidth) {
  /** @type {Array<{ x: number, y: number }>} */
  const path = []
  let current = goalIndex
  while (true) {
    path.push({ x: current % gridWidth, y: Math.floor(current / gridWidth) })
    const prev = cameFrom[current]
    if (prev === current || prev < 0) break
    current = prev
  }
  path.reverse()
  return path
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {ExpeditionRouteContext | null} [routeContext]
 * @returns {{ mode: ExpeditionMode, legs: ExpeditionRouteLeg[], cells: Array<{ x: number, y: number }> } | null}
 */
export function chooseLowestTravelTimeRoute(doc, from, to, routeContext = null) {
  const landLeg = computeLandRouteLeg(doc, from, to, routeContext)
  if (landLeg) {
    return { mode: 'land', legs: [landLeg], cells: landLeg.cells }
  }

  const sailLeg = computeSailRouteLeg(doc, from, to, routeContext)
  if (sailLeg) {
    return { mode: 'inland_sail', legs: [sailLeg], cells: sailLeg.cells }
  }

  return null
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
 * Advance route progress by travel-time budget; returns new progress index.
 *
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Array<{ x: number, y: number }>} routeCells
 * @param {number} progressIndex
 * @param {number} budget
 * @param {ExpeditionMode} mode
 * @param {Uint8Array | null} [roadCellMask]
 * @param {number} [roadMultiplier]
 */
export function advanceRouteProgress(
  doc,
  routeCells,
  progressIndex,
  budget,
  mode,
  roadCellMask = null,
  roadMultiplier = DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
) {
  if (!routeCells.length) return progressIndex
  let remaining = budget
  let index = Math.max(0, Math.min(progressIndex, routeCells.length - 1))
  while (remaining > 0 && index < routeCells.length - 1) {
    const nextIndex = index + 1
    const prev = routeCells[index]
    const next = routeCells[nextIndex]
    const cellIndex = next.y * doc.gridWidth + next.x
    const step = isMaritimeExpeditionMode(resolveExpeditionMode(mode))
      ? 0.6
      : stepTravelCost(doc, cellIndex, roadCellMask, roadMultiplier)
    const diagonal = prev.x !== next.x && prev.y !== next.y ? Math.SQRT2 : 1
    const cost = step * diagonal
    if (cost > remaining) break
    remaining -= cost
    index = nextIndex
  }
  return index
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
