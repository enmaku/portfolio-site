/**
 * Builds the live match page session sink consumed by {@link resetLiveMatchPageState}.
 *
 * @param {{
 *   match: import('vue').Ref<object | null>
 *   setNnModelsWarmPromise: (promise: Promise<void> | null) => void
 *   resetAiTurnPrefetch: () => void
 *   setLastAppliedAiTurnTokenNull: () => void
 *   setPresentationInputWasLockedFalse: () => void
 *   deferredPostDungeonState: import('vue').Ref<object | null>
 *   nnDebugTraceText: import('vue').Ref<string>
 *   nnDebugTraceHistory: import('vue').Ref<unknown[]>
 *   presentationOrchestrator: { clear: () => void }
 *   syncPresentationLabel: () => void
 *   neuralLoadGateTerminalOpen: import('vue').Ref<boolean>
 *   clearCurrentMatch: (storage: Storage) => void
 *   storage: Storage
 * }} deps
 */
export function createLiveMatchPageSessionSink(deps) {
  return {
    setMatchNull: () => {
      deps.match.value = null
    },
    setNnModelsWarmPromise: deps.setNnModelsWarmPromise,
    resetAiTurnPrefetch: deps.resetAiTurnPrefetch,
    setLastAppliedAiTurnTokenNull: deps.setLastAppliedAiTurnTokenNull,
    setPresentationInputWasLockedFalse: deps.setPresentationInputWasLockedFalse,
    setDeferredPostDungeonStateNull: () => {
      deps.deferredPostDungeonState.value = null
    },
    clearDebugTraces: () => {
      deps.nnDebugTraceText.value = ''
      deps.nnDebugTraceHistory.value = []
    },
    clearPresentation: () => {
      deps.presentationOrchestrator.clear()
    },
    syncPresentationLabel: deps.syncPresentationLabel,
    setNeuralLoadGateTerminalOpen: (open) => {
      deps.neuralLoadGateTerminalOpen.value = open
    },
    clearPersistedMatch: () => {
      deps.clearCurrentMatch(deps.storage)
    },
  }
}
