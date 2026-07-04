import { countLivingSettlements, getActiveExpeditions } from './expeditions/expeditionConstants.js'

/**
 * @typedef {Object} ColonizationSimStatus
 * @property {number} epoch
 * @property {number} livingSettlementCount
 * @property {number} activeExpeditionCount
 * @property {boolean} frontierExhausted
 */

/**
 * @typedef {Object} FoundingChronicleEntry
 * @property {string} kind
 * @property {number} epoch
 * @property {string} [settlementId]
 * @property {string} [originSettlementId]
 * @property {string} [logisticsNodePrimaryType]
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {ColonizationSimStatus}
 */
export function buildColonizationSimStatus(slice) {
  return {
    epoch: slice.epoch ?? 0,
    livingSettlementCount: countLivingSettlements(slice.settlements ?? []),
    activeExpeditionCount: getActiveExpeditions(slice).length,
    frontierExhausted: slice.frontierExhausted === true,
  }
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {FoundingChronicleEntry[]}
 */
export function buildFoundingChronicle(slice) {
  const allowedKinds = new Set(['founding', 'settlement_founded', 'settlement_abandoned'])
  return (slice.historyLog ?? [])
    .filter((entry) => allowedKinds.has(entry.kind))
    .map((entry) => ({
      kind: entry.kind,
      epoch: entry.epoch,
      settlementId: entry.settlementId,
      originSettlementId: entry.originSettlementId,
      logisticsNodePrimaryType: entry.logisticsNodePrimaryType,
    }))
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationPhase} phase
 * @param {number} epoch
 * @returns {boolean}
 */
export function shouldShowSimStatusPanel(phase, epoch) {
  return phase === 'running' && epoch > 0
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationPhase} phase
 * @param {number} epoch
 * @returns {boolean}
 */
export function shouldShowValidationAdvisory(phase, epoch, validationRowCount) {
  if (validationRowCount <= 0) return false
  if (phase === 'terrain') return true
  if (phase === 'setup') return true
  return phase === 'running' && epoch === 0
}
