/**
 * Clearing-session state construction for on-map and off-map adapters.
 * Domain: world-builder/CONTEXT.md — trade clearing.
 */

import { emptyCommodityAmounts } from '../productionAccounting.js'
import { computeConnectedMarketPrices } from '../localPrices.js'
import { exportableSurplusValueCp } from './allocationTiers.js'
import { creditLimitCp } from '../ledgers/creditLimit.js'
import { annualSurvivalBasketCp } from '../ledgers/creditRoom.js'
import { roundMoneyCp } from '../formatMoneyCp.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../../colonization/tradeGraph/buildCandidateRoutes.js').CandidateTradeGraph} CandidateTradeGraph
 * @typedef {import('../tradeGraph/routeEconomics.js').TradeRouteMode} TradeRouteMode
 */

/** @typedef {'neither' | 'import' | 'export' | 'both'} CommodityTradeRole */

const EPSILON = 1e-6

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
 * @typedef {Object} ObligationDelta
 * @property {string} fromSettlementId Debtor (importer / toll payer).
 * @property {string} toSettlementId Creditor (exporter / toll collector).
 * @property {number} amountCp
 * @property {'goods' | 'toll'} kind
 */

/**
 * @typedef {Object} OffMapTrade
 * @property {string} settlementId Mediating / exit port.
 * @property {string} originSettlementId Origin exporter or inland importer (may equal settlementId).
 * @property {CommodityId} commodityId
 * @property {'import' | 'export'} direction
 * @property {number} amount Catalog units.
 * @property {number} unitPriceCp Discounted/inflated off-map unit price.
 */

/**
 * @typedef {Object} ClearingStateParams
 * @property {Array<{ id: string, population?: number, maritimeRole?: string }>} [settlements]
 * @property {CandidateTradeGraph} [graph]
 * @property {Record<string, Partial<Record<CommodityId, number>>>} [production]
 * @property {Record<string, number>} [priorRealizedIncomeCp]
 * @property {{
 *   obligations?: import('../ledgers/bilateralObligations.js').BilateralObligation[],
 *   balancesBySettlementId?: Record<string, number>,
 * }} [priorTradeAccounts]
 * @property {Record<string, number>} [externalAccountsCp]
 */

/**
 * @param {ClearingStateParams} [params]
 */
export function createClearingState(params = {}) {
  const settlements = (params.settlements ?? []).map((s) => ({
    id: s.id,
    population: Math.max(0, Number(s.population) || 0),
    isPort: s.maritimeRole === 'port',
  }))
  const edges = params.graph?.edges ?? []
  const production = params.production ?? {}

  const localPrices = computeConnectedMarketPrices({
    settlements: settlements.map((s) => ({ id: s.id, population: s.population })),
    edges,
    production,
  })

  /** @type {Map<string, { id: string, population: number, isPort: boolean }>} */
  const byId = new Map(settlements.map((s) => [s.id, s]))
  /** @type {Map<string, Record<CommodityId, number>>} */
  const held = new Map()
  /** @type {Record<string, Record<CommodityId, CommodityTradeRole>>} */
  const roles = {}
  for (const s of settlements) {
    held.set(s.id, { ...emptyCommodityAmounts(), ...(production[s.id] ?? {}) })
    roles[s.id] = /** @type {Record<CommodityId, CommodityTradeRole>} */ ({ ...neutralRoles() })
  }

  /** @type {Map<string, number>} */
  const remainingCapLbByEdgeId = new Map()
  for (const edge of edges) remainingCapLbByEdgeId.set(edge.id, Math.max(0, edge.capacityLb))

  const creditLimit = new Map(
    settlements.map((s) => [
      s.id,
      creditLimitCp({
        priorRealizedNetExportTollIncomeCp: params.priorRealizedIncomeCp?.[s.id] ?? 0,
        exportableSurplusAfterSurvivalReservationCp: exportableSurplusValueCp({
          population: s.population,
          production: production[s.id] ?? {},
          prices: localPrices[s.id] ?? {},
        }),
      }),
    ]),
  )
  const survivalBasketCp = new Map(
    settlements.map((s) => [s.id, annualSurvivalBasketCp(s.population)]),
  )

  const priorBalances = params.priorTradeAccounts?.balancesBySettlementId ?? {}
  /** @type {Map<string, number>} netOwed: debits − credits (positive = owes) */
  const netOwed = new Map(
    settlements.map((s) => [s.id, -roundMoneyCp(priorBalances[s.id] ?? 0)]),
  )
  /** @type {Map<string, number>} */
  const openingNetOwed = new Map(netOwed)
  /** @type {Map<string, boolean>} */
  const overLimitAtOpen = new Map(
    settlements.map((s) => {
      const owed = netOwed.get(s.id) ?? 0
      const limit = creditLimit.get(s.id) ?? 0
      return [s.id, owed > limit + EPSILON]
    }),
  )

  /** @type {Map<string, number>} absolute external balances (cannot go negative) */
  const externalAccounts = new Map(
    settlements.map((s) => [
      s.id,
      Math.max(0, roundMoneyCp(params.externalAccountsCp?.[s.id] ?? 0)),
    ]),
  )
  const externalInitial = new Map(externalAccounts)

  const priorObligations = Array.isArray(params.priorTradeAccounts?.obligations)
    ? params.priorTradeAccounts.obligations
        .map((row) => ({ ...row, amountCp: roundMoneyCp(row.amountCp) }))
        .filter((row) => row.amountCp > 0)
    : []

  return {
    settlements,
    edges,
    byId,
    held,
    roles,
    localPrices,
    remainingCapLbByEdgeId,
    creditLimit,
    survivalBasketCp,
    netOwed,
    openingNetOwed,
    overLimitAtOpen,
    priorObligations,
    externalAccounts,
    externalInitial,
    /** @type {TradeFlow[]} */
    flows: [],
    /** @type {ObligationDelta[]} */
    obligationDeltas: [],
    /** @type {OffMapTrade[]} */
    offMapTrades: [],
    /** @type {Map<string, number>} Off-map path + loading toll credits this clear. */
    offMapPortTollIncomeCp: new Map(),
    isPort: (/** @type {string} */ id) => byId.get(id)?.isPort === true,
  }
}

/**
 * @typedef {ReturnType<typeof createClearingState>} ClearingState
 */

/** @returns {Record<CommodityId, CommodityTradeRole>} */
function neutralRoles() {
  return /** @type {Record<CommodityId, CommodityTradeRole>} */ ({
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
}
