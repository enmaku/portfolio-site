import { applyEpochStepSyncFromPhases } from './runColonizationEpochStep.js'

export { runColonizationEpochStep } from './runColonizationEpochStep.js'

/**
 * Advance epochBatch annual ticks. Retains committed tips at post-step present day
 * and history-log event years (abandonment). Quiet intra-batch years are omitted.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ saltSpoilageMultiplierForSettlement?: Function }} [options]
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function applyEpochStep(slice, worldDocument, options = {}) {
  return applyEpochStepSyncFromPhases(slice, worldDocument, options)
}
