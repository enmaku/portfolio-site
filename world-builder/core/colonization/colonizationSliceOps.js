/**
 * Colonization slice merge / clone / serialize helpers.
 */

import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_SLICE_KEYS,
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { logisticsNodeSurveyPatchesForStorage } from './logisticsNodes/scoreLogisticsNodes.js'

/**
 * @typedef {import('./createDefaultColonizationSlice.js').ColonizationSlice} ColonizationSlice
 * @typedef {import('./createDefaultColonizationSlice.js').ColonizationPhase} ColonizationPhase
 */

/**
 * @param {ColonizationPhase} phase
 * @returns {number}
 */
function colonizationPhaseRank(phase) {
  if (phase === COLONIZATION_PHASE_RUNNING) return 2
  if (phase === COLONIZATION_PHASE_SETUP) return 1
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
    if (!candidate) continue
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
 * Persistable colonization session: history + sim state only.
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
  if (!source || typeof source !== 'object') return {}
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
    delete /** @type {Record<string, unknown>} */ (next)[key]
  }
  return next
}
