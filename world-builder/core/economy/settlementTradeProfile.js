/**
 * Structural pre-trade surplus/deficit for campaign-kit inspect.
 * Domain: world-builder/CONTEXT.md — settlement trade profile.
 */

import { COMMODITY_IDS } from './commodityCatalog.js'
import { emptyCommodityAmounts } from './productionAccounting.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} SettlementTradeProfile
 * @property {string} settlementId
 * @property {Record<CommodityId, number>} production
 * @property {Record<CommodityId, number>} demand
 * @property {Record<CommodityId, number>} surplusOrDeficit production − demand
 */

/**
 * @param {{
 *   settlementId: string,
 *   production?: Partial<Record<CommodityId, number>>,
 *   demand?: Partial<Record<CommodityId, number>>,
 * }} params
 * @returns {SettlementTradeProfile}
 */
export function computeSettlementTradeProfile(params) {
  const production = emptyCommodityAmounts()
  const demand = emptyCommodityAmounts()
  if (params.production) {
    for (const id of COMMODITY_IDS) {
      const value = params.production[id]
      if (typeof value === 'number' && Number.isFinite(value)) {
        production[id] = value
      }
    }
  }
  if (params.demand) {
    for (const id of COMMODITY_IDS) {
      const value = params.demand[id]
      if (typeof value === 'number' && Number.isFinite(value)) {
        demand[id] = value
      }
    }
  }
  /** @type {Record<CommodityId, number>} */
  const surplusOrDeficit = emptyCommodityAmounts()
  for (const id of COMMODITY_IDS) {
    surplusOrDeficit[id] = production[id] - demand[id]
  }
  return {
    settlementId: params.settlementId,
    production,
    demand,
    surplusOrDeficit,
  }
}
