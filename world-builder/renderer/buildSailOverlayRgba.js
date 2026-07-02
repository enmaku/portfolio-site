import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../core/worldGenerationOptions.js'
import { deriveSailOverlayMask } from '../core/sail/deriveSailOverlayMask.js'
import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'

/** Bright pink sail overlay tint (ADR 0010). */
export const SAIL_OVERLAY_RGB = [255, 20, 147]

/** Sail overlay fill alpha on set mask cells. */
export const SAIL_OVERLAY_ALPHA = 0.72

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildSailOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight, fields, lakeMask, riverCorridorMask } = worldDocument
  if (!fields?.elevation) {
    return null
  }

  const mask = deriveSailOverlayMask({
    elevation: fields.elevation,
    lakeMask,
    riverCorridorMask,
    gridWidth,
    gridHeight,
    seaLevel: DEFAULT_WORLD_GENERATION_OPTIONS.seaLevel,
  })

  let hasSetCell = false
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) {
      hasSetCell = true
      break
    }
  }
  if (!hasSetCell) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const alphaByte = Math.round(SAIL_OVERLAY_ALPHA * 255)
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue
    const base = i * 4
    rgba[base] = SAIL_OVERLAY_RGB[0]
    rgba[base + 1] = SAIL_OVERLAY_RGB[1]
    rgba[base + 2] = SAIL_OVERLAY_RGB[2]
    rgba[base + 3] = alphaByte
  }
  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildSailOverlayCanvas(worldDocument) {
  const rgba = buildSailOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }

  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}
