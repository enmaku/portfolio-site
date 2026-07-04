import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { buildRoadCellMask } from '../core/colonization/roads/roadNetwork.js'

/** Road overlay tint. */
export const ROAD_OVERLAY_RGB = [180, 140, 70]

/** Road overlay alpha. */
export const ROAD_OVERLAY_ALPHA = 0.85

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildRoadOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) {
    return null
  }

  const mask = buildRoadCellMask(worldDocument.roads, gridWidth, gridHeight)
  let hasRoad = false
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] === 1) {
      hasRoad = true
      break
    }
  }
  if (!hasRoad) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const alphaByte = Math.round(ROAD_OVERLAY_ALPHA * 255)
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== 1) continue
    const base = i * 4
    rgba[base] = ROAD_OVERLAY_RGB[0]
    rgba[base + 1] = ROAD_OVERLAY_RGB[1]
    rgba[base + 2] = ROAD_OVERLAY_RGB[2]
    rgba[base + 3] = alphaByte
  }
  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildRoadOverlayCanvas(worldDocument) {
  const rgba = buildRoadOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}
