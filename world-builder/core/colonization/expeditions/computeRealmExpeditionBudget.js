import { FRONTIER_EXHAUSTED_DISPATCH_MULTIPLIER } from './expeditionConstants.js'

/**
 * @typedef {Object} RealmExpeditionBudget
 * @property {number} landSlots
 * @property {number} maritimeSlots
 */

/**
 * @param {{
 *   totalPopulation: number,
 *   landFrontierEdges: number,
 *   maritimeFrontierEdges: number,
 *   frontierExhausted: boolean,
 *   eligiblePortCount: number,
 * }} params
 * @returns {RealmExpeditionBudget}
 */
export function computeRealmExpeditionBudget(params) {
  const {
    totalPopulation,
    landFrontierEdges,
    maritimeFrontierEdges,
    frontierExhausted,
    eligiblePortCount,
  } = params

  if (totalPopulation <= 0) {
    return { landSlots: 0, maritimeSlots: 0 }
  }

  const sqrtPop = Math.sqrt(totalPopulation)
  let landSlots = Math.floor(sqrtPop * Math.sqrt(Math.max(0, landFrontierEdges)))
  let maritimeSlots = Math.floor(sqrtPop * Math.sqrt(Math.max(0, maritimeFrontierEdges)))

  if (frontierExhausted) {
    landSlots = Math.floor(landSlots * FRONTIER_EXHAUSTED_DISPATCH_MULTIPLIER)
  }

  if (maritimeFrontierEdges > 0) {
    maritimeSlots = Math.max(maritimeSlots, eligiblePortCount)
  }

  return { landSlots, maritimeSlots }
}
