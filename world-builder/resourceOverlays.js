import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'
import { COMMODITY_IDS } from './core/economy/commodityCatalog.js'
import {
  COMMODITY_PRICE_OVERLAY_IDS,
  EXCLUSIVE_CLAIM_OVERLAY_IDS,
  REALM_ECONOMY_OVERLAY_IDS,
  commodityPriceOverlayId,
  isExclusiveClaimOverlayId,
  isRealmEconomyOverlayId,
} from './resourceOverlayIds.js'

export {
  COMMODITY_PRICE_OVERLAY_IDS,
  EXCLUSIVE_CLAIM_OVERLAY_IDS,
  REALM_ECONOMY_OVERLAY_IDS,
  commodityPriceOverlayId,
  isExclusiveClaimOverlayId,
  isRealmEconomyOverlayId,
}

/** @typedef {Object} OverlayDisplaySettings
 * @property {number} arableMinimumProductivity
 */

/**
 * Display-only arable cutoff; defaults to the generation threshold so the overlay
 * matches the raster envelope unless the user adjusts it (no regeneration).
 */
export const DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY =
  DEFAULT_WORLD_GENERATION_OPTIONS.arableMinimumProductivity

/**
 * @returns {Array<{ id: string, kind: 'nodes' | 'raster' | 'rasterAndNodes', label: string, vectorLayerId?: import('./renderer/mapLayerRefresh.js').MapLayerId }>}
 */
export function createResourceOverlayDefinitions() {
  return [
    { id: 'arable', kind: 'raster', label: 'Arable' },
    { id: 'timber', kind: 'raster', label: 'Timber' },
    { id: 'metals', kind: 'rasterAndNodes', label: 'Metals', vectorLayerId: 'metalNodes' },
    { id: 'salt', kind: 'nodes', label: 'Salt', vectorLayerId: 'saltNodes' },
    { id: 'sail', kind: 'raster', label: 'Sail' },
    { id: 'freshwater', kind: 'raster', label: 'Freshwater' },
    { id: 'population', kind: 'raster', label: 'Population' },
    { id: 'settlements', kind: 'nodes', label: 'Settlements', vectorLayerId: 'settlementNodes' },
    { id: 'routes', kind: 'raster', label: 'Routes' },
    { id: 'wealth', kind: 'raster', label: 'Wealth' },
    { id: 'portTolls', kind: 'raster', label: 'Tolls' },
    { id: 'factionTax', kind: 'raster', label: 'Tax' },
    ...COMMODITY_IDS.map((commodityId) => ({
      id: commodityPriceOverlayId(commodityId),
      kind: /** @type {'raster'} */ ('raster'),
      label: commodityId,
    })),
    { id: 'factionTerritory', kind: 'raster', label: 'Control' },
    { id: 'loyalty', kind: 'raster', label: 'Loyalty' },
  ]
}

/**
 * @returns {string[]}
 */
export function createResourceOverlayIds() {
  return createResourceOverlayDefinitions().map((definition) => definition.id)
}

/**
 * @param {string[]} [resourceIds]
 * @returns {Record<string, boolean>}
 */
export function createDefaultResourceOverlayVisibility(resourceIds = createResourceOverlayIds()) {
  return Object.fromEntries(resourceIds.map((resourceId) => [resourceId, false]))
}

/**
 * @returns {OverlayDisplaySettings}
 */
export function createDefaultOverlayDisplaySettings() {
  return {
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  }
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @param {boolean} visible
 * @returns {Record<string, boolean>}
 */
export function applyResourceOverlayVisibility(visibility, resourceId, visible) {
  const nextVisible = Boolean(visible)
  /** @type {Record<string, boolean>} */
  const next = { ...visibility, [resourceId]: nextVisible }
  if (nextVisible && isExclusiveClaimOverlayId(resourceId)) {
    for (const exclusiveId of EXCLUSIVE_CLAIM_OVERLAY_IDS) {
      if (exclusiveId !== resourceId) {
        next[exclusiveId] = false
      }
    }
  }
  return next
}

/**
 * Collapse multiple exclusive claim overlays down to one (first true wins by def order).
 *
 * @param {Record<string, boolean>} visibility
 * @returns {Record<string, boolean>}
 */
export function enforceExclusiveClaimOverlayVisibility(visibility) {
  let kept = null
  /** @type {Record<string, boolean>} */
  const next = { ...visibility }
  for (const overlayId of createResourceOverlayIds()) {
    if (!isExclusiveClaimOverlayId(overlayId)) continue
    if (next[overlayId] === true) {
      if (kept == null) {
        kept = overlayId
      } else {
        next[overlayId] = false
      }
    }
  }
  return next
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @returns {boolean}
 */
export function isResourceOverlayVisible(visibility, resourceId) {
  return visibility[resourceId] === true
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @param {ReadonlyArray<unknown> | null | undefined} nodes
 * @returns {boolean}
 */
export function shouldDrawResourceNodeOverlay(visibility, resourceId, nodes) {
  return isResourceOverlayVisible(visibility, resourceId) && Boolean(nodes?.length)
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @param {Float32Array | null | undefined} raster
 * @returns {boolean}
 */
export function shouldDrawResourceRasterOverlay(visibility, resourceId, raster) {
  if (!isResourceOverlayVisible(visibility, resourceId) || !raster?.length) {
    return false
  }
  for (let i = 0; i < raster.length; i += 1) {
    if (raster[i] > 0) return true
  }
  return false
}
