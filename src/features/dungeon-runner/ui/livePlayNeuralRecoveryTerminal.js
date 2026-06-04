import { NeuralRecoveryTerminalError } from '../nn/chooseWithRecovery.js'
import { handleNeuralRecoveryTerminalOutcome } from '../neuralMatchReadiness.js'

/**
 * Routes live-play neural recovery terminal errors through the unified readiness seam.
 *
 * @param {{
 *   error: unknown
 *   match: object | null | undefined
 *   recovery: ReturnType<import('../nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   storage: Storage
 *   persistCurrentMatch: (storage: Storage, match: object) => void
 *   restoreSetup: (setupSnapshot: object) => void
 * }} options
 * @returns {{ handled: false } | {
 *   handled: true
 *   action: 'setup-restore' | 'refresh-dialog'
 *   match?: object
 *   trace?: { modelId: string, terminal: string, failureKind: string | null }
 * }}
 */
export function handleLivePlayNeuralRecoveryTerminalError(options) {
  const { error, match, recovery, storage, persistCurrentMatch, restoreSetup } = options
  if (!(error instanceof NeuralRecoveryTerminalError) || !match) {
    return { handled: false }
  }

  const outcome = handleNeuralRecoveryTerminalOutcome({
    kind: 'terminal-event',
    recovery,
    terminal: error.terminal,
    hasMatchSetup: Boolean(match.setup),
    match,
    storage,
    persistCurrentMatch,
    restoreSetup,
  })

  if (!outcome.surfaced) {
    return { handled: false }
  }

  if (outcome.action === 'refresh-dialog') {
    return {
      handled: true,
      action: 'refresh-dialog',
      match: outcome.match,
      trace: {
        modelId: error.modelId,
        terminal: error.terminal,
        failureKind: error.failureKind ?? null,
      },
    }
  }

  return { handled: true, action: 'setup-restore' }
}
