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
 */

export const COLONIZATION_PHASE_TERRAIN = /** @type {const} */ ('terrain')
export const COLONIZATION_PHASE_SETUP = /** @type {const} */ ('setup')
export const COLONIZATION_PHASE_RUNNING = /** @type {const} */ ('running')

/** Document / session field names owned by the colonization slice. */
export const COLONIZATION_SLICE_KEYS = /** @type {const} */ ([
  'colonizationPhase',
  'epoch',
  'colonistSettings',
  'foundingLanding',
  'historyLog',
  'settlements',
  'committedTips',
  'realmId',
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
  }
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
 * @param {ColonizationSlice} slice
 * @returns {ColonizationSlice}
 */
export function cloneColonizationSlice(slice) {
  return resolveColonizationSlice(slice)
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
