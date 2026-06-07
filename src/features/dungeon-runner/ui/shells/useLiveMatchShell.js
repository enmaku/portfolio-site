import { computed, reactive, ref, triggerRef, unref, watch } from 'vue'
import { MATCH_PHASES, applyAction, getLegalActions, getPlayerView } from '../../engine/kernel.js'
import {
  CURRENT_MATCH_SCHEMA_VERSION,
  clearCurrentMatch,
  persistCurrentMatch,
} from '../../persistence/currentMatch.js'
import { applySetupSnapshot } from '../../setup/state.js'
import { isNnAdventurerPickEnabled } from '../../setup/nnAdventurerPick.js'
import { buildStateFromReplayEnvelope } from '../../debug/replaySession.js'
import { exportReplayEnvelope, importReplayEnvelope } from '../../debug/replay.js'
import { abandonScheduledInferenceQueue, loadNnModel } from '../../nn/runtime.js'
import { createChooseNnActionWithRecovery } from '../../nn/chooseWithRecovery.js'
import { createPresentationOrchestrator, SPEED_PROFILES } from '../presentationOrchestrator.js'
import { buildAiTurnRunToken } from '../dungeonRunnerAiTurnToken.js'
import {
  cancelAiTurnPrefetch,
  consumeAiTurnPrefetch,
  resetAiTurnPrefetch,
  startAiTurnPrefetch,
} from '../dungeonRunnerAiTurnPrefetch.js'
import { createPipelineStepLogger } from '../../nn/nnPipelineTrace.js'
import { dungeonRunnerAssetPack, dungeonRunnerEquipmentSymbolRuntimePath } from '../assetPack.js'
import { equipmentTokenAppearance } from '../../equipmentTokenAppearance.js'
import { equipmentShortName, getAdventurerIdentity } from '../../data/gameDataCatalog.js'
import { adventurerChoiceHeadline, legalActionBoardLabel } from '../dungeonRunnerPlayerPhrasing.js'
import {
  buildDungeonEquipmentTokenView,
  createDungeonEquipmentModalView,
  filterVisibleLegalActions,
} from '../dungeonEquipmentInteractions.js'
import {
  buildBiddingPostDrawActionPane,
  canEnterBiddingSacrificeMode,
  createBiddingSacrificeEquipmentModalView,
  isBiddingPostDrawContext,
  isSacrificeTargetEquipmentToken,
  legalSacrificeEquipmentIds,
  shouldUseBiddingSacrificeEquipmentModalView,
} from '../biddingSacrificeInteractions.js'
import {
  applyVorpalPickerSpeciesTap,
  createVorpalDeclarationPickerView,
} from '../vorpalDeclarationPickerInteractions.js'
import { createBiddingBoardViewModel } from '../biddingBoardViewModel.js'
import {
  viewerMaySeeAddToDungeonFlipDown,
  viewerMaySeeBiddingDrawFace,
} from '../biddingPresentationVisibility.js'
import { createDungeonResolutionViewModel } from '../dungeonResolutionViewModel.js'
import {
  buildDungeonOutcomeTransitionControls,
  dungeonStageClassForKind,
  shouldExecuteScheduledAutoResolve,
  shouldAutoResolveDungeonAdvance,
} from '../dungeonResolutionFlow.js'
import {
  buildDungeonOutcomeSummary,
  dismissDungeonRunForOutcomeDialog,
  isDungeonOutcomeDialogOpen,
  resolveDungeonOutcomeMessage,
  resolveLastDungeonRunWatcherUpdate,
  shouldShowDungeonOutcomeDialog,
} from '../dungeonOutcomeDialog.js'
import {
  isEquipmentModalActionsDisabled,
  isHumanGameplayBlocked,
  shouldRejectEquipmentTokenTap,
} from '../humanGameplayGate.js'
import { shouldDeferDungeonExitUntilOutcomeAck } from '../headlessMatchCompletionRunner.js'
import {
  runHeadlessMatchCompletionForPage,
  buildNewMatchEnvelope,
  runMatchEntryNeuralLoadGateForPage,
} from '../../matchPageOrchestration.js'
import { createMatchPageOrchestrationContext } from '../../createMatchPageOrchestrationContext.js'
import { createLiveMatchPageSessionSink } from '../../createLiveMatchPageSessionSink.js'
import { resetLiveMatchPageState } from '../../resetLiveMatchPageState.js'
import { createLivePlayActionChooser } from '../livePlayActionChooser.js'
import {
  closeDeckSplay,
  createMemoryAidState,
  setMemoryAidEnabled,
  tapDeck,
} from '../memoryAidState.js'
import { isDungeonPresentationTraceEnabled } from '../dungeonPresentationTrace.js'
import { isDungeonOrchestratorPresentationKind } from '../orchestratorPresentationKinds.js'
import { usePresentationMotion } from '../usePresentationMotion.js'
import { evaluateLiveAiTurnPipelineGateForContext } from '../liveAiTurnPipelineGateContext.js'
import {
  buildAiTurnPrefetchSkipTrace,
  buildAiTurnRunSkipTrace,
  buildAiTurnScheduleSkipTrace,
} from '../liveAiTurnPipelineGateTrace.js'
import { buildSeatRecoveryIndicators, isActiveNnSeatRecovering } from '../neuralSeatRecoveryView.js'
import { handleLivePlayNeuralRecoveryTerminalError } from '../livePlayNeuralRecoveryTerminal.js'
import {
  activateLiveMatchShellLifecycle,
  deactivateLiveMatchShellLifecycle,
} from './liveMatchShellLifecycle.js'

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

  function presentationTraceEnabled() {
    return isDungeonPresentationTraceEnabled()
  }
  const nnRecovery = deps.nnRecovery
  const seatRecoveryIndicators = ref([])
  /** @type {(() => void) | null} */
  let unsubscribeNnRecovery = null
  let activeSeatRecoveryBlocking = false

  function syncSeatRecoveryIndicators() {
    const seats = match.value?.state?.seats ?? []
    seatRecoveryIndicators.value = buildSeatRecoveryIndicators({ seats, recovery: nnRecovery })
  }

  function resolveActiveSeatRecoveryBlocking() {
    return match.value?.state
      ? isActiveNnSeatRecovering({ state: match.value.state, recovery: nnRecovery })
      : false
  }

  function applySeatRecoveryBlockingTransition(blocking) {
    if (!activeSeatRecoveryBlocking && blocking) {
      cancelAiTurnPrefetch()
    }
    activeSeatRecoveryBlocking = blocking
  }

  function onNnRecoveryChanged() {
    syncSeatRecoveryIndicators()
    applySeatRecoveryBlockingTransition(resolveActiveSeatRecoveryBlocking())
    if (!liveMatchShellLifecycleActive) return
    scheduleAiTurnIfReady()
  }

  function logNnRecoveryTrace(modelId, step, detail = {}) {
    if (!debugMode.value) return
    aiTurnTrace({ modelId })(`recovery.${step}`, {
      loadAttempts: nnRecovery.getLoadAttempts(modelId),
      inferAttempts: nnRecovery.getInferAttempts(modelId),
      loadBackend: nnRecovery.getBackendPreference(modelId, 'load'),
      inferBackend: nnRecovery.getBackendPreference(modelId, 'infer'),
      ...detail,
    })
  }

  const chooseNnActionWithRecovery = createChooseNnActionWithRecovery({
    recovery: nnRecovery,
    onRecoveryBegin: (modelId) => logNnRecoveryTrace(modelId, 'begin'),
    onRecoveryAttempt: (detail) => logNnRecoveryTrace(detail.modelId, 'attempt', detail),
    onRecoverySettled: (modelId) => logNnRecoveryTrace(modelId, 'settled'),
  })

  function buildLivePlayChooserDeps(extra = {}) {
    return {
      nnRecovery,
      ensureNnModelsReady,
      nnRuntimeOptions,
      chooseNnActionWithRecovery,
      ...extra,
    }
  }

  function evaluatePageAiTurnPipelineGate({ runToken = '', timerPending = false } = {}) {
    return evaluateLiveAiTurnPipelineGateForContext({
      matchState: match.value?.state ?? null,
      humanSeatId: humanSeatId.value,
      isHumanTurn: isHumanTurn.value,
      hasMatch: !!match.value,
      neuralRefreshTerminalOpen: neuralRefreshTerminalOpen.value,
      matchNeuralLoadGateInFlight: matchNeuralLoadGateInFlight.value,
      aiTurnInFlight,
      headlessCompletionInFlight: headlessCompletionInFlight.value,
      deferredPostDungeonState: deferredPostDungeonState.value,
      gameplayInputLocked: gameplayInputLocked.value,
      recovery: nnRecovery,
      runToken,
      lastAppliedAiTurnToken,
      timerPending,
      pickAdventurerNnEnabled: isNnAdventurerPickEnabled(),
    })
  }
  const replayImportText = deps.replayImportText
  const replayExportText = deps.replayExportText
  const nnDebugTraceText = deps.nnDebugTraceText
  const nnDebugTraceHistory = deps.nnDebugTraceHistory
  const presentationOrchestrator = createPresentationOrchestrator()
  const dungeonRunnerSettingsStore = deps.dungeonRunnerSettingsStore

  const presentationSpeedProfile = deps.presentationSpeedProfile
  const activePresentation = ref(null)
  const boardShellRef = ref(null)
  const heroCardSlotRef = ref(null)
  const dungeonCardMotionWrap = ref(null)
  const dungeonCardFaceRef = ref(null)
  const deckBadgeRef = ref(null)
  const dungeonPileMotionAnchorRef = ref(null)
  const heroChangeInterstitialOverlayRef = ref(null)
  const presentationFlightLayerRef = ref(null)
  const biddingEquipmentBadgeRefs = reactive({})

  function domEl(componentOrEl) {
    if (!componentOrEl) return null
    if (componentOrEl.nodeType === 1) return componentOrEl
    const inner = componentOrEl.$el
    return inner?.nodeType === 1 ? inner : null
  }

  /** `defineExpose`d Refs from child components; QBadge roots via {@link domEl}. */
  function unwrapMotionDom(exposedMaybeRef) {
    if (exposedMaybeRef == null) return null
    const el = unref(exposedMaybeRef)
    return el?.nodeType === 1 ? el : null
  }

  function bindBiddingEquipmentBadgeRef(equipmentId, componentOrEl) {
    const node = domEl(componentOrEl)
    if (node) biddingEquipmentBadgeRefs[equipmentId] = node
    else delete biddingEquipmentBadgeRefs[equipmentId]
  }

  // GSAP: most beats tween `boardShell` (shared placeholder) plus kind-specific refs — `DUNGEON_REVEAL` tweens `dungeonCardWrap` (opacity / y / scale) and `dungeonCardFlipAxis` (`rotationY` flip); damage / neutralize / continue use `dungeonCardWrap` + shell; `DUNGEON_OUTCOME` tweens the wrap only (no shell tween); teardown clears wrap + shell after that beat for neutral baseline (#66).
  // `HERO_CHANGE_INTERSTITIAL` → overlay only; bot bidding → `dungeonCardWrap` / `deckBadge` / equipment; neutralize + sacrifice use `presentationFlightLayer` + `equipment_*` (see presentationMotionRegistry.js).
  // Window resize during fragile motion (ghost flight #68, or dungeon reveal flip) swaps to shell+card-only tweens for the rest of that beat (#71); orchestrator `remainingMs` is not recomputed on resize (#68).
  usePresentationMotion({
    activePresentation,
    getMotionRefs: (head) => {
      if (head?.kind === 'HERO_CHANGE_INTERSTITIAL') {
        return {
          heroChangeInterstitialOverlay: heroChangeInterstitialOverlayRef.value,
          boardShell: boardShellRef.value,
        }
      }
      const base = {
        boardShell: boardShellRef.value,
        dungeonCardWrap: dungeonCardMotionWrap.value,
        dungeonCardFlipAxis: unwrapMotionDom(dungeonCardFaceRef.value?.dungeonCardFlipAxis),
        deckBadge: domEl(deckBadgeRef.value),
        dungeonPileBadge: dungeonPileMotionAnchorRef.value,
        presentationFlightLayer: presentationFlightLayerRef.value,
        presentationGhostTarget: heroCardSlotRef.value,
      }
      if (
        presentationTraceEnabled() &&
        (head?.kind === 'DUNGEON_REVEAL' || head?.kind === 'BIDDING_DRAW')
      ) {
        const snapEl = (el) => {
          if (!el || typeof el.getBoundingClientRect !== 'function') return { present: false }
          const r = el.getBoundingClientRect()
          return {
            present: true,
            tag: el.tagName,
            w: Math.round(r.width * 100) / 100,
            h: Math.round(r.height * 100) / 100,
            cx: Math.round((r.left + r.width / 2) * 100) / 100,
            cy: Math.round((r.top + r.height / 2) * 100) / 100,
          }
        }
        const deckNode = domEl(deckBadgeRef.value)
        console.log('[DungeonRunner][card-flight][refs]', {
          kind: head.kind,
          id: head.id,
          durationMs: head.durationMs,
          dungeonCardWrap: snapEl(base.dungeonCardWrap),
          dungeonPileAnchor: snapEl(base.dungeonPileBadge),
          deckBadgeResolved: snapEl(base.deckBadge),
          dungeonCardFlipAxis: snapEl(base.dungeonCardFlipAxis),
          deckBadgeRawDomEl: snapEl(deckNode),
          refsBound: {
            dungeonPileMotionAnchorRef: !!dungeonPileMotionAnchorRef.value,
            deckBadgeRef: !!deckBadgeRef.value,
            dungeonCardMotionWrap: !!dungeonCardMotionWrap.value,
            dungeonCardFaceRef: !!dungeonCardFaceRef.value,
          },
        })
      }
      if (head?.kind !== 'BIDDING_SACRIFICE' && head?.kind !== 'DUNGEON_NEUTRALIZE') return base
      const ids =
        head?.payload?.responsibleEquipmentIds ?? head?.payload?.consumedEquipmentIds ?? []
      const extra = {}
      for (const id of ids) {
        const node = biddingEquipmentBadgeRefs[id]
        if (node?.nodeType === 1) extra[`equipment_${id}`] = node
      }
      return { ...base, ...extra }
    },
  })
  const activePresentationLabel = ref('')
  const equipmentModalOpen = ref(false)
  const selectedEquipmentTokenId = ref(null)
  const neuralLoadGateTerminalOpen = deps.neuralLoadGateTerminalOpen
  const neuralRefreshTerminalOpen = ref(false)
  const matchNeuralLoadGateInFlight = deps.matchNeuralLoadGateInFlight
  const confirmationDialogOpen = ref(false)
  const confirmationDialogTitle = ref('Confirm')
  const confirmationDialogMessage = ref('')
  const confirmationDialogOkLabel = ref('OK')
  const confirmationDialogCancelLabel = ref('Cancel')
  let confirmationDialogResolve = null
  const selectedVorpalSpecies = ref(null)
  const memoryAidState = ref(
    createMemoryAidState({ enabled: dungeonRunnerSettingsStore.memoryAidEnabled }),
  )
  const previousVisibleState = ref(null)
  const dismissedDungeonRun = ref(null)
  const equipmentRemainingAtResolution = ref(null)
  const deferredPostDungeonState = ref(null)
  let presentationTimerId = null
  let aiTurnTimerId = null
  let liveMatchShellLifecycleActive = false
  let autoResolveTimerId = null
  let aiTurnInFlight = false
  let lastAppliedAiTurnToken = null
  let presentationInputWasLocked = false
  let lastPresentationTraceKey = null
  let lastScheduleSkipKey = ''
  let lastPrimeSkipTraceKey = ''
  /** @type {Promise<void> | null} */
  let nnModelsWarmPromise = null

  const liveMatchPageSessionSink = createLiveMatchPageSessionSink({
    match,
    setNnModelsWarmPromise: (promise) => {
      nnModelsWarmPromise = promise
    },
    resetAiTurnPrefetch,
    setLastAppliedAiTurnTokenNull: () => {
      lastAppliedAiTurnToken = null
    },
    setPresentationInputWasLockedFalse: () => {
      presentationInputWasLocked = false
    },
    deferredPostDungeonState,
    nnDebugTraceText,
    nnDebugTraceHistory,
    presentationOrchestrator,
    syncPresentationLabel,
    neuralLoadGateTerminalOpen,
    clearCurrentMatch,
    storage: window.localStorage,
  })

  const AI_TURN_SCHEDULE_DELAY_MS = 300

  function aiTurnTrace(baseContext = {}) {
    return createPipelineStepLogger('AITurn', debugMode.value, {
      matchId: match.value?.id ?? null,
      ...baseContext,
    })
  }

  const SCHEDULE_SKIP_THROTTLE_REASONS = new Set([
    'gameplay-locked',
    'timer-pending',
    'in-flight',
    'already-applied-token',
    'deferred-post-dungeon',
    'headless-completion',
  ])

  function logAiTurnScheduleSkip(reason, detail = {}) {
    if (!debugMode.value) return
    const key = `${reason}:${detail.runToken ?? detail.activeKind ?? ''}`
    if (SCHEDULE_SKIP_THROTTLE_REASONS.has(reason) && key === lastScheduleSkipKey) return
    lastScheduleSkipKey = key
    console.warn('[DungeonRunner][AITurn][Schedule] skip', reason, detail)
  }

  function logAiTurnPrimeSkip(reason, detail = {}) {
    if (!debugMode.value) return
    const key = `${reason}:${detail.runToken ?? detail.phase ?? detail.seatId ?? detail.roleType ?? ''}`
    if (key === lastPrimeSkipTraceKey) return
    lastPrimeSkipTraceKey = key
    aiTurnTrace()('prefetch.prime.skip', { reason, ...detail })
  }

  function scheduleAiTurnOnPresentationTick() {
    if (!liveMatchShellLifecycleActive) return
    if (
      !match.value ||
      isHumanTurn.value ||
      deferredPostDungeonState.value ||
      headlessCompletionInFlight.value
    ) {
      return
    }
    scheduleAiTurnIfReady()
  }
  const uiAssets = dungeonRunnerAssetPack

  watch(presentationSpeedProfile, (next) => {
    presentationOrchestrator.setSpeedProfile(next)
    syncPresentationLabel()
    triggerRef(activePresentation)
    if (match.value) {
      match.value = { ...match.value, presentationSpeedProfile: next }
      persistCurrentMatch(window.localStorage, match.value)
    }
  })

  watch(
    () => dungeonRunnerSettingsStore.memoryAidEnabled,
    (enabled) => {
      memoryAidState.value = setMemoryAidEnabled(memoryAidState.value, enabled)
    },
    { immediate: true },
  )

  const humanSeatId = computed(
    () => match.value?.state.seats.find((seat) => seat.role.type === 'human')?.id ?? null,
  )
  const isHumanTurn = computed(
    () =>
      !!match.value &&
      humanSeatId.value != null &&
      match.value.state.turn.activeSeatId === humanSeatId.value,
  )
  const humanBiddingRevealedMonsterCard = computed(() => {
    if (!isHumanTurn.value || !match.value) return null
    return match.value.state.bidding?.revealedMonsterCard ?? null
  })
  const legalActions = computed(() => {
    if (!match.value || !isHumanTurn.value) return []
    return getLegalActions(match.value.state, { seatId: humanSeatId.value })
  })
  const isHumanBiddingPostDrawContext = computed(() =>
    isBiddingPostDrawContext({
      phase: match.value?.state?.phase ?? null,
      revealedMonsterCard: humanBiddingRevealedMonsterCard.value,
      legalActions: legalActions.value,
    }),
  )
  const visibleLegalActions = computed(() =>
    filterVisibleLegalActions({
      phase: match.value?.state?.phase ?? null,
      legalActions: legalActions.value,
    }),
  )
  const visiblePrimaryActions = computed(() => {
    const actions = visibleLegalActions.value.filter((action) => action.type !== 'REVEAL_OR_CONTINUE')
    if (isHumanBiddingPostDrawContext.value) {
      return actions.filter((action) => action.type !== 'SACRIFICE')
    }
    return actions
  })
  /** Matches engine pick-adventurer legal action order. */
  const HERO_CHOICE_ACTION_ORDER = ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']
  const showHeroPickActionGrid = computed(() => {
    const actions = visiblePrimaryActions.value
    if (actions.length !== HERO_CHOICE_ACTION_ORDER.length) return false
    return actions.every((a) => a.type === 'CHOOSE_NEXT_ADVENTURER')
  })
  const heroPickActionsOrdered = computed(() => {
    if (!showHeroPickActionGrid.value) return []
    const byHero = new Map(visiblePrimaryActions.value.map((a) => [a.hero, a]))
    return HERO_CHOICE_ACTION_ORDER.map((hero) => byHero.get(hero)).filter(Boolean)
  })
  const sacrificeModeActive = ref(false)
  const gameplayInputLocked = ref(false)
  const headlessCompletionInFlight = ref(false)
  const visibleState = computed(() => {
    if (!match.value || !humanSeatId.value) return null
    return getPlayerView(match.value.state, { seatId: humanSeatId.value })
  })
  const dungeonOutcomeAckPending = computed(() =>
    isDungeonOutcomeDialogOpen({
      lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
      dismissedDungeonRun: dismissedDungeonRun.value,
    }),
  )
  const dungeonEquipmentTokens = computed(() =>
    buildDungeonEquipmentTokenView({
      inPlayEquipmentIds: visibleState.value?.dungeon?.inPlayEquipmentIds ?? [],
      legalActions: legalActions.value,
    }),
  )
  const dungeonResolutionView = computed(() =>
    createDungeonResolutionViewModel({
      visibleState: visibleState.value ?? {},
      previousVisibleState: previousVisibleState.value ?? {},
      legalActions: legalActions.value,
      activeAnimation: activePresentation.value,
    }),
  )
  const showDungeonStage = computed(() => {
    if (match.value?.state?.phase === 'dungeon') return true
    if (isDungeonOrchestratorPresentationKind(activePresentation.value?.kind ?? null)) return true
    return dungeonOutcomeAckPending.value
  })
  const dungeonStageView = computed(() =>
    createDungeonResolutionViewModel({
      visibleState: visibleState.value ?? {},
      previousVisibleState: previousVisibleState.value ?? {},
      legalActions: legalActions.value,
      activeAnimation: activePresentation.value,
      preserveMonsterCardUntilRunAck: dungeonOutcomeAckPending.value,
    }),
  )
  const dungeonStageAnimationClass = computed(() =>
    dungeonStageClassForKind(activePresentation.value?.kind ?? null),
  )
  const dungeonOutcomeTransitionControls = computed(() =>
    buildDungeonOutcomeTransitionControls({
      phase: match.value?.state?.phase ?? null,
      gameplayInputLocked: gameplayInputLocked.value,
      resolutionStatus: dungeonResolutionView.value.resolutionStatus,
      autoAdvanceAction: dungeonResolutionView.value.autoAdvanceAction,
    }),
  )
  const actionableEquipmentIds = computed(
    () => new Set(dungeonResolutionView.value.highlightedEquipmentIds),
  )
  const boardEquipmentTokens = computed(() => {
    const dungeonTokenById = new Map(
      dungeonEquipmentTokens.value.map((token) => [token.equipmentId, token]),
    )
    const isDungeonPhase = match.value?.state?.phase === 'dungeon'
    const hasActionable = actionableEquipmentIds.value.size > 0
    const sacrificableIds = legalSacrificeEquipmentIds(legalActions.value)
    return biddingBoard.value.secondary.equipment.map((equipment) => {
      const dungeonToken = dungeonTokenById.get(equipment.equipmentId)
      const removed =
        equipment.removed ||
        equipment.consumed ||
        (isDungeonPhase && !dungeonTokenById.has(equipment.equipmentId))
      const actionable = isDungeonPhase && actionableEquipmentIds.value.has(equipment.equipmentId)
      const appearance = equipmentTokenAppearance(equipment.equipmentId)
      const isSacrificeTarget = isSacrificeTargetEquipmentToken({
        sacrificeModeActive: sacrificeModeActive.value,
        equipmentId: equipment.equipmentId,
        removed,
        legalSacrificeEquipmentIds: sacrificableIds,
      })
      return {
        equipmentId: equipment.equipmentId,
        ariaLabel: equipmentShortName(equipment.equipmentId),
        symbolRuntimePath: dungeonRunnerEquipmentSymbolRuntimePath(appearance.symbolKey),
        equipmentOverlay: appearance.overlay,
        removed,
        glow: isDungeonPhase ? (dungeonToken?.glow ?? false) : false,
        pulse: actionable,
        deemphasized: isDungeonPhase && hasActionable && !actionable && !removed,
        canUseNow: dungeonToken?.canUseNow ?? false,
        hasModal: true,
        isSacrificeTarget,
      }
    })
  })
  const selectedEquipmentModalView = computed(() => {
    if (!selectedEquipmentTokenId.value) return null
    const phase = match.value?.state?.phase ?? null
    if (shouldUseBiddingSacrificeEquipmentModalView({ phase, sacrificeModeActive: sacrificeModeActive.value })) {
      return createBiddingSacrificeEquipmentModalView({
        equipmentId: selectedEquipmentTokenId.value,
        legalActions: legalActions.value,
        sacrificeModeActive: sacrificeModeActive.value,
      })
    }
    return createDungeonEquipmentModalView({
      equipmentId: selectedEquipmentTokenId.value,
      legalActions: legalActions.value,
    })
  })
  const vorpalPickerView = computed(() =>
    createVorpalDeclarationPickerView({
      isHumanTurn: isHumanTurn.value,
      gameplayInputLocked: gameplayInputLocked.value,
      phase: match.value?.state?.phase ?? null,
      subphase: match.value?.state?.dungeon?.subphase ?? null,
      legalActions: legalActions.value,
      memoryAidEnabled: memoryAidState.value.enabled,
      viewerOwnPileAdds: visibleState.value?.playerOwnPileAdds?.[humanSeatId.value ?? ''] ?? [],
      selectedSpecies: selectedVorpalSpecies.value,
      humanGameplayBlocked: humanGameplayBlocked.value,
    }),
  )
  const biddingBoard = computed(() =>
    createBiddingBoardViewModel({
      state: match.value?.state ?? null,
      visibleState: visibleState.value,
      activeAnimation: activePresentation.value,
      viewerSeatId: humanSeatId.value,
      settings: {
        memoryAidEnabled: memoryAidState.value.enabled,
      },
    }),
  )
  const seatRunTrackerRows = computed(() => {
    const recoveryBySeatId = new Map(
      seatRecoveryIndicators.value.map((entry) => [entry.seatId, entry]),
    )
    return biddingBoard.value.secondary.seats.map((row) => {
      const scoreboard = match.value?.state?.scoreboard ?? {}
      const score = scoreboard[row.seatId] ?? {}
      const successes = Math.max(0, Number(score.successes ?? 0))
      const failures = Math.max(0, 2 - Number(score.lives ?? 2))
      const recovery = recoveryBySeatId.get(row.seatId)
      return {
        seatId: row.seatId,
        label: row.label,
        passed: row.passed,
        isActive: row.isActive,
        successes,
        failures,
        recovering: recovery?.recovering ?? false,
        recoveryTestId: recovery?.testId ?? null,
        ariaLabel: `${row.label}: ${successes} successful run${successes === 1 ? '' : 's'}, ${failures} failed run${failures === 1 ? '' : 's'}`,
      }
    })
  })
  const biddingCardEmpty = computed(
    () =>
      match.value?.state?.phase === 'bidding' &&
      !showDungeonStage.value &&
      biddingBoard.value.primaryCard.variant === 'empty',
  )
  const monsterCardSlotEmpty = computed(() => {
    if (showDungeonStage.value) return dungeonStageView.value.monster.visibility === 'empty'
    return biddingCardEmpty.value
  })
  const biddingStageSpecies = computed(() => {
    if (showDungeonStage.value) return null
    if (match.value?.state?.phase !== 'bidding') return null
    if (activePresentation.value?.kind === 'BIDDING_DRAW') return null
    return biddingBoard.value.primaryCard.variant === 'revealed'
      ? biddingBoard.value.primaryCard.monsterCard
      : null
  })
  const biddingStageFaceDown = computed(() => {
    if (showDungeonStage.value) return true
    if (match.value?.state?.phase !== 'bidding') return true
    if (activePresentation.value?.kind === 'BIDDING_DRAW') return true
    return biddingBoard.value.primaryCard.variant !== 'revealed'
  })
  const heroChangeInterstitialView = computed(() => {
    if (activePresentation.value?.kind !== 'HERO_CHANGE_INTERSTITIAL') return null
    const payload = activePresentation.value?.payload
    if (!payload?.heroAfter) return null
    const seats = match.value?.state?.seats ?? []
    const actorSeatId = payload.actorSeatId ?? null
    const actorLabel =
      seats.find((seat) => seat.id === actorSeatId)?.label ?? actorSeatId ?? 'Unknown'
    const chosen = getAdventurerIdentity(payload.heroAfter)
    return {
      headline: adventurerChoiceHeadline(actorLabel, payload.heroAfter),
      chosen,
    }
  })
  const heroChangeInterstitialAriaLabel = computed(
    () => heroChangeInterstitialView.value?.headline ?? '',
  )
  const deckSplayOpen = computed({
    get() {
      return memoryAidState.value.deckSplayOpen
    },
    set(open) {
      memoryAidState.value = open
        ? tapDeck(memoryAidState.value)
        : closeDeckSplay(memoryAidState.value)
    },
  })
  const dungeonOutcomeSummary = computed(() =>
    buildDungeonOutcomeSummary({
      lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
      seats: match.value?.state?.seats ?? [],
      equipmentRemainingAtResolution: equipmentRemainingAtResolution.value,
    }),
  )
  const dungeonOutcomeToneClass = computed(() =>
    dungeonOutcomeSummary.value?.resultLabel === 'Success'
      ? 'dr-outcome--success'
      : 'dr-outcome--failure',
  )
  const dungeonOutcomeMessage = computed(() =>
    resolveDungeonOutcomeMessage(match.value?.state?.lastDungeonRun ?? null),
  )
  const dungeonOutcomeDialogOpen = computed({
    get() {
      return shouldShowDungeonOutcomeDialog({
        headlessCompletionInFlight: headlessCompletionInFlight.value,
        gameplayInputLocked: gameplayInputLocked.value,
        lastDungeonRun: match.value?.state?.lastDungeonRun ?? null,
        dismissedDungeonRun: dismissedDungeonRun.value,
      })
    },
    set(open) {
      if (open) return
      continueFromDungeonOutcome()
    },
  })
  const humanGameplayBlocked = computed(() =>
    isHumanGameplayBlocked({
      gameplayInputLocked: gameplayInputLocked.value,
      dungeonOutcomeDialogOpen: dungeonOutcomeDialogOpen.value,
      headlessCompletionInFlight: headlessCompletionInFlight.value,
      neuralRefreshTerminalOpen: neuralRefreshTerminalOpen.value,
    }),
  )
  const equipmentModalActionsDisabled = computed(() =>
    isEquipmentModalActionsDisabled({
      humanGameplayBlocked: humanGameplayBlocked.value,
      isHumanTurn: isHumanTurn.value,
    }),
  )
  const showBiddingPostDrawActionPane = isHumanBiddingPostDrawContext
  const biddingPostDrawActionPane = computed(() =>
    buildBiddingPostDrawActionPane({
      sacrificeModeActive: sacrificeModeActive.value,
      phase: match.value?.state?.phase ?? null,
      revealedMonsterCard: humanBiddingRevealedMonsterCard.value,
      legalActions: legalActions.value,
      humanGameplayBlocked: humanGameplayBlocked.value,
    }),
  )
  const showActionPane = computed(
    () =>
      !!activePresentationLabel.value ||
      (isHumanTurn.value &&
        (visiblePrimaryActions.value.length > 0 ||
          biddingPostDrawActionPane.value.length > 0 ||
          dungeonOutcomeTransitionControls.value.length > 0)),
  )
  function applyBootstrappedMatchSession(matchEnvelope, pace) {
    dungeonRunnerSettingsStore.setAnimationPace(pace)
    match.value = matchEnvelope
    syncSeatRecoveryIndicators()
    activeSeatRecoveryBlocking = resolveActiveSeatRecoveryBlocking()
    deferredPostDungeonState.value = null
    presentationOrchestrator.clear()
    presentationSpeedProfile.value = pace
    presentationOrchestrator.setSpeedProfile(pace)
    nnModelsWarmPromise = Promise.resolve()
    syncPresentationLabel()
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
      neuralRefreshTerminalOpen.value = true
      return
    }
    void maybeRunHeadlessMatchCompletion()
  }

  function kickMatchAutomation() {
    if (!liveMatchShellLifecycleActive) return
    scheduleAiTurnIfReady()
    scheduleHumanAutoResolveIfReady()
  }

  watch(
    () => match.value?.state,
    (state) => {
      if (!match.value || !state) return
      syncSeatRecoveryIndicators()
      applySeatRecoveryBlockingTransition(resolveActiveSeatRecoveryBlocking())
      persistCurrentMatch(window.localStorage, match.value)
      if (!liveMatchShellLifecycleActive) return
      scheduleAiTurnIfReady()
      scheduleHumanAutoResolveIfReady()
    },
    { deep: true },
  )

  watch(
    () => match.value?.state?.lastDungeonRun ?? null,
    (run) => {
      const update = resolveLastDungeonRunWatcherUpdate(run, match.value?.state?.centerEquipment)
      if ('dismissedDungeonRun' in update) {
        dismissedDungeonRun.value = update.dismissedDungeonRun
        equipmentRemainingAtResolution.value = update.equipmentRemainingAtResolution
        return
      }
      equipmentRemainingAtResolution.value = update.equipmentRemainingAtResolution
    },
    { immediate: true },
  )

  watch(
    () => vorpalPickerView.value.open,
    () => {
      selectedVorpalSpecies.value = null
    },
  )

  watch(isHumanBiddingPostDrawContext, (active) => {
    if (!active) sacrificeModeActive.value = false
  })

  function resetForSetupTerminal() {
    resetLiveMatchPageState(liveMatchPageSessionSink, {
      clearMatch: true,
      openNeuralLoadGateTerminal: true,
    })
  }

  function resetForFreshMatchEntry() {
    resetLiveMatchPageState(liveMatchPageSessionSink, {
      warmModelsResolved: true,
    })
  }

  function resetForBackToSetup() {
    resetLiveMatchPageState(liveMatchPageSessionSink, {
      clearMatch: true,
      clearPersistedMatch: true,
    })
  }

  const matchPageOrchestrationCtx = createMatchPageOrchestrationContext({
    storage: window.localStorage,
    recovery: nnRecovery,
    loadModel: loadNnModel,
    setMatchNeuralLoadGateInFlight: (inFlight) => {
      matchNeuralLoadGateInFlight.value = inFlight
    },
    clearCurrentMatch,
    persistCurrentMatch,
    applySetupSnapshot,
    setupTarget: deps.setup,
    cloneSetup: deps.cloneSetup,
    onSetupTerminal: () => {
      resetForSetupTerminal()
    },
  })

  async function runLivePageMatchEntryGate(setupSnapshot) {
    return runMatchEntryNeuralLoadGateForPage(matchPageOrchestrationCtx, {
      setupSnapshot,
      releaseInFlightAfterGate: false,
    })
  }

  async function ensureNnModelsReady() {
    await nnModelsWarmPromise?.catch(() => {})
  }

  function reloadPageForNeuralRefreshTerminal() {
    window.location.reload()
  }

  function handleNeuralRecoveryTerminalError(error) {
    const result = handleLivePlayNeuralRecoveryTerminalError({
      error,
      match: match.value,
      recovery: nnRecovery,
      storage: window.localStorage,
      persistCurrentMatch,
      restoreSetup: (setupSnapshot) => {
        matchPageOrchestrationCtx.applySetupTerminal(deps.cloneSetup(setupSnapshot))
      },
    })
    if (!result.handled) return false
    if (result.action === 'refresh-dialog') {
      match.value = result.match
      neuralRefreshTerminalOpen.value = true
      logNnRecoveryTrace(result.trace.modelId, 'terminal', {
        terminal: result.trace.terminal,
        failureKind: result.trace.failureKind,
      })
    }
    return true
  }

  function takeHumanAction(action) {
    if (!match.value || !humanSeatId.value) {
      return
    }
    resetAiTurnPrefetch()
    if (humanGameplayBlocked.value) {
      return
    }
    if (autoResolveTimerId) {
      window.clearTimeout(autoResolveTimerId)
      autoResolveTimerId = null
    }
    if (equipmentModalOpen.value) equipmentModalOpen.value = false
    if (action.type === 'SACRIFICE') sacrificeModeActive.value = false
    const prevState = match.value.state
    previousVisibleState.value = getPlayerView(prevState, { seatId: humanSeatId.value })
    const result = applyAction(prevState, action, { seatId: humanSeatId.value })
    if (!result.ok) {
      return
    }
    const deferExit = shouldDeferDungeonExitUntilOutcomeAck(prevState, result.state)
    if (deferExit) {
      deferredPostDungeonState.value = result.state
      match.value = { ...match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
    } else {
      deferredPostDungeonState.value = null
      match.value = { ...match.value, state: result.state }
    }
    enqueuePresentationTransition(prevState, result.state, action, humanSeatId.value, 'human')
  }

  function onDeckTap() {
    memoryAidState.value = tapDeck(memoryAidState.value)
  }

  function onCloseDeckSplay() {
    memoryAidState.value = closeDeckSplay(memoryAidState.value)
  }

  function settleConfirmationDialog(result) {
    confirmationDialogOpen.value = false
    const resolve = confirmationDialogResolve
    confirmationDialogResolve = null
    if (typeof resolve === 'function') resolve(result)
  }

  function requestConfirmation({
    title = 'Confirm',
    message,
    okLabel = 'OK',
    cancelLabel = 'Cancel',
  }) {
    if (typeof confirmationDialogResolve === 'function') {
      confirmationDialogResolve(false)
      confirmationDialogResolve = null
    }
    confirmationDialogTitle.value = title
    confirmationDialogMessage.value = message
    confirmationDialogOkLabel.value = okLabel
    confirmationDialogCancelLabel.value = cancelLabel
    confirmationDialogOpen.value = true
    return new Promise((resolve) => {
      confirmationDialogResolve = resolve
    })
  }

  function onConfirmationDialogOk() {
    settleConfirmationDialog(true)
  }

  function onConfirmationDialogCancel() {
    settleConfirmationDialog(false)
  }

  function enterSacrificeMode() {
    if (
      !canEnterBiddingSacrificeMode({
        isHumanTurn: isHumanTurn.value,
        phase: match.value?.state?.phase ?? null,
        revealedMonsterCard: humanBiddingRevealedMonsterCard.value,
        legalActions: legalActions.value,
        humanGameplayBlocked: humanGameplayBlocked.value,
      })
    ) {
      return
    }
    sacrificeModeActive.value = true
  }

  function cancelSacrificeMode() {
    sacrificeModeActive.value = false
    equipmentModalOpen.value = false
  }

  function takeEquipmentSacrificeAction() {
    if (equipmentModalActionsDisabled.value || !selectedEquipmentModalView.value?.sacrificeAction) {
      return
    }
    takeHumanAction(selectedEquipmentModalView.value.sacrificeAction)
  }

  function openEquipmentModal(token) {
    if (
      shouldRejectEquipmentTokenTap({
        hasModal: token?.hasModal,
        humanGameplayBlocked: humanGameplayBlocked.value,
      })
    )
      return
    selectedEquipmentTokenId.value = token.equipmentId
    equipmentModalOpen.value = true
  }

  function takeEquipmentUseAction() {
    if (equipmentModalActionsDisabled.value || !selectedEquipmentModalView.value?.useAction) return
    takeHumanAction(selectedEquipmentModalView.value.useAction)
  }

  function continueFromEquipmentModal() {
    if (!equipmentModalActionsDisabled.value && selectedEquipmentModalView.value?.continueAction) {
      takeHumanAction(selectedEquipmentModalView.value.continueAction)
      return
    }
    equipmentModalOpen.value = false
  }

  async function continueFromDungeonOutcome() {
    const run = match.value?.state?.lastDungeonRun
    if (!run) return
    dismissedDungeonRun.value = dismissDungeonRunForOutcomeDialog(run)
    if (deferredPostDungeonState.value) {
      match.value = { ...match.value, state: deferredPostDungeonState.value }
      deferredPostDungeonState.value = null
    }
    presentationOrchestrator.flushPostDungeonOutcomeAnimations()
    syncPresentationLabel()
    await maybeRunHeadlessMatchCompletion()
  }

  function teardownForHeadlessMatchCompletion() {
    if (aiTurnTimerId) {
      window.clearTimeout(aiTurnTimerId)
      aiTurnTimerId = null
    }
    if (autoResolveTimerId) {
      window.clearTimeout(autoResolveTimerId)
      autoResolveTimerId = null
    }
    resetAiTurnPrefetch()
    abandonScheduledInferenceQueue()
    presentationOrchestrator.clear()
    deferredPostDungeonState.value = null
    lastAppliedAiTurnToken = null
    const run = match.value?.state?.lastDungeonRun
    if (run) dismissedDungeonRun.value = run
  }

  function createPageHeadlessCompletionFlightGate() {
    return {
      get inFlight() {
        return headlessCompletionInFlight.value
      },
      tryStart() {
        if (headlessCompletionInFlight.value) return false
        headlessCompletionInFlight.value = true
        return true
      },
      finish() {
        headlessCompletionInFlight.value = false
      },
    }
  }

  async function maybeRunHeadlessMatchCompletion() {
    try {
      const result = await runHeadlessMatchCompletionForPage(matchPageOrchestrationCtx, {
        match: match.value,
        humanPlayerSeatId: humanSeatId.value,
        chooseAction: createLivePlayActionChooser(buildLivePlayChooserDeps()),
        gate: createPageHeadlessCompletionFlightGate(),
        teardown: teardownForHeadlessMatchCompletion,
      })

      if (result.kind === 'completed' || result.kind === 'refresh-terminal') {
        match.value = result.match
      }
      if (result.kind === 'refresh-terminal') {
        neuralRefreshTerminalOpen.value = true
        logNnRecoveryTrace(result.modelId, 'terminal', {
          terminal: result.terminal,
          failureKind: result.failureKind ?? null,
        })
      } else if (result.kind === 'setup-terminal') {
        // applySetupTerminal already ran inside runHeadlessMatchCompletionForPage
      } else if (result.kind === 'failed' && debugMode.value) {
        console.warn(
          '[DungeonRunner][headless] completion failed',
          result.errorCode,
          result.actionCount,
        )
      }
    } finally {
      syncPresentationLabel()
    }
  }

  function onVorpalPickerCardTap(species) {
    selectedVorpalSpecies.value = applyVorpalPickerSpeciesTap({
      selectedSpecies: selectedVorpalSpecies.value,
      tappedSpecies: species,
      humanGameplayBlocked: humanGameplayBlocked.value,
    })
  }

  function confirmVorpalDeclaration() {
    const action = vorpalPickerView.value.confirmAction
    if (!action) return
    takeHumanAction(action)
  }

  async function runAiTurn() {
    const trace = aiTurnTrace()
    const seatId = match.value?.state?.turn?.activeSeatId ?? null
    const runToken = match.value
      ? buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state })
      : ''
    const gate = evaluatePageAiTurnPipelineGate({ runToken })
    if (!gate.mayRunTurn) {
      const presentationQueueSnapshot = presentationOrchestrator.getQueueSnapshot()
      const skipTrace = buildAiTurnRunSkipTrace(gate, {
        runToken,
        seatId,
        humanSeatId: humanSeatId.value,
        phase: match.value?.state?.phase ?? null,
        activePresentationKind: activePresentation.value?.kind ?? null,
        queueMs: presentationQueueSnapshot.reduce((sum, item) => sum + item.remainingMs, 0),
        lastAppliedAiTurnToken,
      })
      if (skipTrace) {
        trace(skipTrace.step, skipTrace.detail)
      }
      return
    }
    aiTurnInFlight = true
    try {
      trace('run.begin', {
        runToken,
        phase: match.value.state.phase,
        seatId,
        turnNumber: match.value.state.turn.turnNumber,
        biddingSubphase: match.value.state.bidding?.subphase ?? null,
        revealedMonsterCard: match.value.state.bidding?.revealedMonsterCard ?? null,
        dungeonSubphase: match.value.state.dungeon?.subphase ?? null,
      })
      const seat = match.value.state.seats.find((candidate) => candidate.id === seatId)
      const roleType = seat?.role?.type
      const chooseAction = createLivePlayActionChooser(
        buildLivePlayChooserDeps({
          tryConsumePrefetch: async ({ runToken: consumeRunToken }) => {
            const prefetchGate = evaluatePageAiTurnPipelineGate({
              runToken: consumeRunToken ?? runToken,
            })
            return consumeAiTurnPrefetch({
              runToken: consumeRunToken ?? runToken,
              mayPrefetch: prefetchGate.mayPrefetch,
              prefetchSkipReason: prefetchGate.prefetchSkipReason,
              trace: (step, detail) => trace(step, detail),
            })
          },
        }),
      )
      let action
      try {
        action = await chooseAction({ state: match.value.state, seatId, runToken })
      } catch (error) {
        if (handleNeuralRecoveryTerminalError(error)) {
          trace('run.abort', {
            reason: 'nn-recovery-terminal',
            terminal: error.terminal,
            modelId: error.modelId,
          })
          return
        }
        throw error
      }
      if (!action) {
        trace('run.abort', { reason: 'no-action' })
        return
      }
      if (!match.value) {
        trace('run.abort', { reason: 'match-cleared' })
        return
      }
      const currentToken = buildAiTurnRunToken({
        matchId: match.value.id,
        state: match.value.state,
      })
      if (runToken !== currentToken) {
        trace('run.abort', { reason: 'stale-token', runToken, currentToken })
        return
      }
      const prevState = match.value.state
      if (humanSeatId.value) {
        previousVisibleState.value = getPlayerView(prevState, { seatId: humanSeatId.value })
      }
      const result = applyAction(prevState, action, { seatId })
      if (!result.ok) {
        trace('run.abort', { reason: 'apply-failed', actionType: action.type })
        return
      }
      lastAppliedAiTurnToken = runToken
      const deferExit = shouldDeferDungeonExitUntilOutcomeAck(prevState, result.state)
      if (deferExit) {
        deferredPostDungeonState.value = result.state
        match.value = { ...match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
      } else {
        deferredPostDungeonState.value = null
        match.value = { ...match.value, state: result.state }
      }
      trace('run.applied', {
        actionType: action.type,
        nextRunToken: buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state }),
        phaseAfter: match.value.state.phase,
        turnAfterSeatId: match.value.state.turn.activeSeatId,
        deferExit,
      })
      enqueuePresentationTransition(
        prevState,
        result.state,
        action,
        seatId,
        roleType ?? 'randombot',
      )
      if (debugMode.value) {
        const snap = presentationOrchestrator.getQueueSnapshot()
        trace('presentation.enqueued', {
          queue: snap.map((item) => item.kind),
          queueMs: snap.reduce((sum, item) => sum + item.remainingMs, 0),
        })
      }
      primeAiTurnPrefetch()
    } finally {
      aiTurnInFlight = false
      trace('run.finally', { inFlight: false })
    }
  }

  function primeAiTurnPrefetch(precomputedGate = null) {
    const trace = aiTurnTrace()
    const state = match.value?.state
    const seatId = state?.turn?.activeSeatId ?? null
    const seat = state?.seats?.find((candidate) => candidate.id === seatId)
    const runToken = match.value ? buildAiTurnRunToken({ matchId: match.value.id, state }) : ''
    const modelId = seat?.role?.type === 'nn' ? (seat.role.modelId ?? 'latest') : null
    const gate = precomputedGate ?? evaluatePageAiTurnPipelineGate({ runToken })
    if (!gate.mayPrefetch) {
      const skipTrace = buildAiTurnPrefetchSkipTrace(gate, {
        seatId,
        phase: state?.phase ?? null,
        runToken,
        modelId,
        roleType: seat?.role?.type ?? null,
      })
      if (skipTrace) {
        logAiTurnPrimeSkip(skipTrace.reason, skipTrace.detail)
      }
      return
    }
    lastPrimeSkipTraceKey = ''
    startAiTurnPrefetch({
      runToken,
      mayPrefetch: true,
      prefetchSkipReason: null,
      trace: (step, detail) => trace(step, detail),
      compute: async () => {
        await ensureNnModelsReady()
        return chooseNnActionWithRecovery(state, { seatId }, nnRuntimeOptions(modelId))
      },
    })
  }

  function enqueuePresentationTransition(prevState, nextState, action, actorSeatId, actorRoleType) {
    const deferPostDungeonOutcomeAck = shouldDeferDungeonExitUntilOutcomeAck(prevState, nextState)
    presentationOrchestrator.enqueueEngineTransition(
      {
        phaseBefore: prevState.phase,
        phaseAfter: nextState.phase,
        turnBeforeSeatId: prevState.turn.activeSeatId,
        turnAfterSeatId: nextState.turn.activeSeatId,
        dungeonRunResult:
          prevState.lastDungeonRun?.result === nextState.lastDungeonRun?.result
            ? null
            : (nextState.lastDungeonRun?.result ?? null),
        action,
        actorSeatId,
        actorRoleType,
        centerEquipmentBefore: prevState.centerEquipment ?? [],
        centerEquipmentAfter: nextState.centerEquipment ?? [],
        heroBefore: prevState.hero,
        heroAfter: nextState.hero,
        dungeonBefore: summarizeDungeonForPresentation(prevState.dungeon),
        dungeonAfter: summarizeDungeonForPresentation(nextState.dungeon),
        biddingBefore:
          prevState.phase === MATCH_PHASES.BIDDING
            ? {
                revealedMonsterCard: prevState.bidding?.revealedMonsterCard ?? null,
                revealedBySeatId: prevState.bidding?.revealedBySeatId ?? null,
              }
            : null,
      },
      { deferPostDungeonOutcomeAck },
    )
    if (presentationTraceEnabled()) {
      const snap = presentationOrchestrator.getQueueSnapshot()
      console.log('[DungeonRunner][presentation] enqueue', {
        phase: `${prevState.phase}→${nextState.phase}`,
        action: action?.type ?? null,
        actorRole: actorRoleType,
        queue: snap.map((x) => x.kind),
      })
    }
    syncPresentationLabel()
  }

  function summarizeDungeonForPresentation(dungeonState) {
    if (!dungeonState) return null
    const discardedRunMonsterIds = Array.isArray(dungeonState.discardedRunMonsters)
      ? [...dungeonState.discardedRunMonsters]
      : []
    const rawDefeatRecord = dungeonState.lastDefeatRecord ?? null
    const lastDefeatRecord = rawDefeatRecord
      ? {
          monsterCard: rawDefeatRecord.monsterCard ?? null,
          byEquipmentIds: Array.isArray(rawDefeatRecord.byEquipmentIds)
            ? [...rawDefeatRecord.byEquipmentIds]
            : [],
          expendedEquipmentIds: Array.isArray(rawDefeatRecord.expendedEquipmentIds)
            ? [...rawDefeatRecord.expendedEquipmentIds]
            : [],
        }
      : null
    return {
      subphase: dungeonState.subphase ?? null,
      currentMonster: dungeonState.currentMonster ?? null,
      remainingMonsterCount: Array.isArray(dungeonState.remainingMonsters)
        ? dungeonState.remainingMonsters.length
        : 0,
      discardedMonsterCount: discardedRunMonsterIds.length,
      discardedRunMonsterIds,
      hp: Number.isFinite(dungeonState.hp) ? dungeonState.hp : null,
      lastDefeatRecord,
    }
  }

  function enrichPresentationForViewer(head) {
    if (!head) return null
    const kind = head.kind
    const basePayload = head.payload && typeof head.payload === 'object' ? { ...head.payload } : {}

    if (kind === 'BIDDING_DRAW') {
      const actorSeatId = basePayload.actorSeatId ?? null
      basePayload.shouldFlipFaceAfterArrival = viewerMaySeeBiddingDrawFace({
        viewerSeatId: humanSeatId.value,
        actorSeatId,
      })
      return { ...head, payload: basePayload }
    }
    if (kind === 'BIDDING_ADD') {
      basePayload.shouldFlipToBackBeforeDungeon = viewerMaySeeAddToDungeonFlipDown({
        viewerSeatId: humanSeatId.value,
        actorSeatId: basePayload.actorSeatId ?? null,
        actorRoleType: basePayload.actorRoleType ?? null,
      })
      return { ...head, payload: basePayload }
    }
    return head
  }

  function syncPresentationLabel() {
    activePresentation.value = enrichPresentationForViewer(
      presentationOrchestrator.getActiveAnimation(),
    )
    activePresentationLabel.value = activePresentation.value?.label ?? ''
    const locked = presentationOrchestrator.isGameplayInputLocked()
    gameplayInputLocked.value = locked
    if (presentationInputWasLocked && !locked) {
      lastScheduleSkipKey = ''
      lastPrimeSkipTraceKey = ''
      if (debugMode.value) {
        const snap = presentationOrchestrator.getQueueSnapshot()
        aiTurnTrace()('presentation.unlock', {
          queuedKinds: snap.map((item) => item.kind),
          isHumanTurn: isHumanTurn.value,
          activeSeatId: match.value?.state?.turn?.activeSeatId ?? null,
        })
      }
      if (liveMatchShellLifecycleActive) {
        scheduleAiTurnIfReady()
        scheduleHumanAutoResolveIfReady()
      }
    }
    presentationInputWasLocked = locked
    if (presentationTraceEnabled()) {
      const a = activePresentation.value
      const key = a ? `${a.id}:${a.kind}` : 'idle'
      if (key !== lastPresentationTraceKey) {
        lastPresentationTraceKey = key
        const snap = presentationOrchestrator.getQueueSnapshot()
        const d = match.value?.state?.dungeon
        console.log('[DungeonRunner][presentation] active', a?.kind ?? 'idle', {
          ms: a?.remainingMs ?? null,
          queued: snap.map((x) => x.kind),
          inputLocked: gameplayInputLocked.value,
          engineDungeonCurrentMonster: d?.currentMonster ?? null,
          engineDungeonSubphase: d?.subphase ?? null,
          viewMonsterVisibility: showDungeonStage.value
            ? dungeonStageView.value.monster.visibility
            : null,
          viewMonsterSpecies: showDungeonStage.value
            ? dungeonStageView.value.monster.species
            : null,
        })
      }
    }
  }

  function humanDungeonAutoRevealGapMs() {
    const pace = presentationSpeedProfile.value
    const profile = SPEED_PROFILES[pace] ?? SPEED_PROFILES.cinematic
    return Math.max(0, profile.dungeonContinueMs)
  }

  function scheduleAiTurnIfReady() {
    if (!liveMatchShellLifecycleActive) return
    if (!match.value || isHumanTurn.value) {
      return
    }
    const runToken = buildAiTurnRunToken({ matchId: match.value.id, state: match.value.state })
    const gate = evaluatePageAiTurnPipelineGate({ runToken, timerPending: !!aiTurnTimerId })
    if (!gate.maySchedule) {
      const skipTrace = buildAiTurnScheduleSkipTrace(gate, {
        runToken,
        phase: match.value?.state?.phase ?? null,
        activeSeatId: match.value?.state?.turn?.activeSeatId ?? null,
        presentationQueueSnapshot: presentationOrchestrator.getQueueSnapshot(),
      })
      if (skipTrace) {
        logAiTurnScheduleSkip(skipTrace.reason, skipTrace.detail)
      }
      if (gate.mayPrefetch) {
        primeAiTurnPrefetch(gate)
      }
      if (
        gate.scheduleSkipReason === 'model-recovering' ||
        gate.scheduleSkipReason === 'gameplay-locked'
      ) {
        if (aiTurnTimerId) {
          window.clearTimeout(aiTurnTimerId)
          aiTurnTimerId = null
        }
      }
      return
    }
    primeAiTurnPrefetch(gate)
    if (debugMode.value) {
      aiTurnTrace()('schedule.timer-armed', { runToken, delayMs: AI_TURN_SCHEDULE_DELAY_MS })
    }
    aiTurnTimerId = window.setTimeout(() => {
      aiTurnTimerId = null
      if (debugMode.value) aiTurnTrace()('schedule.timer-fired', { runToken })
      void runAiTurn()
    }, AI_TURN_SCHEDULE_DELAY_MS)
  }

  function scheduleHumanAutoResolveIfReady() {
    if (!liveMatchShellLifecycleActive) return
    if (!match.value) {
      return
    }
    if (humanGameplayBlocked.value) {
      return
    }
    if (!isHumanTurn.value) {
      return
    }
    if (match.value.state.phase !== 'dungeon') {
      return
    }
    if (equipmentModalOpen.value || autoResolveTimerId) {
      return
    }
    const action = dungeonResolutionView.value.autoAdvanceAction
    const gate = {
      phase: match.value.state.phase,
      gameplayInputLocked: gameplayInputLocked.value,
      isHumanTurn: isHumanTurn.value,
      legalActions: legalActions.value,
      autoAdvanceAction: action,
      resolutionStatus: dungeonResolutionView.value.resolutionStatus,
      activeAnimationKind: activePresentation.value?.kind ?? null,
    }
    if (!shouldAutoResolveDungeonAdvance(gate)) {
      return
    }
    autoResolveTimerId = window.setTimeout(() => {
      autoResolveTimerId = null
      const execGate = {
        phase: match.value?.state?.phase ?? null,
        gameplayInputLocked: gameplayInputLocked.value,
        isHumanTurn: isHumanTurn.value,
        equipmentModalOpen: equipmentModalOpen.value,
        autoAdvanceAction: action,
        legalActions: legalActions.value,
        resolutionStatus: dungeonResolutionView.value.resolutionStatus,
        activeAnimationKind: activePresentation.value?.kind ?? null,
      }
      const ok = shouldExecuteScheduledAutoResolve(execGate)
      if (!ok) return
      takeHumanAction(action)
    }, humanDungeonAutoRevealGapMs())
  }

  function nnRuntimeOptions(modelId) {
    if (!debugMode.value) return { modelId }
    return {
      modelId,
      pipelineTrace: true,
      debugTrace: true,
      debugLogger(trace) {
        const payload = {
          at: new Date().toISOString(),
          modelId,
          seatId: match.value?.state?.turn?.activeSeatId ?? null,
          trace,
        }
        nnDebugTraceHistory.value = [payload, ...nnDebugTraceHistory.value].slice(0, 20)
        nnDebugTraceText.value = JSON.stringify(payload, null, 2)
      },
    }
  }

  function actionLabel(action) {
    return legalActionBoardLabel(action)
  }

  function actionKey(action) {
    const id = [action.equipmentId, action.hero, action.species]
      .filter((x) => x != null && x !== '')
      .join('-')
    return id ? `${action.type}-${id}` : action.type
  }

  function biddingPostDrawActionPaneKey(item) {
    if (item.kind === 'engine') return actionKey(item.action)
    return item.kind
  }

  function skipActivePresentation() {
    presentationOrchestrator.skipActiveAnimation()
    syncPresentationLabel()
  }

  function bindRefTarget(refTarget) {
    return (componentOrEl) => {
      refTarget.value = componentOrEl ?? null
    }
  }

  const bindBoardShellRef = bindRefTarget(boardShellRef)
  const bindHeroCardSlotRef = bindRefTarget(heroCardSlotRef)
  const bindDungeonCardMotionWrapRef = bindRefTarget(dungeonCardMotionWrap)
  const bindDungeonCardFaceRef = bindRefTarget(dungeonCardFaceRef)
  const bindDeckBadgeRef = bindRefTarget(deckBadgeRef)
  const bindDungeonPileMotionAnchorRef = bindRefTarget(dungeonPileMotionAnchorRef)
  const bindHeroChangeInterstitialOverlayRef = bindRefTarget(heroChangeInterstitialOverlayRef)
  const bindPresentationFlightLayerRef = bindRefTarget(presentationFlightLayerRef)

  function mountLiveMatchShell() {
    if (liveMatchShellLifecycleActive) return
    liveMatchShellLifecycleActive = true
    presentationOrchestrator.setSpeedProfile(presentationSpeedProfile.value)
    const lifecycle = activateLiveMatchShellLifecycle({
      recovery: nnRecovery,
      onRecoveryChanged: onNnRecoveryChanged,
      presentationOrchestrator,
      tickCallbacks: {
        syncPresentationLabel,
        scheduleAiTurnIfReady: scheduleAiTurnOnPresentationTick,
        scheduleHumanAutoResolveIfReady,
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
    cancelAiTurnPrefetch()
    deactivateLiveMatchShellLifecycle({
      unsubscribe: unsubscribeNnRecovery,
      presentationTimerId,
      aiTurnTimerId,
      autoResolveTimerId,
      confirmationDialogResolve,
    })
    unsubscribeNnRecovery = null
    presentationTimerId = null
  }

  function exportReplay() {
    if (!match.value) return
    const payload = exportReplayEnvelope({
      seed: match.value.state.rng.seed,
      setup: match.value.setup,
      history: match.value.state.history,
      presentationSpeedProfile: match.value.presentationSpeedProfile,
    })
    replayExportText.value = JSON.stringify(payload, null, 2)
  }

  function importReplay() {
    if (!replayImportText.value.trim()) return
    try {
      const parsed = JSON.parse(replayImportText.value)
      const imported = importReplayEnvelope(parsed)
      if (!imported.ok) {
        deps.notify({ type: 'negative', message: 'Replay payload is invalid.' })
        return
      }
      const replayResult = buildStateFromReplayEnvelope(imported.replay)
      if (!replayResult.ok) {
        deps.notify({
          type: 'negative',
          message: 'Replay actions are invalid for this seed/setup.',
        })
        return
      }
      const pace =
        imported.replay.presentationSpeedProfile === 'brisk' ||
        imported.replay.presentationSpeedProfile === 'cinematic'
          ? imported.replay.presentationSpeedProfile
          : 'cinematic'
      dungeonRunnerSettingsStore.setAnimationPace(pace)
      match.value = {
        schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
        id: `match-${Date.now()}`,
        setup: imported.replay.setup,
        state: replayResult.state,
        history: [],
        presentationSpeedProfile: pace,
      }
      deferredPostDungeonState.value = null
      presentationSpeedProfile.value = pace
      presentationOrchestrator.setSpeedProfile(pace)
      presentationOrchestrator.clear()
      syncPresentationLabel()
    } catch {
      deps.notify({ type: 'negative', message: 'Replay payload must be valid JSON.' })
    }
  }

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
      showDungeonStage,
      dungeonStageView,
      biddingBoard,
      seatRunTrackerRows,
      monsterCardSlotEmpty,
      dungeonStageAnimationClass,
      uiAssets,
      boardEquipmentTokens,
      openEquipmentModal,
      onDeckTap,
      showActionPane,
      activePresentationLabel,
      isHumanTurn,
      showBiddingPostDrawActionPane,
      biddingPostDrawActionPane,
      biddingPostDrawActionPaneKey,
      enterSacrificeMode,
      cancelSacrificeMode,
      actionKey,
      actionLabel,
      humanGameplayBlocked,
      takeHumanAction,
      showHeroPickActionGrid,
      heroPickActionsOrdered,
      getAdventurerIdentity,
      visiblePrimaryActions,
      dungeonOutcomeTransitionControls,
      gameplayInputLocked,
      activePresentation,
      heroChangeInterstitialView,
      heroChangeInterstitialAriaLabel,
      skipActivePresentation,
      headlessCompletionInFlight,
      biddingStageSpecies,
      biddingStageFaceDown,
    },
    dialogs: {
      dungeonOutcomeDialogOpen,
      dungeonOutcomeSummary,
      dungeonOutcomeToneClass,
      dungeonOutcomeMessage,
      continueFromDungeonOutcome,
      equipmentModalOpen,
      selectedEquipmentModalView,
      equipmentModalActionsDisabled,
      takeEquipmentUseAction,
      takeEquipmentSacrificeAction,
      continueFromEquipmentModal,
      confirmationDialogOpen,
      confirmationDialogTitle,
      confirmationDialogMessage,
      confirmationDialogOkLabel,
      confirmationDialogCancelLabel,
      onConfirmationDialogCancel,
      onConfirmationDialogOk,
      neuralRefreshTerminalOpen,
      reloadPageForNeuralRefreshTerminal,
      vorpalPickerView,
      onVorpalPickerCardTap,
      confirmVorpalDeclaration,
      deckSplayOpen,
      onCloseDeckSplay,
    },
    debug: {
      debugMode,
      nnDebugTraceHistory,
      nnDebugTraceText,
      exportReplay,
      importReplay,
      replayExportText,
      replayImportText,
    },
    page: {
      mountLiveMatchShell,
      unmountLiveMatchShell,
      applyBootstrappedMatchSession,
      processBootstrappedSession,
      kickMatchAutomation,
      maybeRunHeadlessMatchCompletion,
      resetForSetupTerminal,
      resetForFreshMatchEntry,
      resetForBackToSetup,
      matchPageOrchestrationCtx,
      runLivePageMatchEntryGate,
      requestConfirmation,
      buildNewMatchEnvelope,
    },
  })
}
