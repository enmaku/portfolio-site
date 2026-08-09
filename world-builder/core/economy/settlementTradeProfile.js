/**
 * Structural pre-trade surplus/deficit for campaign-kit inspect.
 * Domain: world-builder/CONTEXT.md — settlement trade profile.
 */

import { COMMODITY_IDS } from './commodityCatalog.js'
import { emptyCommodityAmounts } from './productionAccounting.js'
import { allocationDemand } from './tradeClearing/allocationTiers.js'
import { computeClaimProduction } from './founding/computeClaimProduction.js'

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
 * @param {Partial<Record<CommodityId, number>> | null | undefined} partial
 * @returns {Record<CommodityId, number>}
 */
function fillCommodityAmounts(partial) {
  const amounts = emptyCommodityAmounts()
  if (!partial) return amounts
  for (const id of COMMODITY_IDS) {
    const value = partial[id]
    if (typeof value === 'number' && Number.isFinite(value)) {
      amounts[id] = value
    }
  }
  return amounts
}

/**
 * @param {{
 *   settlementId: string,
 *   production?: Partial<Record<CommodityId, number>>,
 *   demand?: Partial<Record<CommodityId, number>>,
 *   population?: number,
 * }} params
 * @returns {SettlementTradeProfile}
 */
export function computeSettlementTradeProfile(params) {
  const production = fillCommodityAmounts(params.production)
  const demand =
    params.demand != null
      ? fillCommodityAmounts(params.demand)
      : typeof params.population === 'number' && Number.isFinite(params.population)
        ? allocationDemand(Math.max(0, Math.floor(params.population)))
        : emptyCommodityAmounts()
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

/**
 * Build a structural trade profile from claim production and population demand.
 *
 * @param {{
 *   settlementId: string,
 *   population: number,
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   worldDocument: import('../types.js').WorldDocument,
 *   yieldModifier?: string,
 *   populationDensity?: number,
 * }} params
 * @returns {SettlementTradeProfile}
 */
export function computeSettlementTradeProfileFromClaim(params) {
  const production = computeClaimProduction({
    settlementId: params.settlementId,
    claimedCells: params.claimedCells,
    worldDocument: params.worldDocument,
    yieldModifier: params.yieldModifier ?? 'typical',
    populationDensity: params.populationDensity,
  })
  return computeSettlementTradeProfile({
    settlementId: params.settlementId,
    production,
    population: params.population,
  })
}

/**
 * Commodities the settlement structurally supplies (surplus) or wants (deficit).
 *
 * @param {SettlementTradeProfile} profile
 * @param {ReadonlyArray<CommodityId>} [commodityIds]
 * @returns {{
 *   supplies: Array<{ commodityId: CommodityId, amount: number }>,
 *   wants: Array<{ commodityId: CommodityId, amount: number }>,
 * }}
 */
export function tradeProfileWantsAndSupplies(profile, commodityIds = COMMODITY_IDS) {
  /** @type {Array<{ commodityId: CommodityId, amount: number }>} */
  const supplies = []
  /** @type {Array<{ commodityId: CommodityId, amount: number }>} */
  const wants = []
  for (const commodityId of commodityIds) {
    const amount = profile.surplusOrDeficit[commodityId] ?? 0
    if (amount > 0) supplies.push({ commodityId, amount })
    else if (amount < 0) wants.push({ commodityId, amount: -amount })
  }
  return { supplies, wants }
}
