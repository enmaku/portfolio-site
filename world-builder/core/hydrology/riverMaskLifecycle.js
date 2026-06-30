/**
 * River mask lifecycle across hydrology substeps.
 *
 * sketch (hydrologyRoute) → incised (hydrologyIncise) → settled (hydrologyExtract)
 * → presentation (hydrologyRefine | skipRefine) → painted (hydrologyPaint)
 */

/** @typedef {'sketch' | 'incised' | 'settled' | 'presentation' | 'painted'} RiverMaskLifecycleStage */

/** @type {Record<RiverMaskLifecycleStage, string>} */
export const RIVER_MASK_LIFECYCLE_FIELDS = {
  sketch: 'riverNetworkMask',
  incised: 'incisedCorridorMask',
  settled: 'settledRiverNetworkMask',
  presentation: 'presentationRiverNetworkMask',
  painted: 'riverCorridorMask',
}

/** @type {readonly RiverMaskLifecycleStage[]} */
export const RIVER_MASK_LIFECYCLE_ORDER = [
  'sketch',
  'incised',
  'settled',
  'presentation',
  'painted',
]

export const RIVER_MASK_SKIP_REFINE_TRANSITION = 'skipRefine'

/**
 * @param {Uint8Array | null | undefined} presentationMask
 * @param {Uint8Array | null | undefined} settledMask
 * @returns {Uint8Array}
 */
export function resolveDisplayRiverNetworkMask(presentationMask, settledMask) {
  if (presentationMask) return presentationMask
  if (!settledMask) {
    throw new Error('resolveDisplayRiverNetworkMask requires settledRiverNetworkMask')
  }
  return settledMask
}

/**
 * Named transition when hydrologyRefine is skipped: settled centerline becomes presentation.
 * @param {{ settledRiverNetworkMask: Uint8Array | null, presentationRiverNetworkMask: Uint8Array | null }} ctx
 */
export function applySkipRefineTransition(ctx) {
  if (!ctx.settledRiverNetworkMask) {
    throw new Error('skipRefine requires settledRiverNetworkMask')
  }
  ctx.presentationRiverNetworkMask = ctx.settledRiverNetworkMask
}

/**
 * @param {Record<string, unknown>} ctx
 * @returns {Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>}
 */
export function snapshotRiverMaskLifecycle(ctx) {
  /** @type {Partial<Record<RiverMaskLifecycleStage, Uint8Array | null>>} */
  const snapshot = {}
  for (const stage of RIVER_MASK_LIFECYCLE_ORDER) {
    const field = RIVER_MASK_LIFECYCLE_FIELDS[stage]
    const value = ctx[field]
    snapshot[stage] = value instanceof Uint8Array ? value : null
  }
  return snapshot
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
