import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { resolveRoadSegments } from '../core/colonization/roads/roadNetwork.js'
import { densifyRouteCells } from '../core/colonization/expeditions/expeditionRouting.js'
import { WATER_BODY_OUTLINE_RGBA } from './riverCorridorOverlayRgba.js'

/** Land route overlay tint (cobblestone gray). */
export const LAND_ROUTE_OVERLAY_RGB = [142, 144, 148]

/** @deprecated Use LAND_ROUTE_OVERLAY_RGB */
export const ROAD_OVERLAY_RGB = LAND_ROUTE_OVERLAY_RGB

/** Route overlay alpha (near-opaque for readability on biomes). */
export const ROUTE_OVERLAY_ALPHA = 0.97

/** Chebyshev radius added around each route cell when painting the overlay. */
export const ROUTE_OVERLAY_HALF_WIDTH = 1

/** Exterior outline ring width in cells (matches river land-side fringe). */
export const ROUTE_OUTLINE_WIDTH = 1

/** @deprecated Use ROUTE_OVERLAY_ALPHA */
export const ROAD_OVERLAY_ALPHA = ROUTE_OVERLAY_ALPHA

/**
 * @param {Uint8Array} fill
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} x
 * @param {number} y
 * @param {number} halfWidth
 */
function markRouteFillCell(fill, gridWidth, gridHeight, x, y, halfWidth) {
  for (let dy = -halfWidth; dy <= halfWidth; dy += 1) {
    for (let dx = -halfWidth; dx <= halfWidth; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > halfWidth) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      fill[ny * gridWidth + nx] = 1
    }
  }
}

/**
 * One-cell exterior ring around the route fill silhouette.
 *
 * @param {Uint8Array} fill
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} [outlineWidth]
 * @returns {Uint8Array}
 */
export function computeRouteOutlineMask(fill, gridWidth, gridHeight, outlineWidth = ROUTE_OUTLINE_WIDTH) {
  const cellCount = gridWidth * gridHeight
  const outline = new Uint8Array(cellCount)
  if (outlineWidth <= 0) {
    return outline
  }

  const distance = new Int16Array(cellCount).fill(-1)
  /** @type {number[]} */
  const queue = []

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (fill[idx]) continue
    const x = idx % gridWidth
    const y = Math.floor(idx / gridWidth)
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (fill[ny * gridWidth + nx]) {
        distance[idx] = 0
        queue.push(idx)
        break
      }
    }
  }

  for (let head = 0; head < queue.length; head += 1) {
    const idx = queue[head]
    const step = distance[idx]
    if (step >= outlineWidth - 1) {
      outline[idx] = 1
      continue
    }
    const x = idx % gridWidth
    const y = Math.floor(idx / gridWidth)
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      const next = ny * gridWidth + nx
      if (fill[next] || distance[next] >= 0) continue
      distance[next] = step + 1
      queue.push(next)
    }
    outline[idx] = 1
  }

  return outline
}

/**
 * @param {Uint8Array} fill
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} halfWidth
 */
function stampRouteSegmentFill(fill, gridWidth, gridHeight, cells, halfWidth) {
  for (const cell of densifyRouteCells(cells)) {
    if (
      !Number.isInteger(cell.x) ||
      !Number.isInteger(cell.y) ||
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= gridWidth ||
      cell.y >= gridHeight
    ) {
      continue
    }
    markRouteFillCell(fill, gridWidth, gridHeight, cell.x, cell.y, halfWidth)
  }
}

/**
 * @param {string | undefined} mode
 * @returns {boolean}
 */
function isLandRouteOverlayMode(mode) {
  return mode !== 'open_sea' && mode !== 'inland_sail' && mode !== 'sail'
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildRoutesOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) {
    return null
  }

  const segments = resolveRoadSegments(worldDocument.roads)
  if (segments.length === 0) {
    return null
  }

  const cellCount = gridWidth * gridHeight
  const fill = new Uint8Array(cellCount)
  let hasRoute = false

  for (const segment of segments) {
    if (!isLandRouteOverlayMode(segment.mode)) continue
    const cells = segment.cells
    if (!Array.isArray(cells) || cells.length === 0) continue
    stampRouteSegmentFill(fill, gridWidth, gridHeight, cells, ROUTE_OVERLAY_HALF_WIDTH)
    hasRoute = true
  }

  if (!hasRoute) {
    return null
  }

  const outline = computeRouteOutlineMask(fill, gridWidth, gridHeight)
  const rgba = new Uint8ClampedArray(cellCount * 4)
  const alphaByte = Math.round(ROUTE_OVERLAY_ALPHA * 255)
  const [outlineR, outlineG, outlineB, outlineA] = WATER_BODY_OUTLINE_RGBA
  const [fillR, fillG, fillB] = LAND_ROUTE_OVERLAY_RGB

  for (let i = 0; i < cellCount; i += 1) {
    const offset = i * 4
    if (outline[i]) {
      rgba[offset] = outlineR
      rgba[offset + 1] = outlineG
      rgba[offset + 2] = outlineB
      rgba[offset + 3] = outlineA
      continue
    }
    if (!fill[i]) continue
    rgba[offset] = fillR
    rgba[offset + 1] = fillG
    rgba[offset + 2] = fillB
    rgba[offset + 3] = alphaByte
  }

  return rgba
}

/** @deprecated Use buildRoutesOverlayRgba */
export const buildRoadOverlayRgba = buildRoutesOverlayRgba

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildRoutesOverlayCanvas(worldDocument) {
  const rgba = buildRoutesOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}

/** @deprecated Use buildRoutesOverlayCanvas */
export const buildRoadOverlayCanvas = buildRoutesOverlayCanvas
