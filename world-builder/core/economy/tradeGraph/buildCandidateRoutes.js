/**
 * Geography-proposed candidate trade route graph among living settlements.
 * Domain: world-builder/CONTEXT.md — trade route.
 */

/**
 * @typedef {import('./routeEconomics.js').TradeRouteMode} TradeRouteMode
 */

/**
 * @typedef {Object} TradeRouteEdge
 * @property {string} id
 * @property {string} fromSettlementId
 * @property {string} toSettlementId
 * @property {TradeRouteMode} mode
 * @property {number} haulDistanceFraction Distance in units of three-day haul.
 * @property {number} capacityLb Shared bidirectional cargo capacity.
 * @property {number} transportCostCpPerLb Base transport (direction may adjust).
 * @property {number} [directionalFrictionAtoB]
 * @property {number} [directionalFrictionBtoA]
 */

/**
 * @typedef {Object} CandidateTradeGraph
 * @property {TradeRouteEdge[]} edges
 */

/**
 * Placeholder — full candidate construction lands with #429.
 *
 * @param {{ edges?: TradeRouteEdge[] }} [params]
 * @returns {CandidateTradeGraph}
 */
export function buildCandidateTradeGraph(params = {}) {
  return {
    edges: Array.isArray(params.edges) ? params.edges.map((edge) => ({ ...edge })) : [],
  }
}
