import {
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  cloneColonizationSlice,
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from './createDefaultColonizationSlice.js'

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function enterColonizationSetup(slice) {
  const current = cloneColonizationSlice(slice)
  if (current.colonizationPhase !== COLONIZATION_PHASE_TERRAIN) {
    return current
  }
  return {
    ...current,
    colonizationPhase: COLONIZATION_PHASE_SETUP,
  }
}

/**
 * Discards in-progress setup and returns a fresh terrain slice.
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function backToTerrain() {
  return createDefaultColonizationSlice()
}

/**
 * @param {import('../types.js').WorldDocument} doc
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {import('../types.js').WorldDocument}
 */
export function applyColonizationSliceToWorldDocument(doc, slice) {
  const colonization = cloneColonizationSlice(slice)
  return {
    ...doc,
    ...colonization,
  }
}

/**
 * @param {import('../types.js').WorldDocument | null | undefined} doc
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function extractColonizationSliceFromWorldDocument(doc) {
  if (!doc) {
    return createDefaultColonizationSlice()
  }
  return resolveColonizationSlice({
    colonizationPhase: doc.colonizationPhase,
    epoch: doc.epoch,
    colonistSettings: doc.colonistSettings,
    foundingLanding: doc.foundingLanding,
    historyLog: doc.historyLog,
    settlements: doc.settlements,
    committedTips: doc.committedTips,
    realmId: doc.realmId,
  })
}
