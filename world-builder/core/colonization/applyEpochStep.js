import { applyEpochStepSyncFromPhases } from './runColonizationEpochStep.js'

export { runColonizationEpochStep } from './runColonizationEpochStep.js'

/**
 * Advance one annual epoch tick. Present-day slice is authoritative; history log
 * entries record milestone events during the tick.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ saltSpoilageMultiplierForSettlement?: Function }} [options]
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function applyEpochStep(slice, worldDocument, options = {}) {
  return applyEpochStepSyncFromPhases(slice, worldDocument, options)
}
