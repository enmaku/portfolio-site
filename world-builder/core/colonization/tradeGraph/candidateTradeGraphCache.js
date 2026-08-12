/**
 * Epoch-scoped memo for candidate trade graphs.
 * Fingerprint covers living settlement pins, haul budgets, modes, and road endpoints.
 */

import { buildCandidateTradeGraph } from './buildCandidateRoutes.js'

/**
 * @typedef {import('./buildCandidateRoutes.js').BuildCandidateTradeGraphParams} BuildCandidateTradeGraphParams
 * @typedef {import('./buildCandidateRoutes.js').CandidateTradeGraph} CandidateTradeGraph
 */

/**
 * @typedef {Object} CandidateTradeGraphCache
 * @property {(params: BuildCandidateTradeGraphParams) => CandidateTradeGraph} getOrBuild
 * @property {() => void} clear
 * @property {() => number} size
 */

/**
 * @param {BuildCandidateTradeGraphParams} params
 * @returns {string}
 */
export function fingerprintCandidateTradeGraphParams(params) {
  const settlements = Array.isArray(params?.settlements) ? params.settlements : []
  const living = settlements
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
      pop: Math.max(0, Number(s.population) || 0),
      role: s.maritimeRole ?? 'none',
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const roads = Array.isArray(params?.roads) ? params.roads : []
  const roadParts = roads.map((segment, index) => {
    const cells = Array.isArray(segment?.cells) ? segment.cells : []
    const first = cells[0]
    const last = cells[cells.length - 1]
    const ids = Array.isArray(segment?.settlementIds)
      ? [...segment.settlementIds].sort().join(',')
      : ''
    return [
      index,
      cells.length,
      first ? `${Math.trunc(first.x)},${Math.trunc(first.y)}` : '',
      last ? `${Math.trunc(last.x)},${Math.trunc(last.y)}` : '',
      ids,
      segment?.mode ?? '',
    ].join(':')
  })

  return [
    living.map((s) => `${s.id}|${s.x}|${s.y}|${s.pop}|${s.role}`).join(';'),
    Number(params?.threeDayHaulDistance) || 0,
    Number(params?.inlandSailExpeditionRange) || 0,
    params?.modes === 'land' ? 'land' : 'all',
    roadParts.join('|'),
    params?.movementCost ? `mc:${params.movementCost.length}` : 'mc:0',
    params?.elevation ? `el:${params.elevation.length}` : 'el:0',
    params?.sailMask ? `sm:${params.sailMask.length}` : 'sm:0',
    params?.dryLandMask ? `dl:${params.dryLandMask.length}` : 'dl:0',
  ].join('::')
}

/**
 * @returns {CandidateTradeGraphCache}
 */
export function createCandidateTradeGraphCache() {
  /** @type {Map<string, CandidateTradeGraph>} */
  const store = new Map()

  return {
    getOrBuild(params) {
      const key = fingerprintCandidateTradeGraphParams(params)
      const hit = store.get(key)
      if (hit) return hit
      const built = buildCandidateTradeGraph(params)
      store.set(key, built)
      return built
    },
    clear() {
      store.clear()
    },
    size() {
      return store.size
    },
  }
}

/**
 * @param {CandidateTradeGraphCache | { graphCache?: CandidateTradeGraphCache | null } | null | undefined} ctxOrCache
 * @param {BuildCandidateTradeGraphParams} params
 * @returns {CandidateTradeGraph}
 */
export function getOrBuildCandidateTradeGraph(ctxOrCache, params) {
  const cache =
    ctxOrCache && typeof ctxOrCache.getOrBuild === 'function'
      ? ctxOrCache
      : ctxOrCache?.graphCache && typeof ctxOrCache.graphCache.getOrBuild === 'function'
        ? ctxOrCache.graphCache
        : null
  if (cache) return cache.getOrBuild(params)
  return buildCandidateTradeGraph(params)
}
