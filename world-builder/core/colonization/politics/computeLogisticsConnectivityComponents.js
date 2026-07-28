/**
 * Logistics connectivity components among living settlements.
 * Used for post-latch first mint queues and membership *pressure* only —
 * never as per-epoch faction recolor (ADR 0019).
 * Domain: world-builder/CONTEXT.md — Faction, Supply-chain independence.
 */

import { buildCandidateTradeGraph } from '../tradeGraph/buildCandidateRoutes.js'

/**
 * @typedef {Object} LogisticsConnectivityComponent
 * @property {string} key Deterministic key from sorted settlement ids.
 * @property {string[]} settlementIds Sorted living settlement ids in the component.
 */

/**
 * @typedef {Object} LogisticsConnectivityResult
 * @property {LogisticsConnectivityComponent[]} components Sorted by key.
 */

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
 * @returns {LogisticsConnectivityResult}
 */
export function computeLogisticsConnectivityComponents(params) {
  const settlements = resolveLivingSettlements(params?.settlements)
  if (settlements.length === 0) {
    return { components: [] }
  }

  const radius = Number(params?.threeDayHaulDistance)
  const parent = new Map(settlements.map((s) => [s.id, s.id]))

  /**
   * @param {string} id
   * @returns {string}
   */
  function find(id) {
    let cur = id
    while (parent.get(cur) !== cur) {
      const next = /** @type {string} */ (parent.get(cur))
      parent.set(cur, /** @type {string} */ (parent.get(next)))
      cur = /** @type {string} */ (parent.get(cur))
    }
    return cur
  }

  /**
   * @param {string} a
   * @param {string} b
   */
  function union(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  if (radius > 0) {
    for (let i = 0; i < settlements.length; i += 1) {
      for (let j = i + 1; j < settlements.length; j += 1) {
        const a = settlements[i]
        const b = settlements[j]
        if (geometricHaulShedCirclesOverlap(a, b, radius)) {
          union(a.id, b.id)
        }
      }
    }
  }

  const doc = params?.worldDocument
  if (doc && settlements.length >= 2 && radius > 0) {
    const graph = buildCandidateTradeGraph({
      settlements,
      gridWidth: doc.gridWidth,
      gridHeight: doc.gridHeight,
      threeDayHaulDistance: radius,
      inlandSailExpeditionRange: params?.inlandSailExpeditionRange ?? radius * 3,
      movementCost: doc.fields?.movementCost ?? null,
      elevation: doc.fields?.elevation ?? null,
      roads: params?.roads ?? [],
      sailMask: doc.sailMask ?? null,
      lakeMask: doc.lakeMask ?? null,
      riverCorridorMask: doc.riverCorridorMask ?? null,
    })
    for (const edge of graph.edges) {
      if (
        edge.mode === 'road' ||
        edge.mode === 'inland_sail' ||
        edge.mode === 'open_sea' ||
        edge.mode === 'overland'
      ) {
        union(edge.fromSettlementId, edge.toSettlementId)
      }
    }
  }

  /** @type {Map<string, string[]>} */
  const groups = new Map()
  for (const s of settlements) {
    const root = find(s.id)
    const list = groups.get(root) ?? []
    list.push(s.id)
    groups.set(root, list)
  }

  const components = [...groups.values()]
    .map((ids) => {
      const settlementIds = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      return {
        key: settlementIds.join('|'),
        settlementIds,
      }
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  return { components }
}

/**
 * Geometric haul-shed circles share at least one cell when center distance is
 * strictly less than 2× three-day haul radius.
 *
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {number} radius
 * @returns {boolean}
 */
export function geometricHaulShedCirclesOverlap(a, b, radius) {
  if (!(radius > 0)) return false
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy < (2 * radius) * (2 * radius)
}

/**
 * @param {object[] | undefined} raw
 * @returns {Array<{ id: string, x: number, y: number, population: number, maritimeRole?: string }>}
 */
function resolveLivingSettlements(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        Number.isFinite(s.x) &&
        Number.isFinite(s.y) &&
        (s.status === undefined || s.status === 'living') &&
        (s.population === undefined || s.population > 0),
    )
    .map((s) => ({
      id: s.id,
      x: Math.trunc(s.x),
      y: Math.trunc(s.y),
      population: Math.max(0, Number(s.population) || 0),
      maritimeRole: s.maritimeRole,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
