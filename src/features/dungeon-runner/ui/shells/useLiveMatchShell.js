import { reactive, ref } from 'vue'
import {
  clearCurrentMatch,
  persistCurrentMatch,
} from '../../persistence/currentMatch.js'
import { shouldDeferDungeonExitUntilOutcomeAck } from '../headlessMatchCompletionRunner.js'
import { createLiveMatchPageSessionSink } from '../../createLiveMatchPageSessionSink.js'
import { isDungeonPresentationTraceEnabled } from '../dungeonPresentationTrace.js'
import { createLiveMatchShellPresentationBinding } from './createLiveMatchShellPresentationBinding.js'
import { createLiveMatchShellHumanGameplaySurface } from './createLiveMatchShellHumanGameplaySurface.js'
import { createLiveMatchShellOpponentTurnAutomation } from './createLiveMatchShellOpponentTurnAutomation.js'
import { createLiveMatchShellMaintainerDebug } from './createLiveMatchShellMaintainerDebug.js'
import { createLiveMatchShellMidMatchDialogSurface } from './createLiveMatchShellMidMatchDialogSurface.js'
import {
  buildNewMatchEnvelope,
  createLiveMatchShellLifecycleCoordination,
} from './createLiveMatchShellLifecycleCoordination.js'

export { LIVE_MATCH_SHELL_SESSION_GROUPS } from './liveMatchShellSessionGroups.js'

/**
 * Live-match session: board, mid-match dialogs, AI pipeline, presentation motion.
 *
 * @param {{
 *   match: import('vue').Ref<object | null>
 *   debugMode: import('vue').Ref<boolean>
 *   presentationSpeedProfile: import('vue').WritableComputedRef<string>
 *   dungeonRunnerSettingsStore: ReturnType<typeof import('../../../stores/dungeonRunnerSettings.js').useDungeonRunnerSettingsStore>
 *   setup: object
 *   cloneSetup: (source?: object) => object
 *   nnRecovery: ReturnType<import('../../nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   replayImportText: import('vue').Ref<string>
 *   replayExportText: import('vue').Ref<string>
 *   nnDebugTraceText: import('vue').Ref<string>
 *   nnDebugTraceHistory: import('vue').Ref<unknown[]>
 *   neuralLoadGateTerminalOpen: import('vue').Ref<boolean>
 *   matchNeuralLoadGateInFlight: import('vue').Ref<boolean>
 *   notify: (opts: { type: string, message: string }) => void
 * }} deps
 */
export function useLiveMatchShell(deps) {
  const match = deps.match
  const debugMode = deps.debugMode
  /** @type {import('vue').ComputedRef<boolean> | null} */
  let showDungeonStageForPresentationTrace = null
  /** @type {import('vue').ComputedRef<object> | null} */
  let dungeonStageViewForPresentationTrace = null
  const presentationUnlockHooks = { onUnlock: () => {} }

  function presentationTraceEnabled() {
    return isDungeonPresentationTraceEnabled()
  }
  const nnRecovery = deps.nnRecovery
  const dungeonRunnerSettingsStore = deps.dungeonRunnerSettingsStore
  const presentationSpeedProfile = deps.presentationSpeedProfile
  const neuralLoadGateTerminalOpen = deps.neuralLoadGateTerminalOpen
  const matchNeuralLoadGateInFlight = deps.matchNeuralLoadGateInFlight
  const previousVisibleState = ref(null)
  const deferredPostDungeonState = ref(null)
  /** @type {Promise<void> | null} */
  let nnModelsWarmPromise = null

  const aiTurnTraceHolder = { trace: () => () => {} }

  const presentationBinding = createLiveMatchShellPresentationBinding({
    presentationSpeedProfile,
    getHumanSeatId: () =>
      match.value?.state?.seats?.find((seat) => seat.role.type === 'human')?.id ?? null,
    getIsHumanTurn: () =>
      !!match.value &&
      match.value.state?.turn?.activeSeatId != null &&
      match.value.state.turn.activeSeatId ===
        (match.value.state.seats?.find((seat) => seat.role.type === 'human')?.id ?? null),
    getMatch: () => match.value,
    presentationTraceEnabled,
    onPersistPresentationSpeedProfile: (next) => {
      if (match.value) {
        match.value = { ...match.value, presentationSpeedProfile: next }
        persistCurrentMatch(window.localStorage, match.value)
      }
    },
    onGameplayInputUnlocked: () => presentationUnlockHooks.onUnlock(),
    getPresentationActiveTraceContext: () => ({
      showDungeonStage: showDungeonStageForPresentationTrace?.value ?? false,
      dungeonStageView: dungeonStageViewForPresentationTrace?.value ?? null,
    }),
    debugMode,
    aiTurnTrace: (baseContext = {}) => aiTurnTraceHolder.trace(baseContext),
    shouldDeferDungeonExitUntilOutcomeAck,
  })

  const {
    presentationOrchestrator,
    activePresentation,
    activePresentationLabel,
    gameplayInputLocked,
    dungeonStageAnimationClass,
    boardShellRef,
    heroCardSlotRef,
    dungeonCardMotionWrap,
    dungeonCardFaceRef,
    deckBadgeRef,
    dungeonPileMotionAnchorRef,
    heroChangeInterstitialOverlayRef,
    presentationFlightLayerRef,
    bindBoardShellRef,
    bindHeroCardSlotRef,
    bindDungeonCardMotionWrapRef,
    bindDungeonCardFaceRef,
    bindDeckBadgeRef,
    bindDungeonPileMotionAnchorRef,
    bindHeroChangeInterstitialOverlayRef,
    bindPresentationFlightLayerRef,
    bindBiddingEquipmentBadgeRef,
    syncPresentationLabel,
    enqueuePresentationTransition,
    skipActivePresentation,
    humanDungeonAutoRevealGapMs,
    setPresentationInputWasLockedFalse,
    clearPresentationOrchestrator,
    preparePresentationOnMount,
    resetPresentationForBootstrap,
    applyImportedPresentationPace,
  } = presentationBinding

  const maintainerDebug = createLiveMatchShellMaintainerDebug({
    debugMode,
    match,
    replayImportText: deps.replayImportText,
    replayExportText: deps.replayExportText,
    nnDebugTraceText: deps.nnDebugTraceText,
    nnDebugTraceHistory: deps.nnDebugTraceHistory,
    dungeonRunnerSettingsStore,
    presentationSpeedProfile,
    deferredPostDungeonState,
    applyImportedPresentationPace,
    notify: deps.notify,
  })

  /** @type {ReturnType<typeof createLiveMatchShellHumanGameplaySurface> | null} */
  let humanGameplaySurface = null

  const humanGameplayGate = {
    getBlocked: () => false,
    closeEquipmentModalIfOpen: () => {},
    closeEquipmentModal: () => {},
    getDungeonOutcomeAckPending: () => false,
    getEquipmentModalOpen: () => false,
  }
  const equipmentModalBridge = { show: () => {} }

  const neuralRecoveryTerminalHandler = { fn: () => false }
  const lifecycleActiveGate = { isActive: () => false }
  const orchestrationCtxHolder = { ctx: /** @type {object | null} */ (null) }

  async function ensureNnModelsReady() {
    await nnModelsWarmPromise?.catch(() => {})
  }

  const opponentTurnAutomation = createLiveMatchShellOpponentTurnAutomation({
    match,
    debugMode,
    nnRecovery,
    getHumanSeatId: () => humanGameplaySurface?.humanSeatId.value ?? null,
    getIsHumanTurn: () => humanGameplaySurface?.isHumanTurn.value ?? false,
    deferredPostDungeonState,
    matchNeuralLoadGateInFlight,
    gameplayInputLocked,
    previousVisibleState,
    presentationOrchestrator,
    activePresentation,
    enqueuePresentationTransition,
    getNeuralRefreshTerminalOpen: () => midMatchDialogSurface?.neuralRefreshTerminalOpen.value ?? false,
    getHeadlessCompletionInFlight: () => midMatchDialogSurface?.headlessCompletionInFlight.value ?? false,
    ensureNnModelsReady,
    nnRuntimeOptions: maintainerDebug.nnRuntimeOptions,
    handleNeuralRecoveryTerminalError: (error) => neuralRecoveryTerminalHandler.fn(error),
    isLifecycleActive: () => lifecycleActiveGate.isActive(),
    getMatchPageOrchestrationCtx: () => orchestrationCtxHolder.ctx,
    createHeadlessCompletionFlightGate: () =>
      midMatchDialogSurface.createHeadlessCompletionFlightGate(),
    syncPresentationLabel,
    clearPresentationOrchestrator,
    ackDungeonRunForTeardown: (run) => midMatchDialogSurface.ackDungeonRunForTeardown(run),
    onClearAutoResolveTimer: () => humanGameplaySurface?.clearAutoResolveTimer(),
  })

  humanGameplaySurface = createLiveMatchShellHumanGameplaySurface({
    match,
    dungeonRunnerSettingsStore,
    gameplayInputLocked,
    activePresentation,
    activePresentationLabel,
    previousVisibleState,
    deferredPostDungeonState,
    seatRecoveryIndicators: opponentTurnAutomation.seatRecoveryIndicators,
    getHumanGameplayBlocked: () => humanGameplayGate.getBlocked(),
    getDungeonOutcomeAckPending: () => humanGameplayGate.getDungeonOutcomeAckPending(),
    closeEquipmentModalIfOpen: () => humanGameplayGate.closeEquipmentModalIfOpen(),
    closeEquipmentModal: () => humanGameplayGate.closeEquipmentModal(),
    showEquipmentModal: (equipmentId) => equipmentModalBridge.show(equipmentId),
    enqueuePresentationTransition,
    isLifecycleActive: () => lifecycleActiveGate.isActive(),
    getEquipmentModalOpen: () => humanGameplayGate.getEquipmentModalOpen(),
    humanDungeonAutoRevealGapMs,
    resetAiTurnPrefetch: opponentTurnAutomation.resetAiTurnPrefetch,
  })

  const midMatchDialogCallbacks = {
    takeHumanAction: () => {},
    maybeRunHeadlessMatchCompletion: async () => {},
    syncPresentationLabel: () => {},
  }

  const midMatchDialogSurface = createLiveMatchShellMidMatchDialogSurface({
    match,
    gameplayInputLocked,
    isHumanTurn: humanGameplaySurface.isHumanTurn,
    sacrificeModeActive: humanGameplaySurface.sacrificeModeActive,
    legalActions: humanGameplaySurface.legalActions,
    visibleState: humanGameplaySurface.visibleState,
    humanSeatId: humanGameplaySurface.humanSeatId,
    memoryAidState: humanGameplaySurface.memoryAidState,
    deferredPostDungeonState,
    presentationOrchestrator,
    syncPresentationLabel: () => midMatchDialogCallbacks.syncPresentationLabel(),
    maybeRunHeadlessMatchCompletion: () => midMatchDialogCallbacks.maybeRunHeadlessMatchCompletion(),
    takeHumanAction: (action) => midMatchDialogCallbacks.takeHumanAction(action),
    selectedVorpalSpecies: humanGameplaySurface.selectedVorpalSpecies,
    onVorpalPickerCardTap: humanGameplaySurface.onVorpalPickerCardTap,
    confirmVorpalDeclaration: humanGameplaySurface.confirmVorpalDeclaration,
    resetVorpalPickerSelection: humanGameplaySurface.resetVorpalPickerSelection,
    reloadPage: () => window.location.reload(),
  })

  humanGameplayGate.getBlocked = () => midMatchDialogSurface.humanGameplayBlocked.value
  humanGameplayGate.getDungeonOutcomeAckPending = () =>
    midMatchDialogSurface.dungeonOutcomeAckPending.value
  humanGameplayGate.closeEquipmentModalIfOpen = () =>
    midMatchDialogSurface.closeEquipmentModalIfOpen()
  humanGameplayGate.closeEquipmentModal = () => midMatchDialogSurface.closeEquipmentModal()
  humanGameplayGate.getEquipmentModalOpen = () => midMatchDialogSurface.equipmentModalOpen.value
  equipmentModalBridge.show = midMatchDialogSurface.showEquipmentModal

  showDungeonStageForPresentationTrace = humanGameplaySurface.board.showDungeonStage
  dungeonStageViewForPresentationTrace = humanGameplaySurface.board.dungeonStageView

  aiTurnTraceHolder.trace = opponentTurnAutomation.aiTurnTrace

  const liveMatchPageSessionSink = createLiveMatchPageSessionSink({
    match,
    setNnModelsWarmPromise: (promise) => {
      nnModelsWarmPromise = promise
    },
    resetAiTurnPrefetch: opponentTurnAutomation.resetAiTurnPrefetch,
    setLastAppliedAiTurnTokenNull: opponentTurnAutomation.resetLastAppliedAiTurnToken,
    setPresentationInputWasLockedFalse,
    deferredPostDungeonState,
    nnDebugTraceText: maintainerDebug.nnDebugTraceText,
    nnDebugTraceHistory: maintainerDebug.nnDebugTraceHistory,
    presentationOrchestrator,
    syncPresentationLabel,
    neuralLoadGateTerminalOpen,
    clearCurrentMatch,
    storage: window.localStorage,
  })

  const lifecycleCoordination = createLiveMatchShellLifecycleCoordination({
    match,
    debugMode,
    deferredPostDungeonState,
    dungeonRunnerSettingsStore,
    liveMatchPageSessionSink,
    preparePresentationOnMount,
    resetPresentationForBootstrap,
    setNnModelsWarmPromise: (promise) => {
      nnModelsWarmPromise = promise
    },
    presentationOrchestrator,
    syncPresentationLabel,
    presentationTraceEnabled,
    nnRecovery,
    onRecoveryChanged: opponentTurnAutomation.onNnRecoveryChanged,
    scheduleAiTurnOnPresentationTick: opponentTurnAutomation.scheduleAiTurnOnPresentationTick,
    scheduleHumanAutoResolveIfReady: humanGameplaySurface.scheduleHumanAutoResolveIfReady,
    scheduleAiTurnIfReady: opponentTurnAutomation.scheduleAiTurnIfReady,
    bootstrapRecoveryState: opponentTurnAutomation.bootstrapRecoveryState,
    cancelAiTurnPrefetch: opponentTurnAutomation.cancelAiTurnPrefetch,
    getAiTurnTimerId: opponentTurnAutomation.getAiTurnTimerId,
    runOpponentHeadlessCompletion: opponentTurnAutomation.maybeRunHeadlessMatchCompletion,
    logNnRecoveryTrace: opponentTurnAutomation.logNnRecoveryTrace,
    openNeuralRefreshTerminal: () => midMatchDialogSurface.openNeuralRefreshTerminal(),
    getConfirmationDialogResolve: () => midMatchDialogSurface.getConfirmationDialogResolve(),
    getAutoResolveTimerId: humanGameplaySurface.getAutoResolveTimerId,
    matchNeuralLoadGateInFlight,
    neuralLoadGateTerminalOpen,
    setup: deps.setup,
    cloneSetup: deps.cloneSetup,
    storage: window.localStorage,
  })

  lifecycleActiveGate.isActive = () => lifecycleCoordination.isLifecycleActive()
  orchestrationCtxHolder.ctx = lifecycleCoordination.matchPageOrchestrationCtx
  neuralRecoveryTerminalHandler.fn = lifecycleCoordination.handleNeuralRecoveryTerminalError

  opponentTurnAutomation.activateMatchStateSubscription({
    persistMatch: (envelope) => persistCurrentMatch(window.localStorage, envelope),
    isLifecycleActive: () => lifecycleActiveGate.isActive(),
    scheduleHumanAutoResolveIfReady: humanGameplaySurface.scheduleHumanAutoResolveIfReady,
  })

  presentationUnlockHooks.onUnlock = () => {
    opponentTurnAutomation.onPresentationGameplayUnlocked({
      isLifecycleActive: () => lifecycleActiveGate.isActive(),
      scheduleHumanAutoResolveIfReady: humanGameplaySurface.scheduleHumanAutoResolveIfReady,
    })
    midMatchDialogSurface.autoContinueDeferredDungeonExitIfReady()
  }

  midMatchDialogCallbacks.takeHumanAction = humanGameplaySurface.takeHumanAction
  midMatchDialogCallbacks.maybeRunHeadlessMatchCompletion =
    lifecycleCoordination.maybeRunHeadlessMatchCompletion
  midMatchDialogCallbacks.syncPresentationLabel = syncPresentationLabel

  return reactive({
    board: {
      match,
      boardShellRef,
      heroCardSlotRef,
      dungeonCardMotionWrap,
      dungeonCardFaceRef,
      deckBadgeRef,
      dungeonPileMotionAnchorRef,
      heroChangeInterstitialOverlayRef,
      presentationFlightLayerRef,
      bindBoardShellRef,
      bindHeroCardSlotRef,
      bindDungeonCardMotionWrapRef,
      bindDungeonCardFaceRef,
      bindDeckBadgeRef,
      bindDungeonPileMotionAnchorRef,
      bindHeroChangeInterstitialOverlayRef,
      bindPresentationFlightLayerRef,
      bindBiddingEquipmentBadgeRef,
      dungeonStageAnimationClass,
      activePresentationLabel,
      gameplayInputLocked,
      activePresentation,
      skipActivePresentation,
      humanGameplayBlocked: midMatchDialogSurface.humanGameplayBlocked,
      headlessCompletionInFlight: midMatchDialogSurface.headlessCompletionInFlight,
      ...humanGameplaySurface.board,
    },
    dialogs: midMatchDialogSurface.dialogs,
    debug: {
      debugMode: maintainerDebug.debugMode,
      nnDebugTraceHistory: maintainerDebug.nnDebugTraceHistory,
      nnDebugTraceText: maintainerDebug.nnDebugTraceText,
      exportReplay: maintainerDebug.exportReplay,
      importReplay: maintainerDebug.importReplay,
      replayExportText: maintainerDebug.replayExportText,
      replayImportText: maintainerDebug.replayImportText,
    },
    page: {
      mountLiveMatchShell: lifecycleCoordination.mountLiveMatchShell,
      unmountLiveMatchShell: lifecycleCoordination.unmountLiveMatchShell,
      applyBootstrappedMatchSession: lifecycleCoordination.applyBootstrappedMatchSession,
      processBootstrappedSession: lifecycleCoordination.processBootstrappedSession,
      kickMatchAutomation: lifecycleCoordination.kickMatchAutomation,
      maybeRunHeadlessMatchCompletion: lifecycleCoordination.maybeRunHeadlessMatchCompletion,
      resetForSetupTerminal: lifecycleCoordination.resetForSetupTerminal,
      resetForFreshMatchEntry: lifecycleCoordination.resetForFreshMatchEntry,
      resetForBackToSetup: lifecycleCoordination.resetForBackToSetup,
      matchPageOrchestrationCtx: lifecycleCoordination.matchPageOrchestrationCtx,
      runLivePageMatchEntryGate: lifecycleCoordination.runLivePageMatchEntryGate,
      requestConfirmation: midMatchDialogSurface.requestConfirmation,
      buildNewMatchEnvelope,
    },
  })
}
