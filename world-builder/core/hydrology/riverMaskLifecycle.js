/**
 * River mask lifecycle across hydrology substeps.
 *
 * Simulation stages (drainage physics):
 *   sketch (hydrologyRoute) → incised (hydrologyIncise) → settled (hydrologyExtract)
 *
 * Presentation stages (map geometry; legacy heuristics opt-in via generation options):
 *   presentation (hydrologyRefine | skipRefine) → painted (hydrologyPaint)
 *
 * World document export (#345 Option A): `riverNetworkMask` = display centerline from
 * presentation-or-settled; `riverCorridorMask` = painted stage only.
 */

/** @typedef {'sketch' | 'incised' | 'settled' | 'presentation' | 'painted'} RiverMaskLifecycleStage */

/** @type {readonly RiverMaskLifecycleStage[]} */
export const RIVER_MASK_LIFECYCLE_ORDER = [
  'sketch',
  'incised',
  'settled',
  'presentation',
  'painted',
]

export const RIVER_MASK_SKIP_REFINE_TRANSITION = 'skipRefine'

export const RIVER_MASK_CONTRACT_PREFIX = 'riverMask.'

/**
 * @typedef {Object} RiverMaskPipeline
 * @property {Uint8Array | null} sketch
 * @property {Uint8Array | null} incised
 * @property {Uint8Array | null} settled
 * @property {Uint8Array | null} presentation
 * @property {Uint8Array | null} painted
 */

/**
 * @param {Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>} [stages]
 * @returns {RiverMaskPipeline}
 */
export function createRiverMaskPipeline(stages = {}) {
  return {
    sketch: stages.sketch ?? null,
    incised: stages.incised ?? null,
    settled: stages.settled ?? null,
    presentation: stages.presentation ?? null,
    painted: stages.painted ?? null,
  }
}

/**
 * @param {RiverMaskLifecycleStage} stage
 * @returns {string}
 */
export function riverMaskContractKey(stage) {
  return `${RIVER_MASK_CONTRACT_PREFIX}${stage}`
}

/**
 * @param {string} key
 * @returns {key is `${typeof RIVER_MASK_CONTRACT_PREFIX}${RiverMaskLifecycleStage}`}
 */
export function isRiverMaskContractKey(key) {
  return key.startsWith(RIVER_MASK_CONTRACT_PREFIX)
}

/**
 * @param {string} key
 * @returns {RiverMaskLifecycleStage}
 */
export function riverMaskStageFromContractKey(key) {
  if (!isRiverMaskContractKey(key)) {
    throw new Error(`Not a river mask contract key: ${key}`)
  }
  return /** @type {RiverMaskLifecycleStage} */ (key.slice(RIVER_MASK_CONTRACT_PREFIX.length))
}

/**
 * @param {RiverMaskPipeline} pipeline
 * @param {RiverMaskLifecycleStage} stage
 * @returns {Uint8Array | null}
 */
export function getRiverMaskStage(pipeline, stage) {
  return pipeline[stage] ?? null
}

/**
 * @param {RiverMaskPipeline} pipeline
 * @param {RiverMaskLifecycleStage} stage
 * @param {Uint8Array | null} mask
 */
export function setRiverMaskStage(pipeline, stage, mask) {
  pipeline[stage] = mask
}

/**
 * @param {RiverMaskPipeline} pipeline
 */
export function applySkipRefineToPipeline(pipeline) {
  const settled = getRiverMaskStage(pipeline, 'settled')
  if (!settled) {
    throw new Error('skipRefine requires settled river mask')
  }
  setRiverMaskStage(pipeline, 'presentation', settled)
}

/**
 * @param {Uint8Array | null | undefined} presentationMask
 * @param {Uint8Array | null | undefined} settledMask
 * @returns {Uint8Array}
 */
export function resolveDisplayRiverNetworkMask(presentationMask, settledMask) {
  if (presentationMask) return presentationMask
  if (!settledMask) {
    throw new Error('resolveDisplayRiverNetworkMask requires settled river mask stage')
  }
  return settledMask
}

/**
 * @param {RiverMaskPipeline} pipeline
 * @returns {Uint8Array}
 */
export function resolveDisplayRiverNetworkMaskFromPipeline(pipeline) {
  return resolveDisplayRiverNetworkMask(
    getRiverMaskStage(pipeline, 'presentation'),
    getRiverMaskStage(pipeline, 'settled'),
  )
}

/**
 * @param {{ riverMaskPipeline: RiverMaskPipeline }} ctx
 * @param {RiverMaskLifecycleStage} stage
 * @returns {Uint8Array | null}
 */
export function getRiverMaskStageFromContext(ctx, stage) {
  return getRiverMaskStage(ctx.riverMaskPipeline, stage)
}

/**
 * @param {{ riverMaskPipeline: RiverMaskPipeline }} ctx
 * @param {RiverMaskLifecycleStage} stage
 * @returns {Uint8Array}
 */
export function requireRiverMaskStageFromContext(ctx, stage) {
  const mask = getRiverMaskStageFromContext(ctx, stage)
  if (!mask) {
    throw new Error(`river mask stage ${stage} required`)
  }
  return mask
}

/**
 * @param {{ riverMaskPipeline: RiverMaskPipeline }} ctx
 */
export function applySkipRefineTransition(ctx) {
  applySkipRefineToPipeline(ctx.riverMaskPipeline)
}

/**
 * @param {RiverMaskPipeline} pipeline
 * @returns {Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>}
 */
export function snapshotRiverMaskPipeline(pipeline) {
  /** @type {Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>} */
  const snapshot = {}
  for (const stage of RIVER_MASK_LIFECYCLE_ORDER) {
    const value = getRiverMaskStage(pipeline, stage)
    snapshot[stage] = value instanceof Uint8Array ? value : null
  }
  return snapshot
}

/**
 * @param {{ riverMaskPipeline: RiverMaskPipeline }} ctx
 * @returns {Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>}
 */
export function snapshotRiverMaskLifecycle(ctx) {
  return snapshotRiverMaskPipeline(ctx.riverMaskPipeline)
}

/**
 * @param {Uint8Array | null | undefined} left
 * @param {Uint8Array | null | undefined} right
 */
export function riverMasksEqual(left, right) {
  if (left === right) return true
  if (!left || !right) return false
  if (left.length !== right.length) return false
  for (let idx = 0; idx < left.length; idx += 1) {
    if (left[idx] !== right[idx]) return false
  }
  return true
}
