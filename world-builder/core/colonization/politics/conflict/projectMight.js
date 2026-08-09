/**
 * Project martial capacity along the logistics / trade-candidate graph.
 * Domain: world-builder/CONTEXT.md — Projected might; ADR 0020.
 */

import {
  PROJECTION_FRICTION_COST_SCALE,
  PROJECTION_SOFT_CUTOFF_START_FRACTION,
} from './conflictConstants.js'

/**
 * @typedef {import('../../../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} TradeRouteEdge
 */

/**
 * @param {{
 *   contributorCapacity: number,
 *   fromSettlementId: string,
 *   contestedSettlementId: string,
 *   candidateEdges: TradeRouteEdge[],
 *   strategicReachHaulFractions: {
 *     overland: number,
 *     road: number,
 *     inlandWater: number,
 *     openSea: number,
 *   },
 * }} params
 * @returns {number}
 */
export function projectMight(params) {
  const capacity = Math.max(0, Number(params.contributorCapacity) || 0)
  if (capacity <= 0) return 0

  const fromId = params.fromSettlementId
  const toId = params.contestedSettlementId
  if (!fromId || !toId) return 0
  if (fromId === toId) return capacity

  const path = findCheapestProjectionPath({
    fromSettlementId: fromId,
    contestedSettlementId: toId,
    candidateEdges: params.candidateEdges ?? [],
  })
  if (!path) return 0

  const reachBudget = pathReachBudget(path.modes, params.strategicReachHaulFractions)
  if (!(reachBudget > 0)) return 0

  const haul = path.totalHaulFraction
  const softStart = reachBudget * PROJECTION_SOFT_CUTOFF_START_FRACTION
  let reachFactor = 1
  if (haul >= reachBudget) {
    reachFactor = 0
  } else if (haul > softStart) {
    reachFactor = 1 - (haul - softStart) / (reachBudget - softStart)
  }

  const frictionAttenuation = 1 / (1 + path.totalFrictionCost * PROJECTION_FRICTION_COST_SCALE)
  return capacity * frictionAttenuation * reachFactor
}

/**
 * @param {{
 *   memberSettlementIds: string[],
 *   capacityBySettlementId: Record<string, number>,
 *   contestedSettlementId: string,
 *   candidateEdges: TradeRouteEdge[],
 *   strategicReachHaulFractions: {
 *     overland: number,
 *     road: number,
 *     inlandWater: number,
 *     openSea: number,
 *   },
 * }} params
 * @returns {number}
 */
export function sumFactionProjectedMight(params) {
  let total = 0
  for (const settlementId of params.memberSettlementIds ?? []) {
    total += projectMight({
      contributorCapacity: params.capacityBySettlementId?.[settlementId] ?? 0,
      fromSettlementId: settlementId,
      contestedSettlementId: params.contestedSettlementId,
      candidateEdges: params.candidateEdges,
      strategicReachHaulFractions: params.strategicReachHaulFractions,
    })
  }
  return total
}

/**
 * Cheapest logistics-graph haul from one pin to another, or null when unreachable.
 *
 * @param {{
 *   fromSettlementId: string,
 *   contestedSettlementId: string,
 *   candidateEdges: TradeRouteEdge[],
 * }} params
 * @returns {number | null}
 */
export function projectionPathHaulFraction(params) {
  if (!params.fromSettlementId || !params.contestedSettlementId) return null
  if (params.fromSettlementId === params.contestedSettlementId) return 0
  const path = findCheapestProjectionPath(params)
  if (!path) return null
  return path.totalHaulFraction
}

/**
 * @param {{
 *   fromSettlementId: string,
 *   contestedSettlementId: string,
 *   candidateEdges: TradeRouteEdge[],
 * }} params
 * @returns {{ totalHaulFraction: number, totalFrictionCost: number, modes: string[] } | null}
 */
function findCheapestProjectionPath(params) {
  /** @type {Map<string, TradeRouteEdge[]>} */
  const adj = new Map()
  for (const edge of params.candidateEdges) {
    if (!edge?.fromSettlementId || !edge?.toSettlementId) continue
    pushAdj(adj, edge.fromSettlementId, edge)
    pushAdj(adj, edge.toSettlementId, edge)
  }

  /** @type {Map<string, { cost: number, haul: number, frictionCost: number, modes: string[] }>} */
  const best = new Map()
  best.set(params.fromSettlementId, { cost: 0, haul: 0, frictionCost: 0, modes: [] })

  /** @type {string[]} */
  const queue = [params.fromSettlementId]

  while (queue.length > 0) {
    queue.sort((a, b) => (best.get(a)?.cost ?? Infinity) - (best.get(b)?.cost ?? Infinity))
    const node = queue.shift()
    if (!node) break
    const state = best.get(node)
    if (!state) continue
    if (node === params.contestedSettlementId) {
      return {
        totalHaulFraction: state.haul,
        totalFrictionCost: state.frictionCost,
        modes: state.modes,
      }
    }

    for (const edge of adj.get(node) ?? []) {
      const nextId =
        edge.fromSettlementId === node ? edge.toSettlementId : edge.fromSettlementId
      const friction =
        edge.fromSettlementId === node
          ? edge.directionalFrictionAtoB
          : edge.directionalFrictionBtoA
      const appliedFriction = Number.isFinite(friction) ? friction : 1
      const haulStep = Math.max(0, Number(edge.haulDistanceFraction) || 0)
      const stepFrictionCost = haulStep * appliedFriction
      const nextCost = state.cost + stepFrictionCost
      const prev = best.get(nextId)
      if (prev && prev.cost <= nextCost) continue
      best.set(nextId, {
        cost: nextCost,
        haul: state.haul + haulStep,
        frictionCost: state.frictionCost + stepFrictionCost,
        modes: [...state.modes, edge.mode],
      })
      queue.push(nextId)
    }
  }

  return null
}

/**
 * @param {Map<string, TradeRouteEdge[]>} adj
 * @param {string} id
 * @param {TradeRouteEdge} edge
 */
function pushAdj(adj, id, edge) {
  const list = adj.get(id)
  if (list) list.push(edge)
  else adj.set(id, [edge])
}

/**
 * @param {string[]} modes
 * @param {{
 *   overland: number,
 *   road: number,
 *   inlandWater: number,
 *   openSea: number,
 * }} reach
 * @returns {number}
 */
function pathReachBudget(modes, reach) {
  if (!modes.length) return reach.road
  let minBudget = Infinity
  for (const mode of modes) {
    const budget = reach[mode] ?? reach.overland
    if (budget < minBudget) minBudget = budget
  }
  return Number.isFinite(minBudget) ? minBudget : 0
}
