/**
 * Geography-proposed candidate trade route graph among living settlements.
 * Domain: world-builder/CONTEXT.md — trade route, route cargo capacity, transport cost.
 */

import { computeHaulShedTravelTimes } from '../computeHaulShedIsochrone.js'
import { buildLandRouteCellMask, resolveRoadSegments } from '../roads/roadNetwork.js'
import { buildDryLandTraversableMask } from '../expeditions/buildDryLandTraversableMask.js'
import { resolveSailTraversableMask } from '../expeditions/expeditionRouting.js'
import {
  directionalHaulFriction,
  routeCargoCapacityLb,
  transportCostCpPerLb,
} from '../../economy/tradeGraph/routeEconomics.js'

/**
 * @typedef {import('../../economy/tradeGraph/routeEconomics.js').TradeRouteMode} TradeRouteMode
 */

/**
 * @typedef {Object} TradeRouteSettlement
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} population
 * @property {string} [status] Only `living` (or omitted) settlements form candidates.
 * @property {'port' | 'inland_sail' | 'none'} [maritimeRole]
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
 * @property {number} directionalFrictionAtoB
 * @property {number} directionalFrictionBtoA
 */

/**
 * @typedef {Object} CandidateTradeGraph
 * @property {TradeRouteEdge[]} edges
 */

/**
 * @typedef {Object} BuildCandidateTradeGraphParams
 * @property {TradeRouteSettlement[]} settlements
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {number} threeDayHaulDistance Haul-shed travel-time budget (one full haul).
 * @property {number} [inlandSailExpeditionRange] Max inland-water candidate path length.
 * @property {Float32Array | null} [movementCost]
 * @property {Float32Array | null} [elevation]
 * @property {import('../../colonization/roads/roadNetwork.js').RoadSegment[] | null} [roads]
 * @property {Uint8Array | null} [sailMask]
 * @property {Uint8Array | null} [dryLandMask]
 * @property {Uint8Array | null} [lakeMask]
 * @property {Uint8Array | null} [riverCorridorMask]
 */

/**
 * Build the deterministic candidate trade graph from settlement geography, roads, and the
 * sail overlay. Candidates exist from geography alone; activation (positive flow) is decided
 * later by trade clearing.
 *
 * @param {BuildCandidateTradeGraphParams} params
 * @returns {CandidateTradeGraph}
 */
export function buildCandidateTradeGraph(params) {
  const gridWidth = Math.trunc(params?.gridWidth ?? 0)
  const gridHeight = Math.trunc(params?.gridHeight ?? 0)
  const budget = Number(params?.threeDayHaulDistance)
  const settlements = resolveLivingSettlements(params?.settlements)

  if (settlements.length < 2 || gridWidth <= 0 || gridHeight <= 0 || !(budget > 0)) {
    return { edges: [] }
  }

  const movementCost = params?.movementCost ?? null
  const elevation = params?.elevation ?? null
  const roadMask = buildLandRouteCellMask(resolveRoadSegments(params?.roads), gridWidth, gridHeight)
  const sailMasks = resolveSailContext(params, gridWidth, gridHeight)

  /** @type {Map<string, TradeRouteEdge>} */
  const edgesById = new Map()

  const roadPairs = collectRoadCandidates({
    settlements,
    roadMask,
    gridWidth,
    gridHeight,
    budget,
    elevation,
    edgesById,
  })

  collectOverlandCandidates({
    settlements,
    gridWidth,
    gridHeight,
    budget,
    movementCost,
    elevation,
    roadPairs,
    edgesById,
  })

  collectInlandWaterCandidates({
    settlements,
    gridWidth,
    gridHeight,
    budget,
    inlandSailExpeditionRange: Number(params?.inlandSailExpeditionRange) || 0,
    elevation,
    sailMasks,
    edgesById,
  })

  collectOpenSeaCandidates({
    settlements,
    gridWidth,
    gridHeight,
    budget,
    sailMasks,
    edgesById,
  })

  const edges = [...edgesById.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { edges }
}

/**
 * @param {TradeRouteSettlement[] | undefined} raw
 * @returns {Array<Required<Pick<TradeRouteSettlement, 'id' | 'x' | 'y' | 'population'>> & { maritimeRole: 'port' | 'inland_sail' | 'none' }>}
 */
function resolveLivingSettlements(raw) {
  if (!Array.isArray(raw)) return []
  const living = raw
    .filter(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        Number.isFinite(s.x) &&
        Number.isFinite(s.y) &&
        (s.status === undefined || s.status === 'living'),
    )
    .map((s) => ({
      id: s.id,
      x: Math.trunc(s.x),
      y: Math.trunc(s.y),
      population: Math.max(0, Number(s.population) || 0),
      maritimeRole: s.maritimeRole ?? 'none',
    }))
  living.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return living
}

/**
 * @param {BuildCandidateTradeGraphParams} params
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {{ sailMask: Uint8Array | null, dryLandMask: Uint8Array | null, doc: object | null }}
 */
function resolveSailContext(params, gridWidth, gridHeight) {
  const elevation = params?.elevation ?? null
  const doc = elevation
    ? {
        gridWidth,
        gridHeight,
        fields: { elevation },
        lakeMask: params?.lakeMask ?? new Uint8Array(gridWidth * gridHeight),
        riverCorridorMask: params?.riverCorridorMask ?? new Uint8Array(gridWidth * gridHeight),
        movementCost: params?.movementCost ?? new Float32Array(gridWidth * gridHeight).fill(1),
      }
    : null

  const sailMask = params?.sailMask ?? (doc ? resolveSailTraversableMask(doc) : null)
  const dryLandMask = params?.dryLandMask ?? (doc ? buildDryLandTraversableMask(doc) : null)
  return { sailMask, dryLandMask, doc }
}

/**
 * @param {{
 *   settlements: ReturnType<typeof resolveLivingSettlements>,
 *   roadMask: Uint8Array,
 *   gridWidth: number,
 *   gridHeight: number,
 *   budget: number,
 *   elevation: Float32Array | null,
 *   edgesById: Map<string, TradeRouteEdge>,
 * }} params
 * @returns {Set<string>} pair keys (fromId::toId) that have a road candidate
 */
function collectRoadCandidates({
  settlements,
  roadMask,
  gridWidth,
  gridHeight,
  budget,
  elevation,
  edgesById,
}) {
  /** @type {Set<string>} */
  const roadPairs = new Set()
  const onNetwork = settlements.filter((s) => roadMask[s.y * gridWidth + s.x] === 1)
  if (onNetwork.length < 2) return roadPairs

  for (let i = 0; i < onNetwork.length; i += 1) {
    const from = onNetwork[i]
    const distances = computeRoadPathDistances(from.y * gridWidth + from.x, roadMask, gridWidth, gridHeight)
    for (let j = i + 1; j < onNetwork.length; j += 1) {
      const to = onNetwork[j]
      const distance = distances[to.y * gridWidth + to.x]
      if (!Number.isFinite(distance)) continue
      const edge = makeEdge({
        from,
        to,
        mode: 'road',
        haulDistanceFraction: distance / budget,
        elevation,
        gridWidth,
      })
      edgesById.set(edge.id, edge)
      roadPairs.add(pairKey(from.id, to.id))
    }
  }
  return roadPairs
}

/**
 * @param {{
 *   settlements: ReturnType<typeof resolveLivingSettlements>,
 *   gridWidth: number,
 *   gridHeight: number,
 *   budget: number,
 *   movementCost: Float32Array | null,
 *   elevation: Float32Array | null,
 *   roadPairs: Set<string>,
 *   edgesById: Map<string, TradeRouteEdge>,
 * }} params
 */
function collectOverlandCandidates({
  settlements,
  gridWidth,
  gridHeight,
  budget,
  movementCost,
  elevation,
  roadPairs,
  edgesById,
}) {
  for (let i = 0; i < settlements.length; i += 1) {
    const from = settlements[i]
    const travelTime = computeHaulShedTravelTimes({
      origin: { x: from.x, y: from.y },
      budget,
      gridWidth,
      gridHeight,
      movementCost,
    })
    for (let j = i + 1; j < settlements.length; j += 1) {
      const to = settlements[j]
      if (roadPairs.has(pairKey(from.id, to.id))) continue
      const time = travelTime[to.y * gridWidth + to.x]
      if (!Number.isFinite(time) || time > budget) continue
      const edge = makeEdge({
        from,
        to,
        mode: 'overland',
        haulDistanceFraction: time / budget,
        elevation,
        gridWidth,
      })
      edgesById.set(edge.id, edge)
    }
  }
}

/**
 * Sail-overlay connectivity within inland range (shortest path on sail mask, capped by range).
 *
 * @param {{
 *   settlements: ReturnType<typeof resolveLivingSettlements>,
 *   gridWidth: number,
 *   gridHeight: number,
 *   budget: number,
 *   inlandSailExpeditionRange: number,
 *   elevation: Float32Array | null,
 *   sailMasks: ReturnType<typeof resolveSailContext>,
 *   edgesById: Map<string, TradeRouteEdge>,
 * }} params
 */
function collectInlandWaterCandidates({
  settlements,
  gridWidth,
  gridHeight,
  budget,
  inlandSailExpeditionRange,
  elevation,
  sailMasks,
  edgesById,
}) {
  const { sailMask } = sailMasks
  if (!sailMask || inlandSailExpeditionRange <= 0 || gridWidth <= 0 || gridHeight <= 0) return

  const onSail = settlements.filter((s) => sailMask[s.y * gridWidth + s.x] === 1)
  if (onSail.length < 2) return

  for (let i = 0; i < onSail.length; i += 1) {
    const from = onSail[i]
    const distances = computeSailPathDistances(
      from.y * gridWidth + from.x,
      sailMask,
      gridWidth,
      gridHeight,
      inlandSailExpeditionRange,
    )
    for (let j = i + 1; j < onSail.length; j += 1) {
      const to = onSail[j]
      const length = distances[to.y * gridWidth + to.x]
      if (!Number.isFinite(length) || length > inlandSailExpeditionRange) continue
      const edge = makeEdge({
        from,
        to,
        mode: 'inlandWater',
        haulDistanceFraction: length / budget,
        elevation,
        gridWidth,
      })
      edgesById.set(edge.id, edge)
    }
  }
}

/**
 * Geometric shortest-path distance over sail-overlay cells (8-connected), capped by maxRange.
 *
 * @param {number} originIndex
 * @param {Uint8Array} sailMask
 * @param {number} width
 * @param {number} height
 * @param {number} maxRange
 * @returns {Float64Array} distance per cell; Infinity when off-sail or unreachable within range
 */
function computeSailPathDistances(originIndex, sailMask, width, height, maxRange) {
  const cellCount = width * height
  const distance = new Float64Array(cellCount).fill(Number.POSITIVE_INFINITY)
  if (sailMask[originIndex] !== 1 || !(maxRange > 0)) return distance

  distance[originIndex] = 0
  /** @type {Array<{ index: number, dist: number }>} */
  const heap = [{ index: originIndex, dist: 0 }]

  while (heap.length > 0) {
    const current = popMinDistance(heap)
    if (!current) break
    if (current.dist > distance[current.index]) continue
    if (current.dist >= maxRange) continue
    const cx = current.index % width
    const cy = Math.floor(current.index / width)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nextIndex = ny * width + nx
        if (sailMask[nextIndex] !== 1) continue
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
        const nextDist = current.dist + step
        if (nextDist > maxRange || nextDist >= distance[nextIndex]) continue
        distance[nextIndex] = nextDist
        pushMinDistance(heap, { index: nextIndex, dist: nextDist })
      }
    }
  }
  return distance
}

/**
 * Every living port pair gets an open-sea candidate. Length is sail-overlay shortest path
 * when both pins are sail-connected; otherwise Euclidean (same fallback as before).
 *
 * @param {{
 *   settlements: ReturnType<typeof resolveLivingSettlements>,
 *   gridWidth: number,
 *   gridHeight: number,
 *   budget: number,
 *   sailMasks: ReturnType<typeof resolveSailContext>,
 *   edgesById: Map<string, TradeRouteEdge>,
 * }} params
 */
function collectOpenSeaCandidates({ settlements, gridWidth, gridHeight, budget, sailMasks, edgesById }) {
  const ports = settlements.filter((s) => s.maritimeRole === 'port')
  if (ports.length < 2) return
  const { sailMask } = sailMasks
  const useSailPaths = Boolean(sailMask) && gridWidth > 0 && gridHeight > 0

  for (let i = 0; i < ports.length; i += 1) {
    const from = ports[i]
    const distances = useSailPaths
      ? computeSailPathDistances(
          from.y * gridWidth + from.x,
          /** @type {Uint8Array} */ (sailMask),
          gridWidth,
          gridHeight,
          Number.POSITIVE_INFINITY,
        )
      : null
    for (let j = i + 1; j < ports.length; j += 1) {
      const to = ports[j]
      const sailDist = distances ? distances[to.y * gridWidth + to.x] : Number.POSITIVE_INFINITY
      const length = Number.isFinite(sailDist)
        ? sailDist
        : Math.hypot(to.x - from.x, to.y - from.y)
      const edge = makeEdge({
        from,
        to,
        mode: 'openSea',
        haulDistanceFraction: length / budget,
        elevation: null,
        gridWidth,
      })
      edgesById.set(edge.id, edge)
    }
  }
}

/**
 * @param {{
 *   from: { id: string, x: number, y: number, population: number },
 *   to: { id: string, x: number, y: number, population: number },
 *   mode: TradeRouteMode,
 *   haulDistanceFraction: number,
 *   elevation: Float32Array | null,
 *   gridWidth: number,
 * }} params
 * @returns {TradeRouteEdge}
 */
function makeEdge({ from, to, mode, haulDistanceFraction, elevation, gridWidth }) {
  const ordered = from.id <= to.id ? { a: from, b: to } : { a: to, b: from }
  const fromElevation = elevation ? elevation[ordered.a.y * gridWidth + ordered.a.x] : undefined
  const toElevation = elevation ? elevation[ordered.b.y * gridWidth + ordered.b.x] : undefined
  const directionalFrictionAtoB = directionalHaulFriction({ mode, fromElevation, toElevation })
  const directionalFrictionBtoA = directionalHaulFriction({
    mode,
    fromElevation: toElevation,
    toElevation: fromElevation,
  })
  return {
    id: `${ordered.a.id}::${ordered.b.id}::${mode}`,
    fromSettlementId: ordered.a.id,
    toSettlementId: ordered.b.id,
    mode,
    haulDistanceFraction,
    capacityLb: routeCargoCapacityLb({
      populationA: ordered.a.population,
      populationB: ordered.b.population,
      mode,
    }),
    transportCostCpPerLb: transportCostCpPerLb({ mode, haulDistanceFraction, directionalFriction: 1 }),
    directionalFrictionAtoB,
    directionalFrictionBtoA,
  }
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function pairKey(a, b) {
  return a <= b ? `${a}::${b}` : `${b}::${a}`
}

/**
 * Geometric shortest-path distance over road cells only (8-connected).
 *
 * @param {number} originIndex
 * @param {Uint8Array} roadMask
 * @param {number} width
 * @param {number} height
 * @returns {Float64Array} distance per cell; Infinity when off-network or unreachable
 */
function computeRoadPathDistances(originIndex, roadMask, width, height) {
  const cellCount = width * height
  const distance = new Float64Array(cellCount).fill(Number.POSITIVE_INFINITY)
  if (roadMask[originIndex] !== 1) return distance

  distance[originIndex] = 0
  /** @type {Array<{ index: number, dist: number }>} */
  const heap = [{ index: originIndex, dist: 0 }]

  while (heap.length > 0) {
    const current = popMinDistance(heap)
    if (!current) break
    if (current.dist > distance[current.index]) continue
    const cx = current.index % width
    const cy = Math.floor(current.index / width)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nextIndex = ny * width + nx
        if (roadMask[nextIndex] !== 1) continue
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
        const nextDist = current.dist + step
        if (nextDist >= distance[nextIndex]) continue
        distance[nextIndex] = nextDist
        pushMinDistance(heap, { index: nextIndex, dist: nextDist })
      }
    }
  }
  return distance
}

/**
 * @param {Array<{ index: number, dist: number }>} heap
 * @param {{ index: number, dist: number }} entry
 */
function pushMinDistance(heap, entry) {
  heap.push(entry)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent].dist <= heap[i].dist) break
    const swap = heap[parent]
    heap[parent] = heap[i]
    heap[i] = swap
    i = parent
  }
}

/**
 * @param {Array<{ index: number, dist: number }>} heap
 * @returns {{ index: number, dist: number } | undefined}
 */
function popMinDistance(heap) {
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
    if (left < heap.length && heap[left].dist < heap[smallest].dist) smallest = left
    if (right < heap.length && heap[right].dist < heap[smallest].dist) smallest = right
    if (smallest === i) break
    const swap = heap[i]
    heap[i] = heap[smallest]
    heap[smallest] = swap
    i = smallest
  }
  return min
}
