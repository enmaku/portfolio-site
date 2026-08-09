/**
 * Overlay id helpers for claim-style economy inspect layers.
 * Domain: world-builder/CONTEXT.md — realm economy, wealth overlay.
 */

import { COMMODITY_IDS } from './core/economy/commodityCatalog.js'

/**
 * @param {string} commodityId
 * @returns {string}
 */
export function commodityPriceOverlayId(commodityId) {
  if (typeof commodityId !== 'string' || commodityId.length === 0) {
    return 'commodityPrice'
  }
  return `commodityPrice${commodityId[0].toUpperCase()}${commodityId.slice(1)}`
}

/** @type {readonly string[]} */
export const COMMODITY_PRICE_OVERLAY_IDS = Object.freeze(
  COMMODITY_IDS.map((commodityId) => commodityPriceOverlayId(commodityId)),
)

/**
 * Claim-style inspect overlays that must not stack (economy magnitude + Control + Loyalty).
 * Terrain rasters and population / settlements / fog / routes stay independently stackable.
 *
 * @type {ReadonlySet<string>}
 */
export const EXCLUSIVE_CLAIM_OVERLAY_IDS = Object.freeze(
  new Set([
    'wealth',
    'portTolls',
    'factionTax',
    ...COMMODITY_PRICE_OVERLAY_IDS,
    'factionTerritory',
    'loyalty',
  ]),
)

/** Economy magnitude overlays owned by the realm-economy panel (not the topbar). */
export const REALM_ECONOMY_OVERLAY_IDS = Object.freeze([
  'wealth',
  'portTolls',
  'factionTax',
  ...COMMODITY_PRICE_OVERLAY_IDS,
])

/**
 * @param {string} overlayId
 * @returns {boolean}
 */
export function isExclusiveClaimOverlayId(overlayId) {
  return EXCLUSIVE_CLAIM_OVERLAY_IDS.has(overlayId)
}

/**
 * @param {string} overlayId
 * @returns {boolean}
 */
export function isRealmEconomyOverlayId(overlayId) {
  return REALM_ECONOMY_OVERLAY_IDS.includes(overlayId)
}

/**
 * @param {string} overlayId
 * @returns {import('./core/economy/commodityCatalog.js').CommodityId | null}
 */
export function commodityIdFromPriceOverlayId(overlayId) {
  if (typeof overlayId !== 'string' || !overlayId.startsWith('commodityPrice')) {
    return null
  }
  const suffix = overlayId.slice('commodityPrice'.length)
  if (!suffix) return null
  const commodityId = /** @type {import('./core/economy/commodityCatalog.js').CommodityId} */ (
    `${suffix[0].toLowerCase()}${suffix.slice(1)}`
  )
  return COMMODITY_IDS.includes(commodityId) ? commodityId : null
}
