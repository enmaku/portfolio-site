import { applySetupSnapshot } from '../../setup/state.js'
import { loadNnModel } from '../../nn/runtime.js'
import {
  buildNewMatchEnvelope,
  runMatchEntryNeuralLoadGateForPage,
} from '../../matchPageOrchestration.js'
import { createMatchPageOrchestrationContext } from '../../createMatchPageOrchestrationContext.js'
import { resetLiveMatchPageState } from '../../resetLiveMatchPageState.js'
import { clearCurrentMatch, persistCurrentMatch } from '../../persistence/currentMatch.js'
import { handleLivePlayNeuralRecoveryTerminalError } from '../livePlayNeuralRecoveryTerminal.js'
import {
  activateLiveMatchShellLifecycle,
  deactivateLiveMatchShellLifecycle,
} from './liveMatchShellLifecycle.js'

/**
 * Live match shell lifecycle coordination: mount/unmount, subscribe teardown,
 * timer cleanup, orchestration entry points, and outcome → shell-local mapping.
 *
 * @param {{
 *   match: import('vue').Ref<object | null>
 *   debugMode: import('vue').Ref<boolean>
 *   deferredPostDungeonState: import('vue').Ref<object | null>
 *   dungeonRunnerSettingsStore: { setAnimationPace: (pace: string) => void }
 *   liveMatchPageSessionSink: Parameters<typeof resetLiveMatchPageState>[0]
 *   preparePresentationOnMount: () => void
 *   resetPresentationForBootstrap: (pace: string) => void
 *   setNnModelsWarmPromise: (promise: Promise<void> | null) => void
 *   presentationOrchestrator: Parameters<typeof activateLiveMatchShellLifecycle>[0]['presentationOrchestrator']
 *   syncPresentationLabel: () => void
 *   presentationTraceEnabled?: () => boolean
 *   nnRecovery: Parameters<typeof activateLiveMatchShellLifecycle>[0]['recovery']
 *   onRecoveryChanged: () => void
 *   scheduleAiTurnOnPresentationTick: () => void
 *   scheduleHumanAutoResolveIfReady: () => void
 *   scheduleAiTurnIfReady: () => void
 *   bootstrapRecoveryState: () => void
 *   cancelAiTurnPrefetch: () => void
 *   getAiTurnTimerId: () => ReturnType<typeof setTimeout> | null
 *   runOpponentHeadlessCompletion: () => Promise<import('../../matchPageOrchestration.js').HeadlessMatchCompletionResult>
 *   logNnRecoveryTrace: (modelId: string, phase: string, detail?: object) => void
 *   openNeuralRefreshTerminal: () => void
 *   getConfirmationDialogResolve: () => ((value: boolean) => void) | null
 *   getAutoResolveTimerId: () => ReturnType<typeof setTimeout> | null
 *   matchNeuralLoadGateInFlight: import('vue').Ref<boolean>
 *   neuralLoadGateTerminalOpen: import('vue').Ref<boolean>
 *   setup: object
 *   cloneSetup: (source?: object) => object
 *   storage?: Storage
 *   activateLifecycle?: typeof activateLiveMatchShellLifecycle
 *   deactivateLifecycle?: typeof deactivateLiveMatchShellLifecycle
 *   resetLiveMatchPageState?: typeof resetLiveMatchPageState
 *   handleLivePlayNeuralRecoveryTerminalError?: typeof handleLivePlayNeuralRecoveryTerminalError
 *   runMatchEntryNeuralLoadGateForPage?: typeof runMatchEntryNeuralLoadGateForPage
 *   createMatchPageOrchestrationContext?: typeof createMatchPageOrchestrationContext
 *   clearCurrentMatch?: typeof clearCurrentMatch
 *   persistCurrentMatch?: typeof persistCurrentMatch
 *   applySetupSnapshot?: typeof applySetupSnapshot
 *   loadModel?: typeof loadNnModel
 * }} deps
 */
export function createLiveMatchShellLifecycleCoordination(deps) {
  const storage = deps.storage ?? globalThis.localStorage
  const activateLifecycle = deps.activateLifecycle ?? activateLiveMatchShellLifecycle
  const deactivateLifecycle = deps.deactivateLifecycle ?? deactivateLiveMatchShellLifecycle
  const resetPageState = deps.resetLiveMatchPageState ?? resetLiveMatchPageState
  const handleNeuralRecoveryTerminalErrorFn =
    deps.handleLivePlayNeuralRecoveryTerminalError ?? handleLivePlayNeuralRecoveryTerminalError
  const runMatchEntryGate = deps.runMatchEntryNeuralLoadGateForPage ?? runMatchEntryNeuralLoadGateForPage
  const createOrchestrationContext =
    deps.createMatchPageOrchestrationContext ?? createMatchPageOrchestrationContext
  const clearMatch = deps.clearCurrentMatch ?? clearCurrentMatch
  const persistMatch = deps.persistCurrentMatch ?? persistCurrentMatch
  const applySetup = deps.applySetupSnapshot ?? applySetupSnapshot
  const loadModel = deps.loadModel ?? loadNnModel
  const presentationTraceEnabled = deps.presentationTraceEnabled ?? (() => false)

  let liveMatchShellLifecycleActive = false
  /** @type {(() => void) | null} */
  let unsubscribeNnRecovery = null
  /** @type {ReturnType<typeof setInterval> | null} */
  let presentationTimerId = null

  function resetForSetupTerminal() {
    resetPageState(deps.liveMatchPageSessionSink, {
      clearMatch: true,
      openNeuralLoadGateTerminal: true,
    })
  }

  const matchPageOrchestrationCtx = createOrchestrationContext({
    storage,
    recovery: deps.nnRecovery,
    loadModel,
    setMatchNeuralLoadGateInFlight: (inFlight) => {
      deps.matchNeuralLoadGateInFlight.value = inFlight
    },
    clearCurrentMatch: clearMatch,
    persistCurrentMatch: persistMatch,
    applySetupSnapshot: applySetup,
    setupTarget: deps.setup,
    cloneSetup: deps.cloneSetup,
    onSetupTerminal: () => {
      resetForSetupTerminal()
    },
  })

  function resetForFreshMatchEntry() {
    resetPageState(deps.liveMatchPageSessionSink, {
      warmModelsResolved: true,
    })
  }

  function resetForBackToSetup() {
    resetPageState(deps.liveMatchPageSessionSink, {
      clearMatch: true,
      clearPersistedMatch: true,
    })
  }

  function applyBootstrappedMatchSession(matchEnvelope, pace) {
    deps.dungeonRunnerSettingsStore.setAnimationPace(pace)
    deps.match.value = matchEnvelope
    deps.bootstrapRecoveryState()
    deps.deferredPostDungeonState.value = null
    deps.resetPresentationForBootstrap(pace)
    deps.setNnModelsWarmPromise(Promise.resolve())
  }

  /**
   * @param {Awaited<ReturnType<typeof import('../../matchPageOrchestration.js').bootstrapCurrentMatchFromStorage>>} result
   */
  function processBootstrappedSession(result) {
    if (result.kind === 'no-saved-match') return
    if (result.kind === 'setup-terminal') {
      resetForSetupTerminal()
      return
    }
    applyBootstrappedMatchSession(result.match, result.presentationSpeedProfile)
    if (result.kind === 'refresh-terminal') {
      deps.openNeuralRefreshTerminal()
      return
    }
    void maybeRunHeadlessMatchCompletion()
  }

  function applyHeadlessMatchCompletionOutcome(result) {
    if (result.kind === 'completed' || result.kind === 'refresh-terminal') {
      deps.match.value = result.match
    }
    if (result.kind === 'refresh-terminal') {
      deps.openNeuralRefreshTerminal()
      deps.logNnRecoveryTrace(result.modelId, 'terminal', {
        terminal: result.terminal,
        failureKind: result.failureKind ?? null,
      })
    } else if (result.kind === 'failed' && deps.debugMode.value) {
      console.warn(
        '[DungeonRunner][headless] completion failed',
        result.errorCode,
        result.actionCount,
      )
    }
  }

  async function maybeRunHeadlessMatchCompletion() {
    const result = await deps.runOpponentHeadlessCompletion()
    applyHeadlessMatchCompletionOutcome(result)
  }

  function handleNeuralRecoveryTerminalError(error) {
    const result = handleNeuralRecoveryTerminalErrorFn({
      error,
      match: deps.match.value,
      recovery: deps.nnRecovery,
      storage,
      persistCurrentMatch: persistMatch,
      restoreSetup: (setupSnapshot) => {
        matchPageOrchestrationCtx.applySetupTerminal(deps.cloneSetup(setupSnapshot))
      },
    })
    if (!result.handled) return false
    if (result.action === 'refresh-dialog') {
      deps.match.value = result.match
      deps.openNeuralRefreshTerminal()
      deps.logNnRecoveryTrace(result.trace.modelId, 'terminal', {
        terminal: result.trace.terminal,
        failureKind: result.trace.failureKind,
      })
    }
    return true
  }

  function kickMatchAutomation() {
    if (!liveMatchShellLifecycleActive) return
    deps.scheduleAiTurnIfReady()
    deps.scheduleHumanAutoResolveIfReady()
  }

  function mountLiveMatchShell() {
    if (liveMatchShellLifecycleActive) return
    liveMatchShellLifecycleActive = true
    deps.preparePresentationOnMount()
    const lifecycle = activateLifecycle({
      recovery: deps.nnRecovery,
      onRecoveryChanged: deps.onRecoveryChanged,
      presentationOrchestrator: deps.presentationOrchestrator,
      tickCallbacks: {
        syncPresentationLabel: deps.syncPresentationLabel,
        scheduleAiTurnIfReady: deps.scheduleAiTurnOnPresentationTick,
        scheduleHumanAutoResolveIfReady: deps.scheduleHumanAutoResolveIfReady,
      },
    })
    unsubscribeNnRecovery = lifecycle.unsubscribe
    presentationTimerId = lifecycle.presentationTimerId
    if (presentationTraceEnabled()) {
      console.log(
        '[DungeonRunner][presentation] trace on — localStorage.setItem("dungeonPresentationTrace","1") — also logs [card-flight] for pile/deck → card motion',
      )
    }
  }

  function unmountLiveMatchShell() {
    if (!liveMatchShellLifecycleActive) return
    liveMatchShellLifecycleActive = false
    deps.cancelAiTurnPrefetch()
    deactivateLifecycle({
      unsubscribe: unsubscribeNnRecovery,
      presentationTimerId,
      aiTurnTimerId: deps.getAiTurnTimerId(),
      autoResolveTimerId: deps.getAutoResolveTimerId(),
      confirmationDialogResolve: deps.getConfirmationDialogResolve(),
    })
    unsubscribeNnRecovery = null
    presentationTimerId = null
  }

  async function runLivePageMatchEntryGate(setupSnapshot) {
    return runMatchEntryGate(matchPageOrchestrationCtx, {
      setupSnapshot,
      releaseInFlightAfterGate: false,
    })
  }

  return {
    isLifecycleActive: () => liveMatchShellLifecycleActive,
    mountLiveMatchShell,
    unmountLiveMatchShell,
    applyBootstrappedMatchSession,
    processBootstrappedSession,
    kickMatchAutomation,
    maybeRunHeadlessMatchCompletion,
    handleNeuralRecoveryTerminalError,
    resetForSetupTerminal,
    resetForFreshMatchEntry,
    resetForBackToSetup,
    matchPageOrchestrationCtx,
    runLivePageMatchEntryGate,
    buildNewMatchEnvelope,
  }
}

export { buildNewMatchEnvelope }
