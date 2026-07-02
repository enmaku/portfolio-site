import { hasDrawableResourceRasterOverlayPixels } from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../core/worldGenerationOptions.js'
import { deriveSailOverlayMask } from '../core/sail/deriveSailOverlayMask.js'
import {
  isResourceOverlayVisible,
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
 * @param {Record<string, boolean>} visibility
 * @param {'timber' | 'metals'} resourceId
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveResourceRasterLayerVisible(visibility, resourceId, worldDocument) {
  const raster = resourceId === 'timber' ? worldDocument.timberRaster : worldDocument.metalsRaster
  if (!shouldDrawResourceRasterOverlay(visibility, resourceId, raster) || !raster) {
    return false
  }

  return hasDrawableResourceRasterOverlayPixels({
    raster,
    width: worldDocument.gridWidth,
    height: worldDocument.gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES[resourceId],
  })
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {number} minimumProductivity
 * @returns {boolean}
 */
export function resolveArableRasterLayerVisible(visibility, worldDocument, minimumProductivity) {
  const { arableRaster, gridWidth, gridHeight } = worldDocument
  if (!shouldDrawResourceRasterOverlay(visibility, 'arable', arableRaster) || !arableRaster) {
    return false
  }

  return hasDrawableResourceRasterOverlayPixels({
    raster: arableRaster,
    width: gridWidth,
    height: gridHeight,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
    minimumProductivity,
  })
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

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveSailRasterLayerVisible(visibility, worldDocument) {
  if (!isResourceOverlayVisible(visibility, 'sail')) {
    return false
  }
  const { gridWidth, gridHeight, fields, lakeMask, riverCorridorMask } = worldDocument
  if (!fields?.elevation) {
    return false
  }
  const mask = deriveSailOverlayMask({
    elevation: fields.elevation,
    lakeMask,
    riverCorridorMask,
    gridWidth,
    gridHeight,
    seaLevel: DEFAULT_WORLD_GENERATION_OPTIONS.seaLevel,
  })
  return mask.some((value) => value === 1)
}
