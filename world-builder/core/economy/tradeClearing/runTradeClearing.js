/**
 * Prioritized minimum-cost multi-commodity trade clearing.
 * Domain: world-builder/CONTEXT.md — trade clearing.
 */

import { emptyCommodityAmounts } from '../productionAccounting.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../tradeGraph/buildCandidateRoutes.js').CandidateTradeGraph} CandidateTradeGraph
 * @typedef {import('../tradeGraph/routeEconomics.js').TradeRouteMode} TradeRouteMode
 */

/**
 * @typedef {'neither' | 'import' | 'export' | 'both'} CommodityTradeRole
 */

/**
 * @typedef {Object} TradeFlow
 * @property {string} edgeId
 * @property {string} fromSettlementId
 * @property {string} toSettlementId
 * @property {CommodityId} commodityId
 * @property {number} amount
 * @property {TradeRouteMode} mode
 */

/**
 * @typedef {Object} TradeClearingResult
 * @property {TradeFlow[]} flows
 * @property {Record<string, Record<CommodityId, CommodityTradeRole>>} settlementCommodityRoles
 * @property {Record<string, Record<CommodityId, number>>} localPricesBySettlementId
 * @property {Array<{ fromSettlementId: string, toSettlementId: string, amountCp: number }>} obligationDeltas
 * @property {Record<string, number>} externalAccountDeltas
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDelivered
 */

/**
 * No-op clearing — full MCF lands with #431.
 *
 * @param {{
 *   settlementIds?: string[],
 *   graph?: CandidateTradeGraph,
 * }} [params]
 * @returns {TradeClearingResult}
 */
export function runTradeClearing(params = {}) {
  const settlementIds = params.settlementIds ?? []
  /** @type {Record<string, Record<CommodityId, CommodityTradeRole>>} */
  const settlementCommodityRoles = {}
  /** @type {Record<string, Record<CommodityId, number>>} */
  const localPricesBySettlementId = {}
  /** @type {Record<string, { foodLb: number, saltLb: number }>} */
  const effectiveDelivered = {}
  for (const id of settlementIds) {
    settlementCommodityRoles[id] = /** @type {Record<CommodityId, CommodityTradeRole>} */ ({
      grain: 'neither',
      fish: 'neither',
      salt: 'neither',
      timber: 'neither',
      baseMetals: 'neither',
      copper: 'neither',
      silver: 'neither',
      gold: 'neither',
      diamonds: 'neither',
    })
    localPricesBySettlementId[id] = emptyCommodityAmounts()
    effectiveDelivered[id] = { foodLb: 0, saltLb: 0 }
  }
  return {
    flows: [],
    settlementCommodityRoles,
    localPricesBySettlementId,
    obligationDeltas: [],
    externalAccountDeltas: {},
    effectiveDelivered,
  }
}
