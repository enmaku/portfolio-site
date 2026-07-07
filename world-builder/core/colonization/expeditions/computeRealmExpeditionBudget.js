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
 *   hasUnvisitedSailCells?: boolean,
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
    hasUnvisitedSailCells: unvisitedSailCellsRemain = false,
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

  const maritimeFrontierOpen = maritimeFrontierEdges > 0 || unvisitedSailCellsRemain
  if (maritimeFrontierOpen && eligiblePortCount > 0) {
    maritimeSlots = Math.max(maritimeSlots, eligiblePortCount)
  }

  return { landSlots, maritimeSlots }
}
