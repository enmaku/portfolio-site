/**
 * Residual off-map trade against the unseen world.
 * Domain: world-builder/CONTEXT.md — off-map trade, off-map shipping cost, external
 * trade account, port toll.
 */

import { COMMODITY_IDS, cargoLbPerUnit, referencePriceCp } from '../commodityCatalog.js'
import { offMapCargoCapacityLb } from '../tradeGraph/routeEconomics.js'
import {
  PROSPERITY_COMMODITIES,
  comfortFoodDemandLb,
  prosperityDemandUnits,
  survivalSaltDemandLb,
} from './allocationTiers.js'

const EPSILON = 1e-6
/** Baseline port toll: 5% (mirrors runTradeClearing.PORT_TOLL_RATE without a cycle). */
const PORT_TOLL_RATE = 0.05

/**
 * @param {{
 *   referencePriceCp: number,
 *   offMapShippingCost: number,
 *   direction: 'import' | 'export',
 * }} params
 * @returns {number}
 */
export function offMapUnitPriceCp(params) {
  const multiplier = Math.max(1, params.offMapShippingCost)
  if (params.direction === 'import') {
    return params.referencePriceCp * multiplier
  }
  return params.referencePriceCp / multiplier
}

/**
 * Residual off-map clearing: ports export unsold surplus, then spend the resulting
 * external claim (never below zero) on remaining shortfalls. Export loading tolls
 * accrue to the port's external account; import unload tolls net to zero.
 *
 * @param {import('./runTradeClearing.js').ClearingState} state
 */
export function clearOffMapTrade(state) {
  const ports = state.settlements
    .filter((s) => s.isPort)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  for (const port of ports) {
    let budgetLb = offMapCargoCapacityLb(port.population)
    budgetLb = runExports(state, port, budgetLb)
    runImports(state, port, budgetLb)
  }
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{ id: string, population: number }} port
 * @param {number} budgetLb
 * @returns {number} remaining budget
 */
function runExports(state, port, budgetLb) {
  const bag = state.held.get(port.id)
  if (!bag) return budgetLb
  const surplus = exportSurplusByCommodity(bag, port.population)
  let remaining = budgetLb
  for (const commodityId of COMMODITY_IDS) {
    const available = surplus[commodityId]
    if (!(available > EPSILON)) continue
    const cargoLb = cargoLbPerUnit(commodityId)
    const qty = Math.min(available, remaining / cargoLb)
    if (!(qty > EPSILON)) continue
    const unitPriceCp = offMapUnitPriceCp({
      referencePriceCp: referencePriceCp(commodityId),
      offMapShippingCost: state.offMapShippingCost,
      direction: 'export',
    })
    bag[commodityId] -= qty
    remaining -= qty * cargoLb
    const tollCp = PORT_TOLL_RATE * unitPriceCp * qty
    creditExternal(state, port.id, unitPriceCp * qty + tollCp)
    recordOffMap(state, port.id, commodityId, 'export', qty, unitPriceCp)
  }
  return remaining
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {{ id: string, population: number }} port
 * @param {number} budgetLb
 */
function runImports(state, port, budgetLb) {
  const bag = state.held.get(port.id)
  if (!bag) return
  const shortfall = importShortfallByCommodity(bag, port.population)
  let remaining = budgetLb
  for (const commodityId of COMMODITY_IDS) {
    const need = shortfall[commodityId]
    if (!(need > EPSILON)) continue
    const unitPriceCp = offMapUnitPriceCp({
      referencePriceCp: referencePriceCp(commodityId),
      offMapShippingCost: state.offMapShippingCost,
      direction: 'import',
    })
    if (!(unitPriceCp > 0)) continue
    const cargoLb = cargoLbPerUnit(commodityId)
    const affordable = (state.externalAccounts.get(port.id) ?? 0) / unitPriceCp
    const qty = Math.min(need, remaining / cargoLb, affordable)
    if (!(qty > EPSILON)) continue
    bag[commodityId] += qty
    remaining -= qty * cargoLb
    creditExternal(state, port.id, -unitPriceCp * qty)
    recordOffMap(state, port.id, commodityId, 'import', qty, unitPriceCp)
  }
}

/**
 * @param {Record<string, number>} bag
 * @param {number} population
 * @returns {Record<string, number>}
 */
function exportSurplusByCommodity(bag, population) {
  /** @type {Record<string, number>} */
  const surplus = {}
  for (const id of COMMODITY_IDS) surplus[id] = 0

  const foodSurplus = Math.max(0, (bag.grain ?? 0) + (bag.fish ?? 0) - comfortFoodDemandLb(population))
  surplus.grain = Math.min(bag.grain ?? 0, foodSurplus)
  surplus.fish = Math.min(bag.fish ?? 0, Math.max(0, foodSurplus - surplus.grain))
  surplus.salt = Math.max(0, (bag.salt ?? 0) - survivalSaltDemandLb(population))
  for (const id of PROSPERITY_COMMODITIES) {
    surplus[id] = Math.max(0, (bag[id] ?? 0) - prosperityDemandUnits(id, population))
  }
  return surplus
}

/**
 * @param {Record<string, number>} bag
 * @param {number} population
 * @returns {Record<string, number>}
 */
function importShortfallByCommodity(bag, population) {
  /** @type {Record<string, number>} */
  const shortfall = {}
  for (const id of COMMODITY_IDS) shortfall[id] = 0

  const foodShortfall = Math.max(0, comfortFoodDemandLb(population) - (bag.grain ?? 0) - (bag.fish ?? 0))
  shortfall.grain = foodShortfall
  shortfall.salt = Math.max(0, survivalSaltDemandLb(population) - (bag.salt ?? 0))
  for (const id of PROSPERITY_COMMODITIES) {
    shortfall[id] = Math.max(0, prosperityDemandUnits(id, population) - (bag[id] ?? 0))
  }
  return shortfall
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} id
 * @param {number} deltaCp
 */
function creditExternal(state, id, deltaCp) {
  const next = Math.max(0, (state.externalAccounts.get(id) ?? 0) + deltaCp)
  state.externalAccounts.set(id, next)
}

/**
 * @param {import('./runTradeClearing.js').ClearingState} state
 * @param {string} settlementId
 * @param {import('../commodityCatalog.js').CommodityId} commodityId
 * @param {'import' | 'export'} direction
 * @param {number} amount
 * @param {number} unitPriceCp
 */
function recordOffMap(state, settlementId, commodityId, direction, amount, unitPriceCp) {
  state.offMapTrades.push({ settlementId, commodityId, direction, amount, unitPriceCp })
  const roles = state.roles[settlementId]
  if (!roles) return
  const current = roles[commodityId]
  if (current === 'neither') roles[commodityId] = direction
  else if (current !== direction) roles[commodityId] = 'both'
}
