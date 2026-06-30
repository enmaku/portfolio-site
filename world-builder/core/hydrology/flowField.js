import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'

/** @typedef {'hydrologyRoute' | 'hydrologyExtract' | 'hydrologySettle'} FlowRecomputeStageId */

/** @type {Record<FlowRecomputeStageId, FlowRecomputeStageId>} */
export const FLOW_RECOMPUTE_STAGES = {
  hydrologyRoute: 'hydrologyRoute',
  hydrologyExtract: 'hydrologyExtract',
  hydrologySettle: 'hydrologySettle',
}

/** @typedef {'route-filled-dem' | 'extract-post-incision' | 'settle-post-lake-equilibrium'} FlowRecomputeReasonId */

/** @type {Record<FlowRecomputeStageId, FlowRecomputeReasonId>} */
export const FLOW_RECOMPUTE_REASONS = {
  hydrologyRoute: 'route-filled-dem',
  hydrologyExtract: 'extract-post-incision',
  hydrologySettle: 'settle-post-lake-equilibrium',
}

/**
 * @typedef {Object} FlowRecomputeLogEntry
 * @property {FlowRecomputeStageId} stage
 * @property {string} reason
 * @property {boolean} cached
 */

/**
 * @typedef {Object} FlowFieldSession
 * @property {(params: DeriveOceanMaskParams) => boolean[]} deriveOceanMask
 * @property {(params: RecomputeFullFlowParams) => FullFlowResult} recomputeFullFlow
 * @property {readonly FlowRecomputeLogEntry[]} solveLog
 * @property {number} fullFlowSolveCount
 */

/**
 * @typedef {Object} DeriveOceanMaskParams
 * @property {Float32Array} elevation
 * @property {number} width
 * @property {number} height
 * @property {number} [seaLevel]
 */

/**
 * @typedef {Object} RecomputeFullFlowParams
 * @property {string} reason
 * @property {FlowRecomputeStageId} stage
 * @property {Float32Array} elevation
 * @property {number} width
 * @property {number} height
 * @property {number} [seaLevel]
 * @property {Float32Array} [rainfall]
 * @property {Float32Array} [meltContribution]
 * @property {Float32Array} [cellRunoff]
 * @property {Float32Array} [soilDrainage]
 * @property {number} [soilDrainageScale]
 */

/**
 * @typedef {Object} FullFlowResult
 * @property {Int16Array} flowDirection
 * @property {Float32Array} flowAccumulation
 * @property {boolean[]} ocean
 * @property {string} reason
 * @property {FlowRecomputeStageId} stage
 * @property {boolean} cached
 */

/**
 * @typedef {Object} FlowCacheKey
 * @property {Float32Array} elevation
 * @property {number | undefined} seaLevel
 * @property {Float32Array | undefined} rainfall
 * @property {Float32Array | undefined} meltContribution
 * @property {Float32Array | undefined} cellRunoff
 * @property {Float32Array | undefined} soilDrainage
 * @property {number | undefined} soilDrainageScale
 */

/**
 * @param {FlowCacheKey} left
 * @param {FlowCacheKey} right
 */
function flowCacheKeyMatches(left, right) {
  return (
    left.elevation === right.elevation &&
    left.seaLevel === right.seaLevel &&
    left.rainfall === right.rainfall &&
    left.meltContribution === right.meltContribution &&
    left.cellRunoff === right.cellRunoff &&
    left.soilDrainage === right.soilDrainage &&
    left.soilDrainageScale === right.soilDrainageScale
  )
}

/**
 * @param {RecomputeFullFlowParams} params
 * @returns {FlowCacheKey}
 */
function buildFlowCacheKey(params) {
  return {
    elevation: params.elevation,
    seaLevel: params.seaLevel,
    rainfall: params.rainfall,
    meltContribution: params.meltContribution,
    cellRunoff: params.cellRunoff,
    soilDrainage: params.soilDrainage,
    soilDrainageScale: params.soilDrainageScale,
  }
}

/**
 * @returns {FlowFieldSession}
 */
export function createFlowFieldSession() {
  /** @type {FlowRecomputeLogEntry[]} */
  const solveLog = []
  /** @type {{ key: FlowCacheKey, result: ReturnType<typeof computeFlowAccumulation> } | null} */
  let cache = null

  return {
    get solveLog() {
      return solveLog
    },
    get fullFlowSolveCount() {
      return solveLog.filter((entry) => !entry.cached).length
    },
    deriveOceanMask(params) {
      return deriveOceanMask(params)
    },
    recomputeFullFlow(params) {
      return recomputeFullFlow(params, {
        solveLog,
        getCache: () => cache,
        setCache: (value) => {
          cache = value
        },
      })
    },
  }
}

/**
 * Ocean mask for lake fill without a full D-infinity flow solve.
 * @param {DeriveOceanMaskParams} params
 * @returns {boolean[]}
 */
export function deriveOceanMask({ elevation, width, height, seaLevel }) {
  return isOceanCell(elevation, width, height, seaLevel)
}

/**
 * Full D-infinity flow direction and accumulation solve with explicit stage metadata.
 * @param {RecomputeFullFlowParams} params
 * @param {{
 *   solveLog?: FlowRecomputeLogEntry[],
 *   getCache?: () => { key: FlowCacheKey, result: ReturnType<typeof computeFlowAccumulation> } | null,
 *   setCache?: (value: { key: FlowCacheKey, result: ReturnType<typeof computeFlowAccumulation> }) => void,
 * } | FlowFieldSession} [sessionOrInternals]
 * @returns {FullFlowResult}
 */
export function recomputeFullFlow(
  {
    reason,
    stage,
    elevation,
    width,
    height,
    seaLevel,
    rainfall,
    meltContribution,
    cellRunoff,
    soilDrainage,
    soilDrainageScale,
  },
  sessionOrInternals,
) {
  const internals =
    sessionOrInternals && 'recomputeFullFlow' in sessionOrInternals
      ? null
      : sessionOrInternals
  const solveLog = internals?.solveLog ?? sessionOrInternals?.solveLog
  const getCache = internals?.getCache
  const setCache = internals?.setCache

  const cacheKey = buildFlowCacheKey({
    reason,
    stage,
    elevation,
    width,
    height,
    seaLevel,
    rainfall,
    meltContribution,
    cellRunoff,
    soilDrainage,
    soilDrainageScale,
  })
  const cachedEntry = getCache?.()
  if (cachedEntry && flowCacheKeyMatches(cachedEntry.key, cacheKey)) {
    solveLog?.push({ stage, reason, cached: true })
    return {
      ...cachedEntry.result,
      reason,
      stage,
      cached: true,
    }
  }

  const result = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel,
    rainfall,
    meltContribution,
    cellRunoff,
    soilDrainage,
    soilDrainageScale,
  })
  setCache?.({ key: cacheKey, result })
  solveLog?.push({ stage, reason, cached: false })

  return {
    ...result,
    reason,
    stage,
    cached: false,
  }
}
