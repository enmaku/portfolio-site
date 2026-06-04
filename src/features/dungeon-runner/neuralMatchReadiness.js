import {
  NEURAL_RECOVERY_TERMINAL,
  neuralRecoverySnapshotHasTerminal,
} from './nn/recovery.js'
import { needsHeadlessCompletion } from './ui/humanEliminationCompletionPolicy.js'
import { resolveNeuralRecoveryTerminalUx } from './ui/neuralSeatRecoveryView.js'

export function collectNeuralModelIdsFromSetup(setup) {
  return [
    ...new Set(
      (setup?.opponents ?? [])
        .filter((opponent) => opponent.type === 'nn')
        .map((opponent) => opponent.modelId ?? 'latest'),
    ),
  ]
}

export async function runMatchNeuralLoadGate(setup, options = {}) {
  const loadModel = options.loadModel
  if (typeof loadModel !== 'function') {
    throw new Error('loadModel required')
  }
  const modelIds = collectNeuralModelIdsFromSetup(setup)
  for (const modelId of modelIds) {
    try {
      await loadModel(modelId, options.loadOptions)
    } catch (error) {
      return {
        ok: false,
        terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
        failedModelId: modelId,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return { ok: true, terminal: NEURAL_RECOVERY_TERMINAL.NONE }
}

export function applyNeuralRecoverySetupTerminal(options) {
  const { storage, setupSnapshot, clearCurrentMatch, applySetupSnapshot, setupTarget } = options
  applySetupSnapshot(setupTarget, setupSnapshot)
  clearCurrentMatch(storage)
  return { terminal: NEURAL_RECOVERY_TERMINAL.SETUP }
}

/**
 * @param {object} match
 * @param {ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>} recovery
 */
export function attachNeuralRecoverySnapshotToMatch(match, recovery) {
  const neuralRecoveryByModelId = recovery.exportSnapshot()
  if (!neuralRecoverySnapshotHasTerminal(neuralRecoveryByModelId)) {
    return match
  }
  return { ...match, neuralRecoveryByModelId }
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

/**
 * @param {{
 *   kind: 'persisted-snapshot'
 *   recovery: ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   neuralRecoveryByModelId?: Record<string, { terminal?: string }>
 *   hasMatchSetup?: boolean
 *   match?: object
 *   restoreSetup: (setupSnapshot: object) => void
 * } | {
 *   kind: 'terminal-event'
 *   recovery: ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   terminal: string
 *   hasMatchSetup?: boolean
 *   match: object
 *   storage: Storage
 *   persistCurrentMatch: (storage: Storage, match: object) => void
 *   restoreSetup: (setupSnapshot: object) => void
 * }} options
 * @returns {{ surfaced: false } | { surfaced: true, action: 'setup-restore' | 'refresh-dialog', match?: object }}
 */
export function handleNeuralRecoveryTerminalOutcome(options) {
  if (options.kind === 'persisted-snapshot') {
    return handlePersistedNeuralRecoveryTerminalOutcome(options)
  }
  if (options.kind === 'terminal-event') {
    return handleNeuralRecoveryTerminalEventOutcome(options)
  }
  throw new Error(`Unknown neural recovery terminal input kind: ${options.kind}`)
}

/**
 * @param {Extract<Parameters<typeof handleNeuralRecoveryTerminalOutcome>[0], { kind: 'persisted-snapshot' }>} options
 */
function handlePersistedNeuralRecoveryTerminalOutcome(options) {
  const snapshot = options.neuralRecoveryByModelId
  if (!snapshot || !neuralRecoverySnapshotHasTerminal(snapshot)) {
    return { surfaced: false }
  }
  options.recovery.importSnapshot(snapshot)
  for (const state of Object.values(snapshot)) {
    const terminal = state?.terminal ?? NEURAL_RECOVERY_TERMINAL.NONE
    const { action } = resolveNeuralRecoveryTerminalUx({
      terminal,
      hasMatchSetup: options.hasMatchSetup === true,
    })
    if (action === 'setup-restore') {
      const setupSnapshot = options.match?.setup
      if (!setupSnapshot) {
        return { surfaced: false }
      }
      options.restoreSetup(setupSnapshot)
      return { surfaced: true, action: 'setup-restore' }
    }
    if (action === 'refresh-dialog') {
      return { surfaced: true, action: 'refresh-dialog', match: options.match }
    }
  }
  return { surfaced: false }
}

/**
 * @param {Extract<Parameters<typeof handleNeuralRecoveryTerminalOutcome>[0], { kind: 'terminal-event' }>} options
 */
function handleNeuralRecoveryTerminalEventOutcome(options) {
  const { action } = resolveNeuralRecoveryTerminalUx({
    terminal: options.terminal,
    hasMatchSetup: options.hasMatchSetup === true,
  })
  if (!action) {
    return { surfaced: false }
  }
  if (action === 'setup-restore') {
    options.restoreSetup(options.match.setup)
    return { surfaced: true, action: 'setup-restore' }
  }
  const nextMatch = attachNeuralRecoverySnapshotToMatch(options.match, options.recovery)
  options.persistCurrentMatch(options.storage, nextMatch)
  return { surfaced: true, action: 'refresh-dialog', match: nextMatch }
}
