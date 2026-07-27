/**
 * Min-cost augmenting-path search over the residual candidate graph.
 * Domain: world-builder/CONTEXT.md — trade clearing, transport cost, port toll.
 */

import { cargoLbPerUnit } from '../commodityCatalog.js'

/** @typedef {import('../../colonization/tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} TradeRouteEdge */
/** @typedef {import('../commodityCatalog.js').CommodityId} CommodityId */
/** @typedef {import('../tradeGraph/routeEconomics.js').TradeRouteMode} TradeRouteMode */

/** Water-borne modes that meet inland routes at a port. */
export const WATER_MODES = Object.freeze(new Set(['openSea', 'inlandWater']))

/**
 * @param {TradeRouteMode} mode
 * @returns {'water' | 'land'}
 */
export function modeGroup(mode) {
  return WATER_MODES.has(mode) ? 'water' : 'land'
}

/**
 * Per-unit directional transport cost (cp) for one commodity across an edge.
 *
 * @param {TradeRouteEdge} edge
 * @param {string} fromNode
 * @param {CommodityId} commodityId
 * @returns {number}
 */
export function directedTransportUnitCp(edge, fromNode, commodityId) {
  const friction =
    fromNode === edge.fromSettlementId ? edge.directionalFrictionAtoB : edge.directionalFrictionBtoA
  const applied = edge.mode === 'openSea' ? 1 : Number.isFinite(friction) ? friction : 1
  return edge.transportCostCpPerLb * applied * cargoLbPerUnit(commodityId)
}

/**
 * @typedef {Object} PathLeg
 * @property {string} edgeId
 * @property {string} from
 * @property {string} to
 * @property {TradeRouteMode} mode
 */

/**
 * @typedef {Object} FoundPath
 * @property {string} originId
 * @property {PathLeg[]} legs
 * @property {number} transportUnitCp Sum of transport cost per commodity unit.
 * @property {number} totalUnitCp Transport plus real (non-self) tolls per unit.
 * @property {Array<{ portId: string, unitTollCp: number }>} tollEvents Real toll obligations (importer pays).
 * @property {number} bottleneckUnits Max units the path can carry given residual capacity.
 */

/**
 * Dijkstra over states (node, incoming mode group) so port transfer tolls between
 * water and land legs are priced into mode choice. Load tolls at a water origin and
 * transfer tolls at intermediate ports are real (importer owes the collecting port);
 * the unload toll at the importer nets to zero and is excluded from cost.
 *
 * @param {{
 *   edges: ReadonlyArray<TradeRouteEdge>,
 *   remainingCapLbByEdgeId: Map<string, number>,
 *   sourceIds: ReadonlyArray<string>,
 *   targetId: string,
 *   commodityId: CommodityId,
 *   isPort: (id: string) => boolean,
 *   unitTollCp: number,
 * }} params
 * @returns {FoundPath | null}
 */
export function findMinCostPath(params) {
  const { edges, remainingCapLbByEdgeId, sourceIds, targetId, commodityId, isPort, unitTollCp } =
    params
  const cargoLb = cargoLbPerUnit(commodityId)
  const sources = new Set(sourceIds)
  if (sources.size === 0 || cargoLb <= 0) return null

  /** @type {Map<string, Array<{ edge: TradeRouteEdge, to: string }>>} */
  const adjacency = new Map()
  for (const edge of edges) {
    const remaining = remainingCapLbByEdgeId.get(edge.id) ?? 0
    if (remaining < cargoLb) continue
    pushAdjacency(adjacency, edge.fromSettlementId, { edge, to: edge.toSettlementId })
    pushAdjacency(adjacency, edge.toSettlementId, { edge, to: edge.fromSettlementId })
  }

  /** state key `${node}|${group}` (group: 'none'|'water'|'land') */
  const dist = new Map()
  const transportOf = new Map()
  /** @type {Map<string, { node: string, group: string, edge: TradeRouteEdge | null }>} */
  const prev = new Map()
  /** @type {Array<{ key: string, node: string, group: string, cost: number }>} */
  const heap = []

  for (const src of sources) {
    const key = `${src}|none`
    dist.set(key, 0)
    transportOf.set(key, 0)
    prev.set(key, { node: '', group: '', edge: null })
    heapPush(heap, { key, node: src, group: 'none', cost: 0 })
  }

  /** @type {{ key: string, cost: number } | null} */
  let bestTarget = null
  while (heap.length > 0) {
    const cur = heapPop(heap)
    if (!cur) break
    if (cur.cost > (dist.get(cur.key) ?? Infinity)) continue
    if (cur.node === targetId && !sources.has(targetId)) {
      // Reaching the importer: unload toll (if any) nets to zero, so cost is final.
      if (!bestTarget || cur.cost < bestTarget.cost) bestTarget = { key: cur.key, cost: cur.cost }
      continue
    }
    const neighbors = adjacency.get(cur.node) ?? []
    for (const { edge, to } of neighbors) {
      const group = modeGroup(edge.mode)
      let toll = 0
      if (isPort(cur.node)) {
        if (cur.group === 'none') {
          if (group === 'water') toll = unitTollCp
        } else if (cur.group !== group) {
          toll = unitTollCp
        }
      }
      const stepTransport = directedTransportUnitCp(edge, cur.node, commodityId)
      const nextCost = cur.cost + toll + stepTransport
      const nextKey = `${to}|${group}`
      if (nextCost < (dist.get(nextKey) ?? Infinity) - 1e-12) {
        dist.set(nextKey, nextCost)
        transportOf.set(nextKey, (transportOf.get(cur.key) ?? 0) + stepTransport)
        prev.set(nextKey, { node: cur.node, group: cur.group, edge })
        heapPush(heap, { key: nextKey, node: to, group, cost: nextCost })
      }
    }
  }

  if (!bestTarget) return null
  return reconstruct({
    bestKey: bestTarget.key,
    totalUnitCp: bestTarget.cost,
    transportUnitCp: transportOf.get(bestTarget.key) ?? 0,
    prev,
    isPort,
    unitTollCp,
    remainingCapLbByEdgeId,
    cargoLb,
  })
}

/**
 * @param {{
 *   bestKey: string,
 *   totalUnitCp: number,
 *   transportUnitCp: number,
 *   prev: Map<string, { node: string, group: string, edge: TradeRouteEdge | null }>,
 *   isPort: (id: string) => boolean,
 *   unitTollCp: number,
 *   remainingCapLbByEdgeId: Map<string, number>,
 *   cargoLb: number,
 * }} params
 * @returns {FoundPath}
 */
function reconstruct(params) {
  const { bestKey, prev, isPort, unitTollCp, remainingCapLbByEdgeId, cargoLb } = params
  /** @type {import('./pathSearch.js').PathLeg[]} */
  const legs = []
  let key = bestKey
  let node = key.slice(0, key.lastIndexOf('|'))
  while (true) {
    const step = prev.get(key)
    if (!step || !step.edge) break
    legs.push({ edgeId: step.edge.id, from: step.node, to: node, mode: step.edge.mode })
    node = step.node
    key = `${step.node}|${step.group}`
  }
  legs.reverse()

  const originId = legs.length > 0 ? legs[0].from : node
  /** @type {Array<{ portId: string, unitTollCp: number }>} */
  const tollEvents = []
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i]
    const prevGroup = i === 0 ? 'none' : modeGroup(legs[i - 1].mode)
    const group = modeGroup(leg.mode)
    if (!isPort(leg.from)) continue
    if (prevGroup === 'none') {
      if (group === 'water') tollEvents.push({ portId: leg.from, unitTollCp })
    } else if (prevGroup !== group) {
      tollEvents.push({ portId: leg.from, unitTollCp })
    }
  }

  let bottleneckUnits = Infinity
  for (const leg of legs) {
    const remaining = remainingCapLbByEdgeId.get(leg.edgeId) ?? 0
    bottleneckUnits = Math.min(bottleneckUnits, remaining / cargoLb)
  }

  return {
    originId,
    legs,
    transportUnitCp: params.transportUnitCp,
    totalUnitCp: params.totalUnitCp,
    tollEvents,
    bottleneckUnits,
  }
}

/**
 * @param {Map<string, Array<{ edge: TradeRouteEdge, to: string }>>} adjacency
 * @param {string} node
 * @param {{ edge: TradeRouteEdge, to: string }} entry
 */
function pushAdjacency(adjacency, node, entry) {
  const list = adjacency.get(node) ?? []
  list.push(entry)
  adjacency.set(node, list)
}

/**
 * @param {Array<{ key: string, node: string, group: string, cost: number }>} heap
 * @param {{ key: string, node: string, group: string, cost: number }} entry
 */
function heapPush(heap, entry) {
  heap.push(entry)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (compareEntries(heap[parent], heap[i]) <= 0) break
    const swap = heap[parent]
    heap[parent] = heap[i]
    heap[i] = swap
    i = parent
  }
}

/**
 * @param {Array<{ key: string, node: string, group: string, cost: number }>} heap
 * @returns {{ key: string, node: string, group: string, cost: number } | undefined}
 */
function heapPop(heap) {
  if (heap.length === 0) return undefined
  const min = heap[0]
  const last = heap.pop()
  if (heap.length === 0 || last === undefined) return min
  heap[0] = last
  let i = 0
  while (true) {
    const left = i * 2 + 1
    const right = left + 1
    let smallest = i
    if (left < heap.length && compareEntries(heap[left], heap[smallest]) < 0) smallest = left
    if (right < heap.length && compareEntries(heap[right], heap[smallest]) < 0) smallest = right
    if (smallest === i) break
    const swap = heap[i]
    heap[i] = heap[smallest]
    heap[smallest] = swap
    i = smallest
  }
  return min
}

/**
 * Deterministic ordering: cost, then key, so equal-cost paths resolve stably.
 * @param {{ key: string, cost: number }} a
 * @param {{ key: string, cost: number }} b
 * @returns {number}
 */
function compareEntries(a, b) {
  if (a.cost < b.cost - 1e-12) return -1
  if (a.cost > b.cost + 1e-12) return 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}
