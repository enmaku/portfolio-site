import {
  buildResourceRasterOverlayRgba,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{ minimumProductivity?: number }} [options]
 * @returns {Uint8ClampedArray | null}
 */
export function buildArableOverlayRgba(worldDocument, { minimumProductivity = 0 } = {}) {
  const { gridWidth, gridHeight, arableRaster } = worldDocument
  if (!arableRaster) {
    return null
  }

  return buildResourceRasterOverlayRgba({
    raster: arableRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
    minimumProductivity,
  })
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{ minimumProductivity?: number }} [options]
 * @returns {HTMLCanvasElement | null}
 */
export function buildArableOverlayCanvas(worldDocument, { minimumProductivity = 0 } = {}) {
  const rgba = buildArableOverlayRgba(worldDocument, { minimumProductivity })
  if (!rgba) {
    return null
  }

  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}
