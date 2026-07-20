/**
 * Shared path capacity burn + flow recording for on-map and off-map clearing.
 * Domain: world-builder/CONTEXT.md — trade clearing, trade route.
 */

import { cargoLbPerUnit } from '../commodityCatalog.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../tradeGraph/routeEconomics.js').TradeRouteMode} TradeRouteMode
 */

/**
 * @typedef {Object} PathFlowLeg
 * @property {string} edgeId
 * @property {string} from
 * @property {string} to
 * @property {TradeRouteMode} mode
 */

/**
 * @typedef {Object} PathCapacityFlowState
 * @property {Map<string, number>} remainingCapLbByEdgeId
 * @property {Array<{
 *   edgeId: string,
 *   fromSettlementId: string,
 *   toSettlementId: string,
 *   commodityId: CommodityId,
 *   amount: number,
 *   mode: TradeRouteMode,
 * }>} flows
 */

/**
 * Burn remaining edge capacity and push one flow row per leg.
 *
 * @param {PathCapacityFlowState} state
 * @param {{
 *   legs: ReadonlyArray<PathFlowLeg>,
 *   commodityId: CommodityId,
 *   amount: number,
 * }} params
 */
export function applyPathCapacityFlows(state, params) {
  const { legs, commodityId, amount } = params
  const cargoLb = cargoLbPerUnit(commodityId)
  for (const leg of legs) {
    state.remainingCapLbByEdgeId.set(
      leg.edgeId,
      (state.remainingCapLbByEdgeId.get(leg.edgeId) ?? 0) - amount * cargoLb,
    )
    state.flows.push({
      edgeId: leg.edgeId,
      fromSettlementId: leg.from,
      toSettlementId: leg.to,
      commodityId,
      amount,
      mode: leg.mode,
    })
  }
}
