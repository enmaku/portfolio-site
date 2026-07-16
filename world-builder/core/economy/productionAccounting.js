/**
 * Convert claimed production into commodity catalog units (lb / gems).
 * Domain: world-builder/CONTEXT.md — annual commodity flow, mineral deposit.
 */

/** Food productivity unit → edible lb per epoch (100 people × 365 lb). */
export const FOOD_LB_PER_PRODUCTIVITY_UNIT = 36500
/** Salt pin: score × this many lb per claimed pin per epoch. */
export const SALT_LB_PER_SCORE = 10000
/** Timber productivity unit → lb per epoch. */
export const TIMBER_LB_PER_PRODUCTIVITY_UNIT = 16000
/** Metals potential unit → base metals lb per epoch. */
export const BASE_METALS_LB_PER_PRODUCTIVITY_UNIT = 800
/** Typed Cu/Ag/Au claimed deposit → lb per epoch. */
export const PRECIOUS_METAL_LB_PER_EXTRACTION = 1
/** Typed diamond claimed deposit → gems (0.1 lb cargo each) per epoch. */
export const DIAMOND_GEMS_PER_EXTRACTION = 1
/** Salt lb consumed per lb of fish exported (curing at origin). */
export const FISH_CURING_SALT_PER_FISH_LB = 3

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} SettlementProduction
 * @property {string} settlementId
 * @property {Record<CommodityId, number>} amounts Catalog units (lb or gems).
 */

/**
 * Empty production bag for every catalog commodity.
 * @returns {Record<CommodityId, number>}
 */
export function emptyCommodityAmounts() {
  return {
    grain: 0,
    fish: 0,
    salt: 0,
    timber: 0,
    baseMetals: 0,
    copper: 0,
    silver: 0,
    gold: 0,
    diamonds: 0,
  }
}

/**
 * Placeholder seam — full conversion lands with #430.
 *
 * @param {{
 *   settlementId: string,
 *   amounts?: Partial<Record<CommodityId, number>>,
 * }} params
 * @returns {SettlementProduction}
 */
export function computeSettlementProduction(params) {
  const amounts = emptyCommodityAmounts()
  if (params.amounts) {
    for (const [key, value] of Object.entries(params.amounts)) {
      if (key in amounts && typeof value === 'number' && Number.isFinite(value)) {
        amounts[/** @type {CommodityId} */ (key)] = value
      }
    }
  }
  return { settlementId: params.settlementId, amounts }
}
