/**
 * Pre-trade local prices on candidate-route connected markets.
 * Domain: world-builder/CONTEXT.md — local price.
 */

import { COMMODITY_IDS, referencePriceCp } from './commodityCatalog.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 */

export const LOCAL_PRICE_MULTIPLIER_MIN = 0.5
export const LOCAL_PRICE_MULTIPLIER_MAX = 2

/**
 * @param {number} supply
 * @param {number} demand
 * @returns {number}
 */
export function localPriceMultiplier(supply, demand) {
  if (!(supply > 0) && !(demand > 0)) {
    return 1
  }
  if (!(supply > 0) && demand > 0) {
    return LOCAL_PRICE_MULTIPLIER_MAX
  }
  if (supply > 0 && !(demand > 0)) {
    return LOCAL_PRICE_MULTIPLIER_MIN
  }
  const raw = Math.sqrt(demand / supply)
  return Math.min(LOCAL_PRICE_MULTIPLIER_MAX, Math.max(LOCAL_PRICE_MULTIPLIER_MIN, raw))
}

/**
 * @param {{
 *   supplyByCommodity: Partial<Record<CommodityId, number>>,
 *   demandByCommodity: Partial<Record<CommodityId, number>>,
 * }} params
 * @returns {Record<CommodityId, number>} Local prices in cp per catalog unit.
 */
export function computeLocalPrices(params) {
  /** @type {Record<CommodityId, number>} */
  const prices = /** @type {Record<CommodityId, number>} */ ({})
  for (const id of COMMODITY_IDS) {
    const supply = params.supplyByCommodity[id] ?? 0
    const demand = params.demandByCommodity[id] ?? 0
    prices[id] = referencePriceCp(id) * localPriceMultiplier(supply, demand)
  }
  return prices
}
