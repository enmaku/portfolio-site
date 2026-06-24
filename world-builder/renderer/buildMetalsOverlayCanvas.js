import { buildResourceRasterOverlayCanvas } from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildMetalsOverlayCanvas(worldDocument) {
  const { gridWidth, gridHeight, metalsRaster } = worldDocument
  if (!metalsRaster) {
    return null
  }

  return buildResourceRasterOverlayCanvas({
    raster: metalsRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.metals,
  })
}
