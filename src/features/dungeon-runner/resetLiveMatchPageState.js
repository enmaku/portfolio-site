/**
 * Resets live match page session artifacts shared by setup exit, neural load-gate
 * terminal, and fresh match entry paths.
 *
 * @param {{
 *   setMatchNull?: () => void
 *   setNnModelsWarmPromise: (promise: Promise<void> | null) => void
 *   resetAiTurnPrefetch: () => void
 *   setLastAppliedAiTurnTokenNull: () => void
 *   setPresentationInputWasLockedFalse: () => void
 *   setDeferredPostDungeonStateNull: () => void
 *   clearDebugTraces: () => void
 *   clearPresentation: () => void
 *   syncPresentationLabel: () => void
 *   setNeuralLoadGateTerminalOpen?: (open: boolean) => void
 *   clearPersistedMatch?: () => void
 * }} sink
 * @param {{
 *   clearMatch?: boolean
 *   openNeuralLoadGateTerminal?: boolean
 *   warmModelsResolved?: boolean
 *   clearPersistedMatch?: boolean
 * }} [options]
 */
export function resetLiveMatchPageState(sink, options = {}) {
  const {
    clearMatch = false,
    openNeuralLoadGateTerminal = false,
    warmModelsResolved = false,
    clearPersistedMatch = false,
  } = options

  if (clearMatch && sink.setMatchNull) {
    sink.setMatchNull()
  }

  sink.setLastAppliedAiTurnTokenNull()
  sink.resetAiTurnPrefetch()
  sink.setNnModelsWarmPromise(warmModelsResolved ? Promise.resolve() : null)
  sink.setPresentationInputWasLockedFalse()
  sink.setDeferredPostDungeonStateNull()
  sink.clearDebugTraces()
  sink.clearPresentation()
  sink.syncPresentationLabel()

  if (openNeuralLoadGateTerminal && sink.setNeuralLoadGateTerminalOpen) {
    sink.setNeuralLoadGateTerminalOpen(true)
  }

  if (clearPersistedMatch && sink.clearPersistedMatch) {
    sink.clearPersistedMatch()
  }
}
