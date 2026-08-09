/**
 * Land / short-haul administrative distance for strategic overstretch.
 * Domain: world-builder/CONTEXT.md — Strategic overstretch.
 */

import { computeHaulShedTravelTimes } from '../computeHaulShedIsochrone.js'
import {
  buildLandRouteCellMask,
  DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
  resolveRoadSegments,
} from '../roads/roadNetwork.js'
import { buildCandidateTradeGraph } from '../tradeGraph/buildCandidateRoutes.js'

/**
 * @param {{
 *   settlements: object[],
 *   worldDocument: {
 *     gridWidth: number,
 *     gridHeight: number,
 *     fields?: { elevation?: Float32Array | null, movementCost?: Float32Array | null },
 *     lakeMask?: Uint8Array | null,
 *     riverCorridorMask?: Uint8Array | null,
 *     sailMask?: Uint8Array | null,
 *   },
 *   threeDayHaulDistance: number,
 *   roads?: object[] | null,
 *   inlandSailExpeditionRange?: number,
 * }} params
 * @returns {Map<string, Set<string>>} Undirected adjacency (road + overland only).
 */
export function buildLandAdminAdjacency(params) {
  const settlements = (params.settlements ?? []).filter(
    (s) => s && s.status !== 'ruin' && (s.population === undefined || s.population > 0),
  )
  /** @type {Map<string, Set<string>>} */
  const adj = new Map()
  for (const s of settlements) {
    adj.set(s.id, new Set())
  }
  if (settlements.length < 2) return adj

  const doc = params.worldDocument
  const graph = buildCandidateTradeGraph({
    settlements,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    threeDayHaulDistance: params.threeDayHaulDistance,
    inlandSailExpeditionRange: params.inlandSailExpeditionRange,
    movementCost: doc.fields?.movementCost ?? null,
    elevation: doc.fields?.elevation ?? null,
    roads: params.roads ?? null,
    sailMask: doc.sailMask ?? null,
    lakeMask: doc.lakeMask ?? null,
    riverCorridorMask: doc.riverCorridorMask ?? null,
  })

  for (const edge of graph.edges) {
    if (edge.mode !== 'road' && edge.mode !== 'overland') continue
    adj.get(edge.fromSettlementId)?.add(edge.toSettlementId)
    adj.get(edge.toSettlementId)?.add(edge.fromSettlementId)
  }
  return adj
}

/**
 * Hop count on the land/short-haul settlement graph (sail ignored).
 *
 * @param {Map<string, Set<string>>} adjacency
 * @param {string} fromId
 * @param {string} toId
 * @param {number} [maxHops]
 * @returns {number} Finite hops, or Infinity when unreachable.
 */
export function landHopsBetween(adjacency, fromId, toId, maxHops = 64) {
  if (fromId === toId) return 0
  if (!adjacency.has(fromId) || !adjacency.has(toId)) return Number.POSITIVE_INFINITY
  const q = [[fromId, 0]]
  const seen = new Set([fromId])
  while (q.length) {
    const [id, hops] = q.shift()
    for (const n of adjacency.get(id) ?? []) {
      if (seen.has(n)) continue
      if (n === toId) return hops + 1
      if (hops + 1 >= maxHops) continue
      seen.add(n)
      q.push([n, hops + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

/**
 * Land expedition budget used as strategic overstretch reach from a sender.
 *
 * @param {{ landExpeditionRange: number, threeDayHaulDistance: number }} colonistSettings
 * @returns {number}
 */
export function strategicOverstretchReachBudget(colonistSettings) {
  const haul = Number(colonistSettings?.threeDayHaulDistance)
  const mult = Number(colonistSettings?.landExpeditionRange)
  if (!(haul > 0) || !(mult > 0)) return 0
  return haul * mult
}

/**
 * Whether a candidate founding cell is within the dispatching seat's strategic overstretch reach
 * on land/short-haul (road-aware haul isochrone). Sail does not count.
 *
 * @param {{
 *   origin: { x: number, y: number },
 *   candidateCell: { x: number, y: number },
 *   worldDocument: {
 *     gridWidth: number,
 *     gridHeight: number,
 *     fields?: { movementCost?: Float32Array | null },
 *   },
 *   roads?: object[] | null,
 *   colonistSettings: { landExpeditionRange: number, threeDayHaulDistance: number },
 *   expeditionMode?: 'land' | 'inland_sail' | 'open_sea' | 'sail',
 * }} params
 * @returns {boolean}
 */
export function isWithinStrategicOverstretchReach(params) {
  if (params.expeditionMode === 'land') return true
  const budget = strategicOverstretchReachBudget(params.colonistSettings)
  if (!(budget > 0)) return false
  const { origin, candidateCell, worldDocument } = params
  const { gridWidth, gridHeight } = worldDocument
  if (
    !origin ||
    !candidateCell ||
    !Number.isInteger(gridWidth) ||
    !Number.isInteger(gridHeight) ||
    gridWidth <= 0 ||
    gridHeight <= 0
  ) {
    return false
  }
  const idx = candidateCell.y * gridWidth + candidateCell.x
  if (idx < 0 || idx >= gridWidth * gridHeight) return false

  const roadCellMask = buildLandRouteCellMask(
    resolveRoadSegments(params.roads),
    gridWidth,
    gridHeight,
  )
  const travelTime = computeHaulShedTravelTimes({
    origin,
    budget,
    gridWidth,
    gridHeight,
    movementCost: worldDocument.fields?.movementCost ?? null,
    roadMultiplier: DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
    roadCellMask,
  })
  const t = travelTime[idx]
  return Number.isFinite(t) && t <= budget
}
