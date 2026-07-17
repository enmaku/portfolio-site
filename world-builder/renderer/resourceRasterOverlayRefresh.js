import { buildArableOverlayRgba } from './buildArableOverlayCanvas.js'
import { buildExplorationFogOverlayRgba } from './buildExplorationFogOverlayRgba.js'
import { buildFreshwaterOverlayRgba } from './buildFreshwaterOverlayRgba.js'
import { buildRoutesOverlayRgba } from './buildRoadOverlayRgba.js'
import { buildWealthOverlayRgba } from './buildWealthOverlayRgba.js'
import { buildMetalsOverlayRgba } from './buildMetalsOverlayCanvas.js'
import { buildPopulationOverlayRgba } from './buildPopulationOverlayRgba.js'
import { buildSailOverlayRgba } from './buildSailOverlayRgba.js'
import { buildTimberOverlayRgba } from './buildTimberOverlayCanvas.js'
import { resourceRasterOverlayCanvasFromRgba } from './buildResourceRasterOverlayRgba.js'
import { createResourceOverlayDefinitions } from '../resourceOverlays.js'
import {
  resolveArableRasterLayerVisible,
  resolveFreshwaterRasterLayerVisible,
  resolvePopulationRasterLayerVisible,
  resolveExplorationFogRasterLayerVisible,
  resolveRoutesRasterLayerVisible,
  resolveResourceRasterLayerVisible,
  resolveSailRasterLayerVisible,
  resolveWealthRasterLayerVisible,
} from './worldBuilderMapViewportModel.js'

/** @typedef {'arable' | 'timber' | 'metals' | 'sail' | 'freshwater' | 'population' | 'explorationFog' | 'routes' | 'wealth'} ResourceRasterOverlayLayerId */

/**
 * @typedef {Object} ResourceRasterOverlayRefreshContext
 * @property {import('../core/types.js').WorldDocument} worldDocument
 * @property {Record<string, boolean>} visibility
 * @property {number} arableMinimumProductivity
 */

/**
 * @typedef {Object} ResourceRasterOverlayRegistryEntry
 * @property {ResourceRasterOverlayLayerId} id
 * @property {(visibility: Record<string, boolean>, worldDocument: import('../core/types.js').WorldDocument, arableMinimumProductivity: number) => boolean} resolveVisible
 * @property {(worldDocument: import('../core/types.js').WorldDocument, options: { arableMinimumProductivity: number }) => Uint8ClampedArray | null} buildRgba
 */

/** @type {Record<ResourceRasterOverlayLayerId, ResourceRasterOverlayRegistryEntry>} */
export const RESOURCE_RASTER_OVERLAY_REGISTRY = {
  arable: {
    id: 'arable',
    resolveVisible: (visibility, worldDocument, arableMinimumProductivity) =>
      resolveArableRasterLayerVisible(visibility, worldDocument, arableMinimumProductivity),
    buildRgba: (worldDocument, { arableMinimumProductivity }) =>
      buildArableOverlayRgba(worldDocument, { minimumProductivity: arableMinimumProductivity }),
  },
  timber: {
    id: 'timber',
    resolveVisible: (visibility, worldDocument) =>
      resolveResourceRasterLayerVisible(visibility, 'timber', worldDocument),
    buildRgba: (worldDocument) => buildTimberOverlayRgba(worldDocument),
  },
  metals: {
    id: 'metals',
    resolveVisible: (visibility, worldDocument) =>
      resolveResourceRasterLayerVisible(visibility, 'metals', worldDocument),
    buildRgba: (worldDocument) => buildMetalsOverlayRgba(worldDocument),
  },
  sail: {
    id: 'sail',
    resolveVisible: (visibility, worldDocument) =>
      resolveSailRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildSailOverlayRgba(worldDocument),
  },
  freshwater: {
    id: 'freshwater',
    resolveVisible: (visibility, worldDocument) =>
      resolveFreshwaterRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildFreshwaterOverlayRgba(worldDocument),
  },
  population: {
    id: 'population',
    resolveVisible: (visibility, worldDocument) =>
      resolvePopulationRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildPopulationOverlayRgba(worldDocument),
  },
  explorationFog: {
    id: 'explorationFog',
    resolveVisible: (visibility, worldDocument) =>
      resolveExplorationFogRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildExplorationFogOverlayRgba(worldDocument),
  },
  routes: {
    id: 'routes',
    resolveVisible: (visibility, worldDocument) =>
      resolveRoutesRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildRoutesOverlayRgba(worldDocument),
  },
  wealth: {
    id: 'wealth',
    resolveVisible: (visibility, worldDocument) =>
      resolveWealthRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildWealthOverlayRgba(worldDocument),
  },
}

/** @type {readonly ResourceRasterOverlayLayerId[]} */
export const RESOURCE_RASTER_OVERLAY_LAYER_IDS = createResourceOverlayDefinitions()
  .filter((definition) => definition.kind === 'raster' || definition.kind === 'rasterAndNodes')
  .map((definition) => /** @type {ResourceRasterOverlayLayerId} */ (definition.id))

/**
 * @param {string} resourceId
 * @returns {resourceId is ResourceRasterOverlayLayerId}
 */
export function isResourceRasterOverlayLayerId(resourceId) {
  return RESOURCE_RASTER_OVERLAY_LAYER_IDS.includes(
    /** @type {ResourceRasterOverlayLayerId} */ (resourceId),
  )
}

/**
 * @param {ResourceRasterOverlayLayerId} resourceId
 * @param {ResourceRasterOverlayRefreshContext} context
 * @returns {boolean}
 */
export function resolveResourceRasterOverlaySpriteVisible(resourceId, context) {
  const { visibility, worldDocument, arableMinimumProductivity } = context
  return RESOURCE_RASTER_OVERLAY_REGISTRY[resourceId].resolveVisible(
    visibility,
    worldDocument,
    arableMinimumProductivity,
  )
}

/**
 * @param {ResourceRasterOverlayLayerId} resourceId
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{ arableMinimumProductivity?: number }} [options]
 * @returns {Uint8ClampedArray | null}
 */
function buildResourceRasterOverlayRgbaForId(resourceId, worldDocument, options = {}) {
  const { arableMinimumProductivity = 0 } = options
  return RESOURCE_RASTER_OVERLAY_REGISTRY[resourceId].buildRgba(worldDocument, {
    arableMinimumProductivity,
  })
}

/**
 * @param {ResourceRasterOverlayLayerId} resourceId
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{ arableMinimumProductivity?: number }} [options]
 * @returns {HTMLCanvasElement | null}
 */
export function buildResourceRasterOverlayCanvasForId(resourceId, worldDocument, options = {}) {
  const rgba = buildResourceRasterOverlayRgbaForId(resourceId, worldDocument, options)
  if (!rgba) {
    return null
  }

  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}

/**
 * @param {ResourceRasterOverlayLayerId} resourceId
 * @param {ResourceRasterOverlayRefreshContext} context
 * @returns {HTMLCanvasElement | null}
 */
export function refreshResourceRasterOverlayCanvas(resourceId, context) {
  if (!resolveResourceRasterOverlaySpriteVisible(resourceId, context)) {
    return null
  }

  return buildResourceRasterOverlayCanvasForId(resourceId, context.worldDocument, {
    arableMinimumProductivity: context.arableMinimumProductivity,
  })
}

/**
 * @param {ResourceRasterOverlayRefreshContext} context
 * @returns {Record<ResourceRasterOverlayLayerId, HTMLCanvasElement | null>}
 */
export function refreshAllResourceRasterOverlayCanvases(context) {
  /** @type {Record<ResourceRasterOverlayLayerId, HTMLCanvasElement | null>} */
  const canvases = {
    arable: null,
    timber: null,
    metals: null,
    sail: null,
    freshwater: null,
    population: null,
    explorationFog: null,
    routes: null,
    wealth: null,
  }

  for (const resourceId of RESOURCE_RASTER_OVERLAY_LAYER_IDS) {
    canvases[resourceId] = refreshResourceRasterOverlayCanvas(resourceId, context)
  }

  return canvases
}
