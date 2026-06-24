import {
  buildResourceRasterOverlayCanvas,
  buildResourceRasterOverlayRgba,
} from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildArableOverlayRgba(worldDocument) {
  const { gridWidth, gridHeight, arableRaster } = worldDocument
  if (!arableRaster) {
    return null
  }

  return buildResourceRasterOverlayRgba({
    raster: arableRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
  })
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildArableOverlayCanvas(worldDocument) {
  const { gridWidth, gridHeight, arableRaster } = worldDocument
  if (!arableRaster) {
    return null
  }

  return buildResourceRasterOverlayCanvas({
    raster: arableRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
  })
}
