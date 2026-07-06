import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { resolveRoadSegments } from '../core/colonization/roads/roadNetwork.js'

/** Land route overlay tint (warm ochre/tan). */
export const LAND_ROUTE_OVERLAY_RGB = [180, 140, 70]

/** Sail route overlay tint (cool cyan/teal). */
export const SAIL_ROUTE_OVERLAY_RGB = [40, 180, 190]

/** @deprecated Use LAND_ROUTE_OVERLAY_RGB */
export const ROAD_OVERLAY_RGB = LAND_ROUTE_OVERLAY_RGB

/** Route overlay alpha. */
export const ROUTE_OVERLAY_ALPHA = 0.85

/** @deprecated Use ROUTE_OVERLAY_ALPHA */
export const ROAD_OVERLAY_ALPHA = ROUTE_OVERLAY_ALPHA

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

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const alphaByte = Math.round(ROUTE_OVERLAY_ALPHA * 255)
  let hasRoute = false

  for (const segment of segments) {
    if (!Array.isArray(segment.cells) || segment.cells.length === 0) continue
    const rgb = segment.mode === 'sail' ? SAIL_ROUTE_OVERLAY_RGB : LAND_ROUTE_OVERLAY_RGB
    for (const cell of segment.cells) {
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
      const index = cell.y * gridWidth + cell.x
      const base = index * 4
      rgba[base] = rgb[0]
      rgba[base + 1] = rgb[1]
      rgba[base + 2] = rgb[2]
      rgba[base + 3] = alphaByte
      hasRoute = true
    }
  }

  if (!hasRoute) {
    return null
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
