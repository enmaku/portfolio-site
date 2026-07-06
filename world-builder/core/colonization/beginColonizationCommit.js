import {
  COLONIZATION_PHASE_SETUP,
  cloneColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { executeBeginColonizationCommitStepsSync } from './runBeginColonizationCommit.js'

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function beginColonizationCommit(slice, doc) {
  if (slice.colonizationPhase !== COLONIZATION_PHASE_SETUP || !slice.foundingLanding) {
    return slice
  }

  return executeBeginColonizationCommitStepsSync(cloneColonizationSlice(slice), doc)
}
