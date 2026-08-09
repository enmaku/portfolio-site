/**
 * Per-tier import credit room for mutual-credit clearing.
 * Domain: world-builder/CONTEXT.md — credit limit.
 */

import { referencePriceCp } from '../commodityCatalog.js'
import { survivalFoodDemandLb, survivalSaltDemandLb } from '../survivalDemand.js'
import { roundMoneyCp } from '../formatMoneyCp.js'

/** Harvest-horizon bridge: survival debt may deepen up to one annual staple basket. */
export const SURVIVAL_DEBT_BRIDGE_YEARS = 1

/** Hard stop: no further survival borrowing once debt exceeds this many years of collateral. */
export const SURVIVAL_DEBT_HARD_STOP_YEARS = 2

/** Local-price ceiling multiple of reference (matches local price formation). */
const SURVIVAL_BASKET_PRICE_CEILING = 2

/**
 * Annual survival staple basket valued at the local-price ceiling (2× reference) so one
 * harvest year of food+salt remains buyable even under scarcity sticker prices.
 *
 * @param {number} population
 * @returns {number}
 */
export function annualSurvivalBasketCp(population) {
  const foodCp =
    survivalFoodDemandLb(population) * referencePriceCp('grain') * SURVIVAL_BASKET_PRICE_CEILING
  const saltCp =
    survivalSaltDemandLb(population) * referencePriceCp('salt') * SURVIVAL_BASKET_PRICE_CEILING
  return roundMoneyCp(foodCp + saltCp)
}

/**
 * @param {{
 *   overLimitAtOpen?: Map<string, boolean>,
 *   openingNetOwed?: Map<string, number>,
 *   netOwed?: Map<string, number>,
 *   creditLimit?: Map<string, number>,
 *   survivalBasketCp?: Map<string, number>,
 * }} state
 * @param {string} importerId
 * @param {'survival' | 'comfort' | 'salt' | 'prosperity'} resourceKind
 * @returns {number}
 */
export function creditRoomCpForImport(state, importerId, resourceKind) {
  const netOwed = state.netOwed?.get(importerId) ?? 0
  const openingNetOwed = state.openingNetOwed?.get(importerId) ?? 0

  // Comfort/prosperity never borrow. Open-debt freezes them for the whole epoch
  // even if staple exports later create a surplus mid-pass.
  if (resourceKind === 'comfort' || resourceKind === 'prosperity') {
    if (openingNetOwed > 0) {
      return 0
    }
    return Math.max(0, -netOwed)
  }

  const overLimit = state.overLimitAtOpen?.get(importerId) === true
  if (overLimit) {
    // Distress: same-epoch earnings only; do not deepen past opening debt.
    return Math.max(0, openingNetOwed - netOwed)
  }

  const collateral = state.creditLimit?.get(importerId) ?? 0
  const basket = state.survivalBasketCp?.get(importerId) ?? 0
  const survivalDebtCap = Math.min(
    SURVIVAL_DEBT_BRIDGE_YEARS * basket,
    SURVIVAL_DEBT_HARD_STOP_YEARS * collateral,
  )
  return Math.max(0, survivalDebtCap - Math.max(0, netOwed))
}

/**
 * @param {import('../commodityCatalog.js').CommodityId} commodityId
 * @returns {'survival' | 'comfort' | 'salt' | 'prosperity'}
 */
export function offMapImportResourceKind(commodityId) {
  if (commodityId === 'salt') return 'salt'
  if (commodityId === 'grain' || commodityId === 'fish') return 'survival'
  return 'prosperity'
}
