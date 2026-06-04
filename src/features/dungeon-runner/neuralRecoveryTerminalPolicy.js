import { NEURAL_RECOVERY_TERMINAL } from './nn/recovery.js'

/** Persisted resume: REFRESH blocks match completion before SETUP restore. */
const PERSISTED_TERMINAL_PRIORITY = [
  NEURAL_RECOVERY_TERMINAL.REFRESH,
  NEURAL_RECOVERY_TERMINAL.SETUP,
]

/**
 * @param {Record<string, { terminal?: string }> | undefined} neuralRecoveryByModelId
 * @param {{ preferredModelId?: string }} [options]
 * @returns {{ modelId: string, terminal: string } | null}
 */
export function selectPersistedNeuralRecoveryTerminal(neuralRecoveryByModelId, options = {}) {
  if (!neuralRecoveryByModelId) return null
  const terminalEntries = Object.entries(neuralRecoveryByModelId)
    .filter(([, state]) => state?.terminal && state.terminal !== NEURAL_RECOVERY_TERMINAL.NONE)
    .map(([modelId, state]) => ({ modelId, terminal: state.terminal }))

  if (terminalEntries.length === 0) return null

  const { preferredModelId } = options
  for (const terminal of PERSISTED_TERMINAL_PRIORITY) {
    const candidates = terminalEntries.filter((entry) => entry.terminal === terminal)
    if (candidates.length === 0) continue
    if (preferredModelId) {
      const preferred = candidates.find((entry) => entry.modelId === preferredModelId)
      if (preferred) return preferred
    }
    candidates.sort((a, b) => a.modelId.localeCompare(b.modelId))
    return candidates[0]
  }
  return null
}

/**
 * @param {{ terminal: string, hasMatchSetup?: boolean }} params
 * @returns {{ action: 'setup-restore' | 'refresh-dialog' } | { action: null }}
 */
export function resolveNeuralRecoveryTerminalUx({ terminal, hasMatchSetup = false }) {
  if (terminal === NEURAL_RECOVERY_TERMINAL.SETUP && hasMatchSetup) {
    return { action: 'setup-restore' }
  }
  if (terminal === NEURAL_RECOVERY_TERMINAL.REFRESH) {
    return { action: 'refresh-dialog' }
  }
  return { action: null }
}
