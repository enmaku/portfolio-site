import { hasDrawableResourceRasterOverlayPixels } from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../core/worldGenerationOptions.js'
import {
  FRESHWATER_NONE,
  deriveFreshwaterAvailabilityFromDocument,
} from '../core/colonization/freshwater/deriveFreshwaterAvailability.js'
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
 * Distinct marker colors per typed mineral deposit so the overlay separates
 * copper/silver/gold/diamond pins from each other and the metals-potential raster.
 * @type {Readonly<Record<import('../core/types.js').MineralKind, number>>}
 */
export const MINERAL_NODE_OVERLAY_COLORS = Object.freeze({
  copper: 0xb87333,
  silver: 0xc0c0c0,
  gold: 0xffd700,
  diamond: 0x7fdfff,
})

/** Fallback marker color for an unknown or missing deposit kind. */
export const DEFAULT_MINERAL_NODE_OVERLAY_COLOR = 0x000000

/**
 * @param {import('../core/types.js').MineralKind | undefined} kind
 * @returns {number}
 */
export function mineralNodeOverlayColor(kind) {
  if (kind && kind in MINERAL_NODE_OVERLAY_COLORS) {
    return MINERAL_NODE_OVERLAY_COLORS[kind]
  }
  return DEFAULT_MINERAL_NODE_OVERLAY_COLOR
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
export function resolveSettlementNodeOverlayDrawn(visibility, worldDocument) {
  return shouldDrawResourceNodeOverlay(visibility, 'settlements', worldDocument.settlements)
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

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveFreshwaterRasterLayerVisible(visibility, worldDocument) {
  if (!isResourceOverlayVisible(visibility, 'freshwater')) {
    return false
  }
  const classification = deriveFreshwaterAvailabilityFromDocument(worldDocument)
  if (!classification) {
    return false
  }
  return classification.some((value) => value !== FRESHWATER_NONE)
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolvePopulationRasterLayerVisible(visibility, worldDocument) {
  if (!isResourceOverlayVisible(visibility, 'population')) {
    return false
  }
  const raster = worldDocument.populationCollapseRaster
  if (!raster || raster.length !== worldDocument.gridWidth * worldDocument.gridHeight) {
    return false
  }
  return raster.some((value) => value > 0)
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveExplorationFogRasterLayerVisible(visibility, worldDocument) {
  if (!isResourceOverlayVisible(visibility, 'explorationFog')) {
    return false
  }
  if (worldDocument.colonizationPhase !== 'running') {
    return false
  }
  const visited = worldDocument.visitedCells
  if (!(visited instanceof Uint8Array) || visited.length !== worldDocument.gridWidth * worldDocument.gridHeight) {
    return visited != null && Array.isArray(visited) && visited.some((value) => value === 0)
  }
  return visited.some((value) => value === 0)
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveRoutesRasterLayerVisible(visibility, worldDocument) {
  const routesVisible =
    isResourceOverlayVisible(visibility, 'routes') ||
    isResourceOverlayVisible(visibility, 'roads')
  if (!routesVisible) {
    return false
  }
  if (worldDocument.colonizationPhase !== 'running') {
    return false
  }
  const roads = worldDocument.roads
  return Array.isArray(roads) && roads.some((segment) => Array.isArray(segment.cells) && segment.cells.length > 0)
}

/** @deprecated Use resolveRoutesRasterLayerVisible */
export const resolveRoadRasterLayerVisible = resolveRoutesRasterLayerVisible

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveWealthRasterLayerVisible(visibility, worldDocument) {
  if (!isResourceOverlayVisible(visibility, 'wealth')) {
    return false
  }
  if (worldDocument.colonizationPhase !== 'running') {
    return false
  }
  if (!worldDocument.lastTradeEpochResult) {
    return false
  }
  const settlements = worldDocument.settlements
  return Array.isArray(settlements) && settlements.length > 0
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {boolean}
 */
export function resolveTradeRoutesRasterLayerVisible(visibility, worldDocument) {
  if (!isResourceOverlayVisible(visibility, 'tradeRoutes')) {
    return false
  }
  if (worldDocument.colonizationPhase !== 'running') {
    return false
  }
  const candidates = worldDocument.tradeRouteState?.candidates
  return Array.isArray(candidates) && candidates.length > 0
}
