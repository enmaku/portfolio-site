import { buildArableOverlayRgba } from './buildArableOverlayCanvas.js'
import { buildMetalsOverlayRgba } from './buildMetalsOverlayCanvas.js'
import { buildTimberOverlayRgba } from './buildTimberOverlayCanvas.js'
import {
  shouldDrawResourceNodeOverlay,
  shouldDrawResourceRasterOverlay,
} from '../resourceOverlays.js'

/**
 * @param {number} worldWidth
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} region
 * @returns {number}
 */
export function computeRegionFocusScale(worldWidth, region) {
  const span = Math.max(region.maxX - region.minX, region.maxY - region.minY, 1)
  return Math.min(24, Math.max(1, worldWidth / span / 4))
}

/**
 * @param {Uint8Array} lakeMask
 * @param {number} gridWidth
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
export function collectLakeOverlayRects(lakeMask, gridWidth) {
  /** @type {Array<{ x: number, y: number, w: number, h: number }>} */
  const rects = []
  for (let i = 0; i < lakeMask.length; i += 1) {
    if (!lakeMask[i]) continue
    rects.push({
      x: i % gridWidth,
      y: Math.floor(i / gridWidth),
      w: 1,
      h: 1,
    })
  }
  return rects
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {'timber' | 'metals'} resourceId
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveResourceRasterLayerVisible(visibility, resourceId, worldDocument) {
  const raster = resourceId === 'timber' ? worldDocument.timberRaster : worldDocument.metalsRaster
  if (!shouldDrawResourceRasterOverlay(visibility, resourceId, raster)) {
    return false
  }
  if (resourceId === 'timber') {
    return buildTimberOverlayRgba(worldDocument) !== null
  }
  return buildMetalsOverlayRgba(worldDocument) !== null
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {number} minimumProductivity
 * @returns {boolean}
 */
export function resolveArableRasterLayerVisible(visibility, worldDocument, minimumProductivity) {
  if (!shouldDrawResourceRasterOverlay(visibility, 'arable', worldDocument.arableRaster)) {
    return false
  }
  return (
    buildArableOverlayRgba(worldDocument, { minimumProductivity }) !== null
  )
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {{ rasterVisible: boolean, nodesVisible: boolean }}
 */
export function resolveMetalsOverlayDrawn(visibility, worldDocument) {
  return {
    rasterVisible: resolveResourceRasterLayerVisible(visibility, 'metals', worldDocument),
    nodesVisible: shouldDrawResourceNodeOverlay(visibility, 'metals', worldDocument.metalNodes),
  }
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveSaltNodeOverlayDrawn(visibility, worldDocument) {
  return shouldDrawResourceNodeOverlay(visibility, 'salt', worldDocument.saltNodes)
}
