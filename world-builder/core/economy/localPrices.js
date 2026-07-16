/**
 * Pre-trade local prices on candidate-route connected markets.
 * Domain: world-builder/CONTEXT.md — local price.
 */

import { COMMODITY_IDS, referencePriceCp } from './commodityCatalog.js'
import {
  PROSPERITY_COMMODITIES,
  comfortFoodDemandLb,
  prosperityDemandUnits,
  survivalSaltDemandLb,
} from './tradeClearing/allocationTiers.js'

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

/**
 * Population-scaled demand target per commodity used for pre-trade price formation.
 * Grain and fish both carry the full comfort food demand because either satisfies
 * food; salt uses household survival demand; prosperity goods use their 1 gp/person
 * reference target.
 *
 * @param {number} population
 * @returns {Record<CommodityId, number>}
 */
export function priceFormationDemand(population) {
  const food = comfortFoodDemandLb(population)
  /** @type {Record<CommodityId, number>} */
  const demand = /** @type {Record<CommodityId, number>} */ ({})
  for (const id of COMMODITY_IDS) {
    demand[id] = 0
  }
  demand.grain = food
  demand.fish = food
  demand.salt = survivalSaltDemandLb(population)
  for (const id of PROSPERITY_COMMODITIES) {
    demand[id] = prosperityDemandUnits(id, population)
  }
  return demand
}

/**
 * Partition settlement ids into connected-market components over candidate edges.
 * Dormant candidates still connect a market.
 *
 * @param {ReadonlyArray<string>} settlementIds
 * @param {ReadonlyArray<{ fromSettlementId: string, toSettlementId: string }>} edges
 * @returns {string[][]} Components, each sorted; component order sorted by first id.
 */
export function connectedMarketComponents(settlementIds, edges) {
  /** @type {Map<string, string>} */
  const parent = new Map()
  const find = (x) => {
    let root = x
    while (parent.get(root) !== root) root = /** @type {string} */ (parent.get(root))
    let cur = x
    while (cur !== root) {
      const next = /** @type {string} */ (parent.get(cur))
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }
  for (const id of settlementIds) parent.set(id, id)
  for (const edge of edges) {
    if (parent.has(edge.fromSettlementId) && parent.has(edge.toSettlementId)) {
      union(edge.fromSettlementId, edge.toSettlementId)
    }
  }
  /** @type {Map<string, string[]>} */
  const groups = new Map()
  for (const id of settlementIds) {
    const root = find(id)
    const bucket = groups.get(root) ?? []
    bucket.push(id)
    groups.set(root, bucket)
  }
  const components = [...groups.values()].map((ids) => ids.slice().sort())
  components.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return components
}

/**
 * Local prices per settlement computed once pre-clearing on candidate-route
 * connected markets. Every settlement in a component shares identical prices.
 *
 * @param {{
 *   settlements: ReadonlyArray<{ id: string, population: number }>,
 *   edges: ReadonlyArray<{ fromSettlementId: string, toSettlementId: string }>,
 *   production: Record<string, Partial<Record<CommodityId, number>>>,
 * }} params
 * @returns {Record<string, Record<CommodityId, number>>}
 */
export function computeConnectedMarketPrices(params) {
  const populationById = new Map(params.settlements.map((s) => [s.id, Math.max(0, s.population || 0)]))
  const settlementIds = params.settlements.map((s) => s.id)
  const components = connectedMarketComponents(settlementIds, params.edges)

  /** @type {Record<string, Record<CommodityId, number>>} */
  const pricesById = {}
  for (const component of components) {
    /** @type {Record<CommodityId, number>} */
    const supply = /** @type {Record<CommodityId, number>} */ ({})
    /** @type {Record<CommodityId, number>} */
    const demand = /** @type {Record<CommodityId, number>} */ ({})
    for (const id of COMMODITY_IDS) {
      supply[id] = 0
      demand[id] = 0
    }
    for (const settlementId of component) {
      const prod = params.production[settlementId] ?? {}
      const demandTargets = priceFormationDemand(populationById.get(settlementId) ?? 0)
      for (const id of COMMODITY_IDS) {
        supply[id] += Math.max(0, prod[id] ?? 0)
        demand[id] += demandTargets[id]
      }
    }
    const prices = computeLocalPrices({ supplyByCommodity: supply, demandByCommodity: demand })
    for (const settlementId of component) {
      pricesById[settlementId] = { ...prices }
    }
  }
  return pricesById
}
