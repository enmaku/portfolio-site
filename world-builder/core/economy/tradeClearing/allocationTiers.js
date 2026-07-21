/**
 * Demand targets for survival, comfort, and material prosperity tiers.
 * Domain: world-builder/CONTEXT.md — survival allocation, survival comfort, material prosperity.
 */

import { CP_PER_GP, referencePriceCp } from '../commodityCatalog.js'
import {
  FOOD_LB_PER_PERSON,
  SALT_LB_PER_PERSON,
  SURVIVAL_COMFORT_FOOD_MULTIPLIER,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
  comfortFoodDemandLb,
} from '../survivalDemand.js'

export {
  FOOD_LB_PER_PERSON,
  SALT_LB_PER_PERSON,
  SURVIVAL_COMFORT_FOOD_MULTIPLIER,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
  comfortFoodDemandLb,
}

/** Prosperity target in gp per person per commodity (reference price). */
export const PROSPERITY_GP_PER_PERSON = 1
/**
 * Diamonds use a thinner prosperity slice so claimed mines export more often
 * instead of local demand absorbing the whole haul.
 */
export const DIAMOND_PROSPERITY_GP_PER_PERSON = 0.5

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 */

/** @type {ReadonlyArray<CommodityId>} */
export const PROSPERITY_COMMODITIES = Object.freeze([
  'timber',
  'baseMetals',
  'copper',
  'silver',
  'gold',
  'diamonds',
])

/**
 * @param {CommodityId} commodityId
 * @returns {number}
 */
export function prosperityGpPerPerson(commodityId) {
  return commodityId === 'diamonds' ? DIAMOND_PROSPERITY_GP_PER_PERSON : PROSPERITY_GP_PER_PERSON
}

/**
 * Catalog units for one prosperity commodity at its per-person gp target @ reference.
 * @param {CommodityId} commodityId
 * @param {number} population
 * @returns {number}
 */
export function prosperityDemandUnits(commodityId, population) {
  const ref = referencePriceCp(commodityId)
  if (!(ref > 0)) return 0
  return (Math.max(0, population) * prosperityGpPerPerson(commodityId) * CP_PER_GP) / ref
}

/**
 * Structural / allocation demand: fungible food basket accounted once on grain
 * (fish demand is 0 — clearing treats grain+fish as one food pool). Salt and
 * prosperity match clearing floors. Distinct from sticker priceFormationDemand
 * (which double-books grain and fish at full comfort food).
 *
 * @param {number} population
 * @returns {Record<CommodityId, number>}
 */
export function allocationDemand(population) {
  /** @type {Record<CommodityId, number>} */
  const demand = /** @type {Record<CommodityId, number>} */ ({
    grain: comfortFoodDemandLb(population),
    fish: 0,
    salt: survivalSaltDemandLb(population),
    timber: 0,
    baseMetals: 0,
    copper: 0,
    silver: 0,
    gold: 0,
    diamonds: 0,
  })
  for (const id of PROSPERITY_COMMODITIES) {
    demand[id] = prosperityDemandUnits(id, population)
  }
  return demand
}

/**
 * Physically exportable surplus valued at the given local prices, after reserving
 * local survival floors (food from grain then fish, household salt). Comfort and
 * material prosperity demand do not reserve against this collateral term.
 *
 * @param {{
 *   population: number,
 *   production?: Partial<Record<CommodityId, number>>,
 *   prices?: Partial<Record<CommodityId, number>>,
 * }} params
 * @returns {number}
 */
export function exportableSurplusValueCp(params) {
  const { population, production = {}, prices = {} } = params
  const foodFloor = survivalFoodDemandLb(population)
  const saltFloor = survivalSaltDemandLb(population)
  const grain = Math.max(0, production.grain ?? 0)
  const fish = Math.max(0, production.fish ?? 0)
  const salt = Math.max(0, production.salt ?? 0)

  const grainReserve = Math.min(grain, foodFloor)
  const fishReserve = Math.min(fish, Math.max(0, foodFloor - grainReserve))
  let value = Math.max(0, grain - grainReserve) * (prices.grain ?? 0)
  value += Math.max(0, fish - fishReserve) * (prices.fish ?? 0)
  value += Math.max(0, salt - saltFloor) * (prices.salt ?? 0)
  for (const id of PROSPERITY_COMMODITIES) {
    value += Math.max(0, production[id] ?? 0) * (prices[id] ?? 0)
  }
  return value
}
