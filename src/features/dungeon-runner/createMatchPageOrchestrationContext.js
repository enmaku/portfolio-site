import { applyNeuralRecoverySetupTerminal } from './neuralMatchReadiness.js'

/**
 * Page-local dependencies shared by match/NN orchestration entry points.
 *
 * @typedef {object} MatchPageOrchestrationContext
 * @property {Storage} storage
 * @property {ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>} recovery
 * @property {(modelId: string) => Promise<void>} loadModel
 * @property {(inFlight: boolean) => void} setMatchNeuralLoadGateInFlight
 * @property {(storage: Storage) => void} clearCurrentMatch
 * @property {(storage: Storage, match: object) => void} persistCurrentMatch
 * @property {(setupTarget: object, setupSnapshot: object) => void} applySetupSnapshot
 * @property {object} setupTarget
 * @property {(setup: object) => object} cloneSetup
 * @property {(setupSnapshot: object) => void} resolveSetupTerminal
 * @property {(setupSnapshot: object) => void} applySetupTerminal
 */

/**
 * Bundles page-local storage, setup, load-model, in-flight, and recovery deps
 * for {@link import('./matchPageOrchestration.js')} entry points.
 *
 * @param {{
 *   storage: Storage
 *   recovery: ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   loadModel: (modelId: string) => Promise<void>
 *   setMatchNeuralLoadGateInFlight: (inFlight: boolean) => void
 *   clearCurrentMatch: (storage: Storage) => void
 *   persistCurrentMatch: (storage: Storage, match: object) => void
 *   applySetupSnapshot: (setupTarget: object, setupSnapshot: object) => void
 *   setupTarget: object
 *   cloneSetup: (setup: object) => object
 *   applySetupTerminal?: (setupSnapshot: object) => void
 *   onSetupTerminal?: () => void
 * }} deps
 * @returns {MatchPageOrchestrationContext}
 */
export function createMatchPageOrchestrationContext(deps) {
  /** @param {object} setupSnapshot */
  function resolveSetupTerminal(setupSnapshot) {
    applyNeuralRecoverySetupTerminal({
      storage: deps.storage,
      setupSnapshot,
      clearCurrentMatch: deps.clearCurrentMatch,
      applySetupSnapshot: deps.applySetupSnapshot,
      setupTarget: deps.setupTarget,
    })
  }

  /** @param {object} setupSnapshot */
  function applySetupTerminal(setupSnapshot) {
    resolveSetupTerminal(setupSnapshot)
    deps.onSetupTerminal?.()
  }

  return {
    storage: deps.storage,
    recovery: deps.recovery,
    loadModel: deps.loadModel,
    setMatchNeuralLoadGateInFlight: deps.setMatchNeuralLoadGateInFlight,
    clearCurrentMatch: deps.clearCurrentMatch,
    persistCurrentMatch: deps.persistCurrentMatch,
    applySetupSnapshot: deps.applySetupSnapshot,
    setupTarget: deps.setupTarget,
    cloneSetup: deps.cloneSetup,
    resolveSetupTerminal,
    applySetupTerminal: deps.applySetupTerminal ?? applySetupTerminal,
  }
}
