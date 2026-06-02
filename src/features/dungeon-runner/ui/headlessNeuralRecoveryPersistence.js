import {
  NEURAL_RECOVERY_TERMINAL,
  neuralRecoverySnapshotHasTerminal,
} from '../nn/recovery.js'
import { needsHeadlessCompletion } from './humanEliminationCompletionPolicy.js'
import { resolveNeuralRecoveryTerminalUx } from './neuralSeatRecoveryView.js'

/**
 * @param {object} match
 * @param {ReturnType<import('../nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>} recovery
 */
export function attachNeuralRecoverySnapshotToMatch(match, recovery) {
  const neuralRecoveryByModelId = recovery.exportSnapshot()
  if (!neuralRecoverySnapshotHasTerminal(neuralRecoveryByModelId)) {
    return match
  }
  return { ...match, neuralRecoveryByModelId }
}

/**
 * @param {{
 *   recovery: ReturnType<import('../nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   neuralRecoveryByModelId?: Record<string, { terminal?: string }>
 *   hasMatchSetup?: boolean
 *   applySetupTerminal?: () => void
 *   openRefreshTerminal?: () => void
 * }} options
 * @returns {boolean} whether a blocking terminal UX was surfaced
 */
export function surfacePersistedNeuralRecoveryTerminal(options) {
  const snapshot = options.neuralRecoveryByModelId
  if (!snapshot || !neuralRecoverySnapshotHasTerminal(snapshot)) {
    return false
  }
  options.recovery.importSnapshot(snapshot)
  for (const state of Object.values(snapshot)) {
    const terminal = state?.terminal ?? NEURAL_RECOVERY_TERMINAL.NONE
    const ux = resolveNeuralRecoveryTerminalUx({
      terminal,
      hasMatchSetup: options.hasMatchSetup === true,
    })
    if (ux.action === 'setup-restore') {
      options.applySetupTerminal?.()
      return true
    }
    if (ux.action === 'refresh-dialog') {
      options.openRefreshTerminal?.()
      return true
    }
  }
  return false
}

/**
 * @param {Record<string, { terminal?: string }> | undefined} neuralRecoveryByModelId
 */
export function shouldDeferHeadlessForPersistedNeuralTerminal(neuralRecoveryByModelId) {
  if (!neuralRecoveryByModelId) return false
  return Object.values(neuralRecoveryByModelId).some(
    (state) => state?.terminal === NEURAL_RECOVERY_TERMINAL.REFRESH,
  )
}

/**
 * @param {{ state?: object, neuralRecoveryByModelId?: Record<string, { terminal?: string }> } | null | undefined} match
 * @param {string | null | undefined} humanPlayerSeatId
 */
export function shouldRunHeadlessMatchCompletion(match, humanPlayerSeatId) {
  if (!match?.state || !humanPlayerSeatId) return false
  if (shouldDeferHeadlessForPersistedNeuralTerminal(match.neuralRecoveryByModelId)) return false
  return needsHeadlessCompletion(match.state, humanPlayerSeatId)
}
