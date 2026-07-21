/**
 * Pure population survival demand math, with no clearing/ledger dependencies.
 * Domain: world-builder/CONTEXT.md — survival allocation, survival comfort.
 */

/** Edible lb per person per epoch. */
export const FOOD_LB_PER_PERSON = 365
/** Household salt lb per person per epoch. */
export const SALT_LB_PER_PERSON = 5
/** Survival comfort food multiple of baseline demand. */
export const SURVIVAL_COMFORT_FOOD_MULTIPLIER = 1.2

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
