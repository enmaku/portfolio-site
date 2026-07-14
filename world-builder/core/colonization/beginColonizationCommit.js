import {
  COLONIZATION_PHASE_SETUP,
  cloneColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { executeBeginColonizationCommitSteps } from './runBeginColonizationCommit.js'

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {Promise<import('./createDefaultColonizationSlice.js').ColonizationSlice>}
 */
export async function beginColonizationCommit(slice, doc) {
  if (slice.colonizationPhase !== COLONIZATION_PHASE_SETUP || !slice.foundingLanding) {
    return slice
  }

  return executeBeginColonizationCommitSteps(cloneColonizationSlice(slice), doc)
}
