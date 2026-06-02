export const NEURAL_RECOVERY_TERMINAL = Object.freeze({
  NONE: 'NONE',
  REFRESH: 'REFRESH',
  SETUP: 'SETUP',
})

/**
 * @param {object} [options]
 * @param {number} [options.loadMaxAttempts]
 * @param {number} [options.inferMaxAttempts]
 */
export function createNeuralRuntimeRecoveryCoordinator(options = {}) {
  const loadMaxAttempts = options.loadMaxAttempts ?? 3
  const inferMaxAttempts = options.inferMaxAttempts ?? 3
  const stateByModelId = new Map()

  function createEmptyState() {
    return {
      loadAttempts: 0,
      inferAttempts: 0,
      recovering: false,
      terminal: NEURAL_RECOVERY_TERMINAL.NONE,
    }
  }

  function getState(modelId) {
    if (!stateByModelId.has(modelId)) {
      stateByModelId.set(modelId, createEmptyState())
    }
    return stateByModelId.get(modelId)
  }

  function backendForAttempt(attemptNumber) {
    return attemptNumber >= 3 ? 'cpu' : 'webgl'
  }

  return {
    beginRecovery(modelId) {
      const state = getState(modelId)
      state.recovering = true
    },
    recordLoadFailure(modelId) {
      const state = getState(modelId)
      state.recovering = true
      state.loadAttempts += 1
      if (state.loadAttempts >= loadMaxAttempts) {
        state.terminal = NEURAL_RECOVERY_TERMINAL.SETUP
        state.recovering = false
      }
    },
    recordInferFailure(modelId) {
      const state = getState(modelId)
      state.recovering = true
      state.inferAttempts += 1
      if (state.inferAttempts >= inferMaxAttempts) {
        state.terminal = NEURAL_RECOVERY_TERMINAL.REFRESH
        state.recovering = false
      }
    },
    recordSuccess(modelId) {
      stateByModelId.set(modelId, createEmptyState())
    },
    isRecovering(modelId) {
      const state = getState(modelId)
      return state.recovering && state.terminal === NEURAL_RECOVERY_TERMINAL.NONE
    },
    shouldBlockTurn(modelId) {
      return this.isRecovering(modelId)
    },
    getTerminalOutcome(modelId) {
      return getState(modelId).terminal
    },
    getLoadAttempts(modelId) {
      return getState(modelId).loadAttempts
    },
    getInferAttempts(modelId) {
      return getState(modelId).inferAttempts
    },
    getBackendPreference(modelId, failureKind) {
      const state = getState(modelId)
      const attempts = failureKind === 'load' ? state.loadAttempts : state.inferAttempts
      return backendForAttempt(attempts + 1)
    },
    reset(modelId) {
      stateByModelId.delete(modelId)
    },
    exportSnapshot() {
      /** @type {Record<string, { loadAttempts: number, inferAttempts: number, recovering: boolean, terminal: string }>} */
      const snapshot = {}
      for (const [modelId, state] of stateByModelId) {
        snapshot[modelId] = {
          loadAttempts: state.loadAttempts,
          inferAttempts: state.inferAttempts,
          recovering: state.recovering,
          terminal: state.terminal,
        }
      }
      return snapshot
    },
    importSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return
      for (const [modelId, state] of Object.entries(snapshot)) {
        if (!state || typeof state !== 'object') continue
        stateByModelId.set(modelId, {
          loadAttempts: Number(state.loadAttempts) || 0,
          inferAttempts: Number(state.inferAttempts) || 0,
          recovering: state.recovering === true,
          terminal: Object.values(NEURAL_RECOVERY_TERMINAL).includes(state.terminal)
            ? state.terminal
            : NEURAL_RECOVERY_TERMINAL.NONE,
        })
      }
    },
  }
}

const TERMINAL_VALUES = new Set(Object.values(NEURAL_RECOVERY_TERMINAL))

/**
 * @param {unknown} snapshot
 */
export function isValidNeuralRecoveryByModelId(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false
  for (const state of Object.values(snapshot)) {
    if (!state || typeof state !== 'object') return false
    if (typeof state.loadAttempts !== 'number' || !Number.isFinite(state.loadAttempts)) return false
    if (typeof state.inferAttempts !== 'number' || !Number.isFinite(state.inferAttempts)) return false
    if (typeof state.recovering !== 'boolean') return false
    if (!TERMINAL_VALUES.has(state.terminal)) return false
  }
  return true
}

/**
 * @param {Record<string, { terminal?: string }>} snapshot
 */
export function neuralRecoverySnapshotHasTerminal(snapshot) {
  return Object.values(snapshot).some(
    (state) => state?.terminal && state.terminal !== NEURAL_RECOVERY_TERMINAL.NONE,
  )
}
