import { buildArableOverlayRgba } from './buildArableOverlayCanvas.js'
import { buildFreshwaterOverlayRgba } from './buildFreshwaterOverlayRgba.js'
import { buildRoutesOverlayRgba } from './buildRoadOverlayRgba.js'
import { buildWealthOverlayRgba } from './buildWealthOverlayRgba.js'
import { buildPortTollsOverlayRgba } from './buildPortTollsOverlayRgba.js'
import { buildFactionTaxOverlayRgba } from './buildFactionTaxOverlayRgba.js'
import { buildCommodityPriceOverlayRgba } from './buildCommodityPriceOverlayRgba.js'
import { buildFactionTerritoryOverlayRgba } from './buildFactionTerritoryOverlayRgba.js'
import { buildMetalsOverlayRgba } from './buildMetalsOverlayCanvas.js'
import { buildPopulationOverlayRgba } from './buildPopulationOverlayRgba.js'
import { buildLoyaltyOverlayRgba } from './buildLoyaltyOverlayRgba.js'
import { buildSailOverlayRgba } from './buildSailOverlayRgba.js'
import { buildTimberOverlayRgba } from './buildTimberOverlayCanvas.js'
import { resourceRasterOverlayCanvasFromRgba } from './buildResourceRasterOverlayRgba.js'
import { COMMODITY_IDS } from '../core/economy/commodityCatalog.js'
import { createResourceOverlayDefinitions, commodityPriceOverlayId } from '../resourceOverlays.js'
import {
  resolveArableRasterLayerVisible,
  resolveFreshwaterRasterLayerVisible,
  resolvePopulationRasterLayerVisible,
  resolveRoutesRasterLayerVisible,
  resolveResourceRasterLayerVisible,
  resolveSailRasterLayerVisible,
  resolveWealthRasterLayerVisible,
  resolvePortTollsRasterLayerVisible,
  resolveFactionTaxRasterLayerVisible,
  resolveCommodityPriceRasterLayerVisible,
  resolveFactionTerritoryRasterLayerVisible,
  resolveLoyaltyRasterLayerVisible,
} from './worldBuilderMapViewportModel.js'

/** @typedef {string} ResourceRasterOverlayLayerId */

/**
 * @typedef {Object} ResourceRasterOverlayRefreshContext
 * @property {import('../core/types.js').WorldDocument} worldDocument
 * @property {Record<string, boolean>} visibility
 * @property {number} arableMinimumProductivity
 */

/**
 * @typedef {Object} ResourceRasterOverlayRegistryEntry
 * @property {string} id
 * @property {(visibility: Record<string, boolean>, worldDocument: import('../core/types.js').WorldDocument, arableMinimumProductivity: number) => boolean} resolveVisible
 * @property {(worldDocument: import('../core/types.js').WorldDocument, options: { arableMinimumProductivity: number }) => Uint8ClampedArray | null} buildRgba
 */

/** @type {Record<string, ResourceRasterOverlayRegistryEntry>} */
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
  portTolls: {
    id: 'portTolls',
    resolveVisible: (visibility, worldDocument) =>
      resolvePortTollsRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildPortTollsOverlayRgba(worldDocument),
  },
  factionTax: {
    id: 'factionTax',
    resolveVisible: (visibility, worldDocument) =>
      resolveFactionTaxRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildFactionTaxOverlayRgba(worldDocument),
  },
  ...Object.fromEntries(
    COMMODITY_IDS.map((commodityId) => {
      const id = commodityPriceOverlayId(commodityId)
      return [
        id,
        {
          id,
          resolveVisible: (visibility, worldDocument) =>
            resolveCommodityPriceRasterLayerVisible(visibility, id, worldDocument, commodityId),
          buildRgba: (worldDocument) => buildCommodityPriceOverlayRgba(worldDocument, commodityId),
        },
      ]
    }),
  ),
  factionTerritory: {
    id: 'factionTerritory',
    resolveVisible: (visibility, worldDocument) =>
      resolveFactionTerritoryRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildFactionTerritoryOverlayRgba(worldDocument),
  },
  loyalty: {
    id: 'loyalty',
    resolveVisible: (visibility, worldDocument) =>
      resolveLoyaltyRasterLayerVisible(visibility, worldDocument),
    buildRgba: (worldDocument) => buildLoyaltyOverlayRgba(worldDocument),
  },
}

/** @type {readonly string[]} */
export const RESOURCE_RASTER_OVERLAY_LAYER_IDS = createResourceOverlayDefinitions()
  .filter((definition) => definition.kind === 'raster' || definition.kind === 'rasterAndNodes')
  .map((definition) => definition.id)

/**
 * @param {string} resourceId
 * @returns {boolean}
 */
export function isResourceRasterOverlayLayerId(resourceId) {
  return RESOURCE_RASTER_OVERLAY_LAYER_IDS.includes(resourceId)
}

/**
 * @param {string} resourceId
 * @param {ResourceRasterOverlayRefreshContext} context
 * @returns {boolean}
 */
export function resolveResourceRasterOverlaySpriteVisible(resourceId, context) {
  const { visibility, worldDocument, arableMinimumProductivity } = context
  const entry = RESOURCE_RASTER_OVERLAY_REGISTRY[resourceId]
  if (!entry) return false
  return entry.resolveVisible(visibility, worldDocument, arableMinimumProductivity)
}

/**
 * @param {string} resourceId
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{ arableMinimumProductivity?: number }} [options]
 * @returns {Uint8ClampedArray | null}
 */
function buildResourceRasterOverlayRgbaForId(resourceId, worldDocument, options = {}) {
  const { arableMinimumProductivity = 0 } = options
  const entry = RESOURCE_RASTER_OVERLAY_REGISTRY[resourceId]
  if (!entry) return null
  return entry.buildRgba(worldDocument, {
    arableMinimumProductivity,
  })
}

/**
 * @param {string} resourceId
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
 * @param {string} resourceId
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
 * @returns {Record<string, HTMLCanvasElement | null>}
 */
export function refreshAllResourceRasterOverlayCanvases(context) {
  /** @type {Record<string, HTMLCanvasElement | null>} */
  const canvases = {}

  for (const resourceId of RESOURCE_RASTER_OVERLAY_LAYER_IDS) {
    canvases[resourceId] = refreshResourceRasterOverlayCanvas(resourceId, context)
  }

  return canvases
}
