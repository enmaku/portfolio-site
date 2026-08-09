import {
  buildResourceRasterOverlayRgba,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildMetalsOverlayRgba(worldDocument) {
  const { gridWidth, gridHeight, metalsRaster } = worldDocument
  if (!metalsRaster) {
    return null
  }

  return buildResourceRasterOverlayRgba({
    raster: metalsRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.metals,
  })
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildMetalsOverlayCanvas(worldDocument) {
  const rgba = buildMetalsOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }

  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}
