import { ref } from 'vue'
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

/**
 * Instantiates and wires **live match shell concern** modules into a stable inject API.
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
 *   storage?: Storage
 *   reloadPage?: () => void
 * }} deps
 */
export function wireLiveMatchShellConcerns(deps) {
  const match = deps.match
  const debugMode = deps.debugMode
  const storage = deps.storage ?? globalThis.localStorage
  const reloadPage = deps.reloadPage ?? (() => globalThis.window.location.reload())

  /** @type {import('vue').ComputedRef<boolean> | null} */
  let showDungeonStageForPresentationTrace = null
  /** @type {import('vue').ComputedRef<object> | null} */
  let dungeonStageViewForPresentationTrace = null

  const bridges = {
    presentationUnlock: { onUnlock: () => {} },
    aiTurnTrace: { trace: () => () => {} },
    humanGameplayGate: {
      getBlocked: () => false,
      closeEquipmentModalIfOpen: () => {},
      closeEquipmentModal: () => {},
      getDungeonOutcomeAckPending: () => false,
      getEquipmentModalOpen: () => false,
    },
    equipmentModal: { show: () => {} },
    neuralRecoveryTerminal: { fn: () => false },
    lifecycle: { isActive: () => false },
    orchestrationCtx: { ctx: /** @type {object | null} */ (null) },
    midMatchDialog: {
      takeHumanAction: () => {},
      maybeRunHeadlessMatchCompletion: async () => {},
      syncPresentationLabel: () => {},
    },
  }

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
        persistCurrentMatch(storage, match.value)
      }
    },
    onGameplayInputUnlocked: () => bridges.presentationUnlock.onUnlock(),
    getPresentationActiveTraceContext: () => ({
      showDungeonStage: showDungeonStageForPresentationTrace?.value ?? false,
      dungeonStageView: dungeonStageViewForPresentationTrace?.value ?? null,
    }),
    debugMode,
    aiTurnTrace: (baseContext = {}) => bridges.aiTurnTrace.trace(baseContext),
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
  /** @type {ReturnType<typeof createLiveMatchShellMidMatchDialogSurface> | null} */
  let midMatchDialogSurface = null

  async function ensureNnModelsReady() {
    await nnModelsWarmPromise?.catch(() => {})
  }

  const opponentTurnAutomation = createLiveMatchShellOpponentTurnAutomation({
    match,
    debugMode,
    nnRecovery,
    deferredPostDungeonState,
    matchNeuralLoadGateInFlight,
    human: {
      getHumanSeatId: () => humanGameplaySurface?.humanSeatId.value ?? null,
      getIsHumanTurn: () => humanGameplaySurface?.isHumanTurn.value ?? false,
      onClearAutoResolveTimer: () => humanGameplaySurface?.clearAutoResolveTimer(),
    },
    presentation: {
      gameplayInputLocked,
      previousVisibleState,
      presentationOrchestrator,
      activePresentation,
      enqueuePresentationTransition,
      syncPresentationLabel,
      clearPresentationOrchestrator,
    },
    dialog: {
      getNeuralRefreshTerminalOpen: () => midMatchDialogSurface?.neuralRefreshTerminalOpen.value ?? false,
      getHeadlessCompletionInFlight: () => midMatchDialogSurface?.headlessCompletionInFlight.value ?? false,
      createHeadlessCompletionFlightGate: () =>
        midMatchDialogSurface.createHeadlessCompletionFlightGate(),
      ackDungeonRunForTeardown: (run) => midMatchDialogSurface.ackDungeonRunForTeardown(run),
    },
    lifecycle: {
      isLifecycleActive: () => bridges.lifecycle.isActive(),
      getMatchPageOrchestrationCtx: () => bridges.orchestrationCtx.ctx,
      handleNeuralRecoveryTerminalError: (error) => bridges.neuralRecoveryTerminal.fn(error),
    },
    recovery: {
      ensureNnModelsReady,
      nnRuntimeOptions: maintainerDebug.nnRuntimeOptions,
    },
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
    getHumanGameplayBlocked: () => bridges.humanGameplayGate.getBlocked(),
    getDungeonOutcomeAckPending: () => bridges.humanGameplayGate.getDungeonOutcomeAckPending(),
    closeEquipmentModalIfOpen: () => bridges.humanGameplayGate.closeEquipmentModalIfOpen(),
    closeEquipmentModal: () => bridges.humanGameplayGate.closeEquipmentModal(),
    showEquipmentModal: (equipmentId) => bridges.equipmentModal.show(equipmentId),
    enqueuePresentationTransition,
    isLifecycleActive: () => bridges.lifecycle.isActive(),
    getEquipmentModalOpen: () => bridges.humanGameplayGate.getEquipmentModalOpen(),
    humanDungeonAutoRevealGapMs,
    resetAiTurnPrefetch: opponentTurnAutomation.resetAiTurnPrefetch,
  })

  midMatchDialogSurface = createLiveMatchShellMidMatchDialogSurface({
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
    syncPresentationLabel: () => bridges.midMatchDialog.syncPresentationLabel(),
    maybeRunHeadlessMatchCompletion: () => bridges.midMatchDialog.maybeRunHeadlessMatchCompletion(),
    takeHumanAction: (action) => bridges.midMatchDialog.takeHumanAction(action),
    vorpalPickerView: humanGameplaySurface.vorpalPickerView,
    onVorpalPickerCardTap: humanGameplaySurface.onVorpalPickerCardTap,
    confirmVorpalDeclaration: humanGameplaySurface.confirmVorpalDeclaration,
    reloadPage,
  })

  bridges.humanGameplayGate.getBlocked = () => midMatchDialogSurface.humanGameplayBlocked.value
  bridges.humanGameplayGate.getDungeonOutcomeAckPending = () =>
    midMatchDialogSurface.dungeonOutcomeAckPending.value
  bridges.humanGameplayGate.closeEquipmentModalIfOpen = () =>
    midMatchDialogSurface.closeEquipmentModalIfOpen()
  bridges.humanGameplayGate.closeEquipmentModal = () => midMatchDialogSurface.closeEquipmentModal()
  bridges.humanGameplayGate.getEquipmentModalOpen = () => midMatchDialogSurface.equipmentModalOpen.value
  bridges.equipmentModal.show = midMatchDialogSurface.showEquipmentModal

  showDungeonStageForPresentationTrace = humanGameplaySurface.board.showDungeonStage
  dungeonStageViewForPresentationTrace = humanGameplaySurface.board.dungeonStageView
  bridges.aiTurnTrace.trace = opponentTurnAutomation.aiTurnTrace

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
    storage,
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
    subscribeMatchState: () =>
      opponentTurnAutomation.activateMatchStateSubscription({
        persistMatch: (envelope) => persistCurrentMatch(storage, envelope),
        isLifecycleActive: () => bridges.lifecycle.isActive(),
        scheduleHumanAutoResolveIfReady: humanGameplaySurface.scheduleHumanAutoResolveIfReady,
      }),
    unsubscribeMatchState: (stopHandle) =>
      opponentTurnAutomation.deactivateMatchStateSubscription(stopHandle),
    matchNeuralLoadGateInFlight,
    neuralLoadGateTerminalOpen,
    setup: deps.setup,
    cloneSetup: deps.cloneSetup,
    storage,
  })

  bridges.lifecycle.isActive = () => lifecycleCoordination.isLifecycleActive()
  bridges.orchestrationCtx.ctx = lifecycleCoordination.matchPageOrchestrationCtx
  bridges.neuralRecoveryTerminal.fn = lifecycleCoordination.handleNeuralRecoveryTerminalError

  bridges.presentationUnlock.onUnlock = () => {
    opponentTurnAutomation.onPresentationGameplayUnlocked({
      isLifecycleActive: () => bridges.lifecycle.isActive(),
      scheduleHumanAutoResolveIfReady: humanGameplaySurface.scheduleHumanAutoResolveIfReady,
    })
    midMatchDialogSurface.autoContinueDeferredDungeonExitIfReady()
  }

  bridges.midMatchDialog.takeHumanAction = humanGameplaySurface.takeHumanAction
  bridges.midMatchDialog.maybeRunHeadlessMatchCompletion =
    lifecycleCoordination.maybeRunHeadlessMatchCompletion
  bridges.midMatchDialog.syncPresentationLabel = syncPresentationLabel

  function assembleInjectGroups() {
    return {
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
    }
  }

  return {
    presentation: presentationBinding,
    maintainerDebug,
    opponentTurnAutomation,
    humanGameplaySurface,
    midMatchDialogSurface,
    lifecycleCoordination,
    liveMatchPageSessionSink,
    assembleInjectGroups,
  }
}

export { buildNewMatchEnvelope }
