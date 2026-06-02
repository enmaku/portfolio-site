import { NEURAL_RECOVERY_TERMINAL } from './recovery.js'

export { NEURAL_RECOVERY_TERMINAL }

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

export function resolveNeuralLoadGateSetupTerminal(options) {
  const { storage, setupSnapshot, clearCurrentMatch, applySetupSnapshot, setupTarget } = options
  applySetupSnapshot(setupTarget, setupSnapshot)
  clearCurrentMatch(storage)
  return { terminal: NEURAL_RECOVERY_TERMINAL.SETUP }
}
