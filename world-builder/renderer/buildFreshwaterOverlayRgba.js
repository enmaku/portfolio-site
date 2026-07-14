import {
  FRESHWATER_NONE,
  deriveFreshwaterAvailabilityFromDocument,
} from '../core/colonization/freshwater/deriveFreshwaterAvailability.js'
import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'

/** Cyan freshwater overlay tint. */
export const FRESHWATER_OVERLAY_RGB = [0, 200, 255]

/** Freshwater overlay fill alpha on available cells. */
export const FRESHWATER_OVERLAY_ALPHA = 0.65

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildFreshwaterOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const classification = deriveFreshwaterAvailabilityFromDocument(worldDocument)
  if (!classification) {
    return null
  }

  let hasSetCell = false
  for (let i = 0; i < classification.length; i += 1) {
    if (classification[i] !== FRESHWATER_NONE) {
      hasSetCell = true
      break
    }
  }
  if (!hasSetCell) {
    return null
  }

  const { gridWidth, gridHeight } = worldDocument
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const alphaByte = Math.round(FRESHWATER_OVERLAY_ALPHA * 255)
  for (let i = 0; i < classification.length; i += 1) {
    if (classification[i] === FRESHWATER_NONE) continue
    const base = i * 4
    rgba[base] = FRESHWATER_OVERLAY_RGB[0]
    rgba[base + 1] = FRESHWATER_OVERLAY_RGB[1]
    rgba[base + 2] = FRESHWATER_OVERLAY_RGB[2]
    rgba[base + 3] = alphaByte
  }
  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildFreshwaterOverlayCanvas(worldDocument) {
  const rgba = buildFreshwaterOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }

  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}
