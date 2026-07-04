/** @typedef {'terrain' | 'setup' | 'running'} ColonizationPhase */
/** @typedef {'marginal' | 'typical' | 'bountiful'} YieldModifier */

/**
 * @typedef {Object} ColonistSettings
 * @property {number} threeDayHaulDistance
 * @property {number} startingPopulation
 * @property {YieldModifier} yieldModifier
 * @property {number} epochBatch
 */

/**
 * @typedef {Object} FoundingLanding
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} ColonizationSlice
 * @property {ColonizationPhase} colonizationPhase
 * @property {number} epoch
 * @property {ColonistSettings} colonistSettings
 * @property {FoundingLanding | null} foundingLanding
 * @property {object[]} historyLog
 * @property {object[]} settlements
 * @property {object[]} committedTips
 * @property {string | null} realmId
 * @property {Record<string, Array<{ x: number, y: number }>>} primaryClaim
 * @property {Float32Array | null} populationCollapseRaster Derived in-memory overlay raster; never persisted.
 * @property {object[]} notableFigures
 * @property {Uint8Array | null} visitedCells In-memory exploration fog raster; never persisted.
 * @property {object[]} expeditions Active and completed expedition records.
 * @property {boolean} frontierExhausted All logistics nodes founded or exhausted.
 * @property {import('./roads/roadNetwork.js').RoadSegment[]} roads Persisted overland link geometry.
 * @property {import('./logisticsNodes/scoreLogisticsNodes.js').LogisticsNodeSurveyEntry[]} logisticsNodeSurvey Scored founding candidates.
 */

import { resolveExpeditions } from './expeditions/expeditionConstants.js'
import {
  logisticsNodeSurveyPatchesForStorage,
  resolveLogisticsNodeSurvey,
} from './logisticsNodes/scoreLogisticsNodes.js'
import { resolveRoadSegments } from './roads/roadNetwork.js'

export const COLONIZATION_PHASE_TERRAIN = /** @type {const} */ ('terrain')
export const COLONIZATION_PHASE_SETUP = /** @type {const} */ ('setup')
export const COLONIZATION_PHASE_RUNNING = /** @type {const} */ ('running')

/** Persisted colonization slice fields (excludes derived collapse raster). */
export const COLONIZATION_SLICE_KEYS = /** @type {const} */ ([
  'colonizationPhase',
  'epoch',
  'colonistSettings',
  'foundingLanding',
  'historyLog',
  'settlements',
  'committedTips',
  'realmId',
  'primaryClaim',
  'notableFigures',
  'visitedCells',
  'expeditions',
  'frontierExhausted',
  'roads',
  'logisticsNodeSurvey',
])

/** Derived overlay fields rebuilt on hydrate; never written to session or terrain caches. */
export const COLONIZATION_DERIVED_WORLD_DOCUMENT_KEYS = /** @type {const} */ ([
  'populationCollapseRaster',
  'visitedCells',
])

/** Present-day fields rebuilt from geography + settlements on hydrate; not stored in session caches. */
export const COLONIZATION_RECOMPUTE_ON_HYDRATE_KEYS = /** @type {const} */ ([
  'primaryClaim',
])

export const DEFAULT_THREE_DAY_HAUL_DISTANCE = 50
/** Upper bound for author scale calibration. */
export const MAX_THREE_DAY_HAUL_DISTANCE = 100
export const DEFAULT_STARTING_POPULATION = 100
export const DEFAULT_YIELD_MODIFIER = /** @type {YieldModifier} */ ('typical')
export const DEFAULT_EPOCH_BATCH = 50

/**
 * @returns {ColonistSettings}
 */
export function createDefaultColonistSettings() {
  return {
    threeDayHaulDistance: DEFAULT_THREE_DAY_HAUL_DISTANCE,
    startingPopulation: DEFAULT_STARTING_POPULATION,
    yieldModifier: DEFAULT_YIELD_MODIFIER,
    epochBatch: DEFAULT_EPOCH_BATCH,
  }
}

/**
 * @returns {ColonizationSlice}
 */
export function createDefaultColonizationSlice() {
  return {
    colonizationPhase: COLONIZATION_PHASE_TERRAIN,
    epoch: 0,
    colonistSettings: createDefaultColonistSettings(),
    foundingLanding: null,
    historyLog: [],
    settlements: [],
    committedTips: [],
    realmId: null,
    primaryClaim: {},
    populationCollapseRaster: null,
    notableFigures: [],
    visitedCells: null,
    expeditions: [],
    frontierExhausted: false,
    roads: [],
    logisticsNodeSurvey: [],
  }
}

/**
 * @param {unknown} value
 * @returns {ColonizationSlice}
 */
export function resolveColonizationSlice(value) {
  const defaults = createDefaultColonizationSlice()
  if (!value || typeof value !== 'object') {
    return defaults
  }
  const incoming = /** @type {Partial<ColonizationSlice>} */ (value)
  const phase = incoming.colonizationPhase
  const colonizationPhase =
    phase === COLONIZATION_PHASE_SETUP ||
    phase === COLONIZATION_PHASE_RUNNING ||
    phase === COLONIZATION_PHASE_TERRAIN
      ? phase
      : defaults.colonizationPhase

  return {
    colonizationPhase,
    colonistSettings: resolveColonistSettings(incoming.colonistSettings),
    foundingLanding: resolveFoundingLanding(incoming.foundingLanding),
    historyLog: Array.isArray(incoming.historyLog) ? incoming.historyLog.map((row) => ({ ...row })) : [],
    settlements: Array.isArray(incoming.settlements)
      ? incoming.settlements.map((row) => ({ ...row }))
      : [],
    committedTips: Array.isArray(incoming.committedTips)
      ? incoming.committedTips.map((row) => ({ ...row }))
      : [],
    realmId: typeof incoming.realmId === 'string' ? incoming.realmId : null,
    epoch: Number.isFinite(incoming.epoch) ? /** @type {number} */ (incoming.epoch) : 0,
    primaryClaim: resolvePrimaryClaim(incoming.primaryClaim),
    populationCollapseRaster: null,
    notableFigures: Array.isArray(incoming.notableFigures)
      ? incoming.notableFigures.map((row) => ({ ...row }))
      : [],
    visitedCells: null,
    expeditions: resolveExpeditions(incoming.expeditions),
    frontierExhausted: incoming.frontierExhausted === true,
    roads: resolveRoadSegments(incoming.roads),
    logisticsNodeSurvey: resolveLogisticsNodeSurvey(incoming.logisticsNodeSurvey),
  }
}

/**
 * @param {unknown} value
 * @returns {Record<string, Array<{ x: number, y: number }>>}
 */
function resolvePrimaryClaim(value) {
  if (!value || typeof value !== 'object') {
    return {}
  }
  /** @type {Record<string, Array<{ x: number, y: number }>>} */
  const resolved = {}
  for (const [settlementId, cells] of Object.entries(value)) {
    if (!Array.isArray(cells)) continue
    resolved[settlementId] = cells
      .filter((cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
      .map((cell) => ({ x: /** @type {number} */ (cell.x), y: /** @type {number} */ (cell.y) }))
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {ColonistSettings}
 */
export function resolveColonistSettings(value) {
  const defaults = createDefaultColonistSettings()
  if (!value || typeof value !== 'object') {
    return defaults
  }
  const incoming = /** @type {Partial<ColonistSettings>} */ (value)
  const yieldModifier =
    incoming.yieldModifier === 'marginal' ||
    incoming.yieldModifier === 'typical' ||
    incoming.yieldModifier === 'bountiful'
      ? incoming.yieldModifier
      : defaults.yieldModifier

  return {
    threeDayHaulDistance: clampPositiveNumber(
      incoming.threeDayHaulDistance,
      defaults.threeDayHaulDistance,
      MAX_THREE_DAY_HAUL_DISTANCE,
    ),
    startingPopulation: positiveNumberOr(
      incoming.startingPopulation,
      defaults.startingPopulation,
    ),
    yieldModifier,
    epochBatch: positiveNumberOr(incoming.epochBatch, defaults.epochBatch),
  }
}

/**
 * @param {unknown} value
 * @returns {FoundingLanding | null}
 */
function resolveFoundingLanding(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const incoming = /** @type {{ x?: unknown, y?: unknown }} */ (value)
  if (!Number.isFinite(incoming.x) || !Number.isFinite(incoming.y)) {
    return null
  }
  return { x: /** @type {number} */ (incoming.x), y: /** @type {number} */ (incoming.y) }
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function positiveNumberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} max
 * @returns {number}
 */
function clampPositiveNumber(value, fallback, max) {
  const resolved = positiveNumberOr(value, fallback)
  return Math.min(resolved, max)
}

/**
 * @param {ColonizationPhase} phase
 * @returns {number}
 */
function colonizationPhaseRank(phase) {
  if (phase === COLONIZATION_PHASE_RUNNING) {
    return 2
  }
  if (phase === COLONIZATION_PHASE_SETUP) {
    return 1
  }
  return 0
}

/**
 * Pick the furthest-along colonization session among candidates (running beats setup).
 *
 * @param {...(ColonizationSlice | null | undefined)} candidates
 * @returns {ColonizationSlice}
 */
export function mergeColonizationSessions(...candidates) {
  let best = createDefaultColonizationSlice()
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    const resolved = resolveColonizationSlice(candidate)
    const resolvedRank = colonizationPhaseRank(resolved.colonizationPhase)
    const bestRank = colonizationPhaseRank(best.colonizationPhase)
    if (resolvedRank > bestRank || (resolvedRank === bestRank && resolved.epoch > best.epoch)) {
      best = resolved
    }
  }
  return best
}

/**
 * @param {ColonizationSlice} slice
 * @returns {ColonizationSlice}
 */
export function cloneColonizationSlice(slice) {
  const resolved = resolveColonizationSlice(slice)
  const raster = slice?.populationCollapseRaster
  if (raster instanceof Float32Array) {
    resolved.populationCollapseRaster = new Float32Array(raster)
  }
  const visited = slice?.visitedCells
  if (visited instanceof Uint8Array) {
    resolved.visitedCells = new Uint8Array(visited)
  }
  return resolved
}

/**
 * Persistable colonization session: history + sim state only. Overlay rasters, present-day
 * claim maps, and full logistics surveys are rebuilt on hydrate.
 *
 * @param {ColonizationSlice} slice
 * @returns {Omit<ColonizationSlice, 'populationCollapseRaster' | 'visitedCells' | 'primaryClaim'>}
 */
export function serializeColonizationSessionForStorage(slice) {
  const resolved = resolveColonizationSlice(slice)
  const {
    populationCollapseRaster,
    visitedCells,
    primaryClaim,
    logisticsNodeSurvey,
    ...persistedCore
  } = resolved
  void populationCollapseRaster
  void visitedCells
  void primaryClaim

  const persistable = {
    ...persistedCore,
    logisticsNodeSurvey: logisticsNodeSurveyPatchesForStorage(logisticsNodeSurvey),
  }

  return /** @type {Omit<ColonizationSlice, 'populationCollapseRaster' | 'visitedCells' | 'primaryClaim'>} */ (
    JSON.parse(JSON.stringify(persistable))
  )
}

/**
 * @param {object | null | undefined} source
 * @returns {Partial<ColonizationSlice>}
 */
export function pickColonizationSliceFields(source) {
  if (!source || typeof source !== 'object') {
    return {}
  }
  /** @type {Partial<ColonizationSlice>} */
  const picked = {}
  const record = /** @type {Record<string, unknown>} */ (source)
  for (const key of COLONIZATION_SLICE_KEYS) {
    if (key in record) {
      picked[key] = /** @type {ColonizationSlice[typeof key]} */ (record[key])
    }
  }
  return picked
}

/**
 * Geography-only shallow copy (colonization fields removed).
 * @template {object} T
 * @param {T} doc
 * @returns {T}
 */
export function omitColonizationSliceFields(doc) {
  const next = { ...doc }
  for (const key of COLONIZATION_SLICE_KEYS) {
    delete next[key]
  }
  return next
}
