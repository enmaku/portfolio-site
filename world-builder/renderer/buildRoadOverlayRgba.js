import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { resolveRoadSegments } from '../core/colonization/roads/roadNetwork.js'
import { densifyRouteCells } from '../core/colonization/expeditions/expeditionRouting.js'
import { WATER_BODY_OUTLINE_RGBA } from './riverCorridorOverlayRgba.js'

/** Land route overlay tint (cobblestone gray). */
export const LAND_ROUTE_OVERLAY_RGB = [142, 144, 148]

/** Sail route overlay tint (cool cyan/teal). */
export const SAIL_ROUTE_OVERLAY_RGB = [40, 180, 190]

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
 * @param {Uint8Array} fillMode
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} x
 * @param {number} y
 * @param {number} halfWidth
 * @param {number} modeValue
 */
function markRouteFillCell(fill, fillMode, gridWidth, gridHeight, x, y, halfWidth, modeValue) {
  for (let dy = -halfWidth; dy <= halfWidth; dy += 1) {
    for (let dx = -halfWidth; dx <= halfWidth; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > halfWidth) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      const index = ny * gridWidth + nx
      fill[index] = 1
      fillMode[index] = modeValue
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
 * @param {Uint8Array} fillMode
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} halfWidth
 * @param {number} modeValue
 */
function stampRouteSegmentFill(fill, fillMode, gridWidth, gridHeight, cells, halfWidth, modeValue) {
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
    markRouteFillCell(fill, fillMode, gridWidth, gridHeight, cell.x, cell.y, halfWidth, modeValue)
  }
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
  /** @type {Uint8Array} 0 = none, 1 = land, 2 = sail */
  const fillMode = new Uint8Array(cellCount)
  let hasRoute = false

  for (const segment of segments) {
    if (!Array.isArray(segment.cells) || segment.cells.length === 0) continue
    const modeValue = segment.mode === 'sail' ? 2 : 1
    stampRouteSegmentFill(
      fill,
      fillMode,
      gridWidth,
      gridHeight,
      segment.cells,
      ROUTE_OVERLAY_HALF_WIDTH,
      modeValue,
    )
    hasRoute = true
  }

  if (!hasRoute) {
    return null
  }

  const outline = computeRouteOutlineMask(fill, gridWidth, gridHeight)
  const rgba = new Uint8ClampedArray(cellCount * 4)
  const alphaByte = Math.round(ROUTE_OVERLAY_ALPHA * 255)
  const [outlineR, outlineG, outlineB, outlineA] = WATER_BODY_OUTLINE_RGBA

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
    const rgb = fillMode[i] === 2 ? SAIL_ROUTE_OVERLAY_RGB : LAND_ROUTE_OVERLAY_RGB
    rgba[offset] = rgb[0]
    rgba[offset + 1] = rgb[1]
    rgba[offset + 2] = rgb[2]
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
