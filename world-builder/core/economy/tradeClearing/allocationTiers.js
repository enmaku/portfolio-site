/**
 * Demand targets for survival, comfort, and material prosperity tiers.
 * Domain: world-builder/CONTEXT.md — survival allocation, survival comfort, material prosperity.
 */

import { CP_PER_GP, referencePriceCp } from '../commodityCatalog.js'

/** Edible lb per person per epoch. */
export const FOOD_LB_PER_PERSON = 365
/** Household salt lb per person per epoch. */
export const SALT_LB_PER_PERSON = 5
/** Survival comfort food multiple of baseline demand. */
export const SURVIVAL_COMFORT_FOOD_MULTIPLIER = 1.2
/** Prosperity target in gp per person per commodity (reference price). */
export const PROSPERITY_GP_PER_PERSON = 1

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
 * @param {number} population
 * @returns {number}
 */
export function survivalFoodDemandLb(population) {
  return Math.max(0, population) * FOOD_LB_PER_PERSON
}

/**
 * @param {number} population
 * @returns {number}
 */
export function survivalSaltDemandLb(population) {
  return Math.max(0, population) * SALT_LB_PER_PERSON
}

/**
 * @param {number} population
 * @returns {number}
 */
export function comfortFoodDemandLb(population) {
  return survivalFoodDemandLb(population) * SURVIVAL_COMFORT_FOOD_MULTIPLIER
}

/**
 * Catalog units for one prosperity commodity at hard 1 gp/person @ reference.
 * @param {CommodityId} commodityId
 * @param {number} population
 * @returns {number}
 */
export function prosperityDemandUnits(commodityId, population) {
  const ref = referencePriceCp(commodityId)
  if (!(ref > 0)) return 0
  return (Math.max(0, population) * PROSPERITY_GP_PER_PERSON * CP_PER_GP) / ref
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
