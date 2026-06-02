import { chooseNnAction, resetRuntimeForModel, NN_FAILURE_KIND } from './runtime.js'
import {
  NEURAL_RECOVERY_TERMINAL,
  createNeuralRuntimeRecoveryCoordinator,
} from './recovery.js'

export class NeuralRecoveryTerminalError extends Error {
  /**
   * @param {string} terminal
   * @param {string} modelId
   * @param {{ failureKind?: string }} [options]
   */
  constructor(terminal, modelId, options = {}) {
    super(`Neural recovery reached terminal state: ${terminal}`)
    this.name = 'NeuralRecoveryTerminalError'
    this.terminal = terminal
    this.modelId = modelId
    this.failureKind = options.failureKind
  }
}

/**
 * @param {{
 *   recovery?: ReturnType<typeof createNeuralRuntimeRecoveryCoordinator>
 *   chooseNnAction?: typeof chooseNnAction
 *   resetRuntimeForModel?: typeof resetRuntimeForModel
 *   onRecoveryBegin?: (modelId: string) => void
 *   onRecoveryAttempt?: (detail: {
 *     modelId: string
 *     failureKind: string
 *     loadAttempts: number
 *     inferAttempts: number
 *     backend: string
 *   }) => void
 *   onRecoverySettled?: (modelId: string) => void
 * }} [deps]
 */
export function createChooseNnActionWithRecovery(deps = {}) {
  const recovery = deps.recovery ?? createNeuralRuntimeRecoveryCoordinator()
  const choose = deps.chooseNnAction ?? chooseNnAction
  const resetRuntime = deps.resetRuntimeForModel ?? resetRuntimeForModel
  const onRecoveryBegin = deps.onRecoveryBegin
  const onRecoveryAttempt = deps.onRecoveryAttempt
  const onRecoverySettled = deps.onRecoverySettled
  /** @type {Map<string, Promise<object|null>>} */
  const inFlightByModelId = new Map()

  async function runRecoveryLoop(state, actor, options, modelId) {
    const terminalBefore = recovery.getTerminalOutcome(modelId)
    if (terminalBefore !== NEURAL_RECOVERY_TERMINAL.NONE) {
      throw new NeuralRecoveryTerminalError(terminalBefore, modelId)
    }

    while (true) {
      const result = await choose(state, actor, { ...options, modelId })
      if (result == null) return null
      if (result.ok) {
        recovery.recordSuccess(modelId)
        onRecoverySettled?.(modelId)
        return result.action
      }

      if (!recovery.isRecovering(modelId)) {
        recovery.beginRecovery(modelId)
        onRecoveryBegin?.(modelId)
      }

      const failurePath = result.kind === NN_FAILURE_KIND.LOAD ? 'load' : 'infer'
      if (result.kind === NN_FAILURE_KIND.LOAD) {
        recovery.recordLoadFailure(modelId)
      } else {
        recovery.recordInferFailure(modelId)
      }

      const backend = recovery.getBackendPreference(modelId, failurePath)
      onRecoveryAttempt?.({
        modelId,
        failureKind: result.kind,
        loadAttempts: recovery.getLoadAttempts(modelId),
        inferAttempts: recovery.getInferAttempts(modelId),
        backend,
      })
      resetRuntime(modelId, {
        forceCpu: backend === 'cpu',
        resetBackend: true,
      })

      const terminal = recovery.getTerminalOutcome(modelId)
      if (terminal !== NEURAL_RECOVERY_TERMINAL.NONE) {
        onRecoverySettled?.(modelId)
        throw new NeuralRecoveryTerminalError(terminal, modelId, { failureKind: result.kind })
      }
    }
  }

  return async function chooseNnActionWithRecovery(state, actor, options = {}) {
    const modelId = options.modelId ?? 'latest'
    const existing = inFlightByModelId.get(modelId)
    if (existing) return existing

    const run = runRecoveryLoop(state, actor, options, modelId).finally(() => {
      inFlightByModelId.delete(modelId)
    })
    inFlightByModelId.set(modelId, run)
    return run
  }
}
