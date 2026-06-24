import {
  buildResourceRasterOverlayCanvas,
  buildResourceRasterOverlayRgba,
} from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildTimberOverlayRgba(worldDocument) {
  const { gridWidth, gridHeight, timberRaster } = worldDocument
  if (!timberRaster) {
    return null
  }

  return buildResourceRasterOverlayRgba({
    raster: timberRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  })
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildTimberOverlayCanvas(worldDocument) {
  const { gridWidth, gridHeight, timberRaster } = worldDocument
  if (!timberRaster) {
    return null
  }

  return buildResourceRasterOverlayCanvas({
    raster: timberRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  })
}
