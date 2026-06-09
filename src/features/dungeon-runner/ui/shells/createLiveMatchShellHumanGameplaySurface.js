import { computed, ref, watch } from 'vue'
import { MATCH_PHASES, applyAction, getLegalActions, getPlayerView } from '../../engine/kernel.js'
import { persistCurrentMatch as defaultPersistCurrentMatch } from '../../persistence/currentMatch.js'
import { dungeonRunnerAssetPack, dungeonRunnerEquipmentSymbolRuntimePath } from '../assetPack.js'
import { equipmentTokenAppearance } from '../../equipmentTokenAppearance.js'
import {
  equipmentShortName,
  getAdventurerIdentity,
  getAdventurerTypeChipLabel,
} from '../../data/gameDataCatalog.js'
import { adventurerChoiceHeadline, legalActionBoardLabel } from '../dungeonRunnerPlayerPhrasing.js'
import {
  buildDungeonEquipmentTokenView,
  filterVisibleLegalActions,
} from '../dungeonEquipmentInteractions.js'
import {
  buildBiddingPostDrawActionPane,
  canEnterBiddingSacrificeMode,
  isBiddingPostDrawContext,
  isSacrificeTargetEquipmentToken,
  legalSacrificeEquipmentIds,
} from '../biddingSacrificeInteractions.js'
import { createBiddingBoardViewModel } from '../biddingBoardViewModel.js'
import { createDungeonResolutionViewModel } from '../dungeonResolutionViewModel.js'
import {
  buildDungeonOutcomeTransitionControls,
  shouldExecuteScheduledAutoResolve,
  shouldAutoResolveDungeonAdvance,
} from '../dungeonResolutionFlow.js'
import { isDungeonOrchestratorPresentationKind } from '../orchestratorPresentationKinds.js'
import { createMemoryAidState, setMemoryAidEnabled, tapDeck } from '../memoryAidState.js'
import { resetAiTurnPrefetch } from '../dungeonRunnerAiTurnPrefetch.js'
import { shouldDeferDungeonExitUntilOutcomeAck } from '../headlessMatchCompletionRunner.js'
import {
  applyVorpalPickerSpeciesTap,
  createVorpalDeclarationPickerView,
} from '../vorpalDeclarationPickerInteractions.js'
import { shouldRejectEquipmentTokenTap } from '../humanGameplayGate.js'

/** Matches engine pick-adventurer legal action order. */
const HERO_CHOICE_ACTION_ORDER = ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']

/**
 * Human gameplay surface for live match shell: board view models, legal action
 * handlers, sacrifice mode, deck tap, memory aid, and vorpal picker action wiring.
 *
 * @param {{
 *   match: import('vue').Ref<object | null>
 *   dungeonRunnerSettingsStore: { memoryAidEnabled: boolean }
 *   gameplayInputLocked: import('vue').Ref<boolean>
 *   activePresentation: import('vue').Ref<object | null>
 *   activePresentationLabel: import('vue').Ref<string>
 *   previousVisibleState: import('vue').Ref<object | null>
 *   deferredPostDungeonState: import('vue').Ref<object | null>
 *   seatRecoveryIndicators: import('vue').Ref<Array<object>>
 *   getHumanGameplayBlocked: () => boolean
 *   getDungeonOutcomeAckPending: () => boolean
 *   closeEquipmentModalIfOpen: () => void
 *   closeEquipmentModal: () => void
 *   showEquipmentModal: (equipmentId: string) => void
 *   enqueuePresentationTransition: (
 *     prevState: object,
 *     nextState: object,
 *     action: object,
 *     seatId: string,
 *     roleType: string,
 *   ) => void
 *   isLifecycleActive: () => boolean
 *   getEquipmentModalOpen: () => boolean
 *   humanDungeonAutoRevealGapMs: () => number
 *   storage?: Storage
 *   persistCurrentMatch?: typeof defaultPersistCurrentMatch
 *   resetAiTurnPrefetch?: typeof resetAiTurnPrefetch
 *   shouldDeferDungeonExitUntilOutcomeAck?: typeof shouldDeferDungeonExitUntilOutcomeAck
 * }} deps
 */
export function createLiveMatchShellHumanGameplaySurface(deps) {
  const storage = deps.storage ?? window.localStorage
  const persistCurrentMatch = deps.persistCurrentMatch ?? defaultPersistCurrentMatch
  const clearAiTurnPrefetch = deps.resetAiTurnPrefetch ?? resetAiTurnPrefetch
  const deferDungeonExitUntilOutcomeAck =
    deps.shouldDeferDungeonExitUntilOutcomeAck ?? shouldDeferDungeonExitUntilOutcomeAck

  const memoryAidState = ref(
    createMemoryAidState({ enabled: deps.dungeonRunnerSettingsStore.memoryAidEnabled }),
  )
  const sacrificeModeActive = ref(false)
  const selectedVorpalSpecies = ref(null)
  /** @type {ReturnType<typeof globalThis.setTimeout> | null} */
  let autoResolveTimerId = null
  const setTimeoutFn = deps.setTimeout ?? globalThis.setTimeout.bind(globalThis)
  const clearTimeoutFn = deps.clearTimeout ?? globalThis.clearTimeout.bind(globalThis)

  watch(
    () => deps.dungeonRunnerSettingsStore.memoryAidEnabled,
    (enabled) => {
      memoryAidState.value = setMemoryAidEnabled(memoryAidState.value, enabled)
    },
    { immediate: true },
  )

  const humanSeatId = computed(
    () => deps.match.value?.state.seats.find((seat) => seat.role.type === 'human')?.id ?? null,
  )
  const isHumanTurn = computed(
    () =>
      !!deps.match.value &&
      humanSeatId.value != null &&
      deps.match.value.state.turn.activeSeatId === humanSeatId.value,
  )
  const humanBiddingRevealedMonsterCard = computed(() => {
    if (!isHumanTurn.value || !deps.match.value) return null
    return deps.match.value.state.bidding?.revealedMonsterCard ?? null
  })
  const legalActions = computed(() => {
    if (!deps.match.value || !isHumanTurn.value) return []
    return getLegalActions(deps.match.value.state, { seatId: humanSeatId.value })
  })
  const isHumanBiddingPostDrawContext = computed(() =>
    isBiddingPostDrawContext({
      phase: deps.match.value?.state?.phase ?? null,
      revealedMonsterCard: humanBiddingRevealedMonsterCard.value,
      legalActions: legalActions.value,
    }),
  )
  const visibleLegalActions = computed(() =>
    filterVisibleLegalActions({
      phase: deps.match.value?.state?.phase ?? null,
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
  const visibleState = computed(() => {
    if (!deps.match.value || !humanSeatId.value) return null
    return getPlayerView(deps.match.value.state, { seatId: humanSeatId.value })
  })

  const dungeonEquipmentTokens = computed(() =>
    buildDungeonEquipmentTokenView({
      inPlayEquipmentIds: visibleState.value?.dungeon?.inPlayEquipmentIds ?? [],
      legalActions: legalActions.value,
    }),
  )
  const dungeonResolutionView = computed(() =>
    createDungeonResolutionViewModel({
      visibleState: visibleState.value ?? {},
      previousVisibleState: deps.previousVisibleState.value ?? {},
      legalActions: legalActions.value,
      activeAnimation: deps.activePresentation.value,
    }),
  )
  const showDungeonStage = computed(() => {
    if (deps.match.value?.state?.phase === 'dungeon') return true
    if (isDungeonOrchestratorPresentationKind(deps.activePresentation.value?.kind ?? null)) {
      return true
    }
    return deps.getDungeonOutcomeAckPending()
  })
  const dungeonStageView = computed(() =>
    createDungeonResolutionViewModel({
      visibleState: visibleState.value ?? {},
      previousVisibleState: deps.previousVisibleState.value ?? {},
      legalActions: legalActions.value,
      activeAnimation: deps.activePresentation.value,
      preserveMonsterCardUntilRunAck: deps.getDungeonOutcomeAckPending(),
    }),
  )
  const dungeonOutcomeTransitionControls = computed(() =>
    buildDungeonOutcomeTransitionControls({
      phase: deps.match.value?.state?.phase ?? null,
      gameplayInputLocked: deps.gameplayInputLocked.value,
      resolutionStatus: dungeonResolutionView.value.resolutionStatus,
      autoAdvanceAction: dungeonResolutionView.value.autoAdvanceAction,
    }),
  )
  const actionableEquipmentIds = computed(
    () => new Set(dungeonResolutionView.value.highlightedEquipmentIds),
  )
  const biddingBoard = computed(() =>
    createBiddingBoardViewModel({
      state: deps.match.value?.state ?? null,
      visibleState: visibleState.value,
      activeAnimation: deps.activePresentation.value,
      viewerSeatId: humanSeatId.value,
      settings: {
        memoryAidEnabled: memoryAidState.value.enabled,
      },
    }),
  )
  const boardEquipmentTokens = computed(() => {
    const dungeonTokenById = new Map(
      dungeonEquipmentTokens.value.map((token) => [token.equipmentId, token]),
    )
    const isDungeonPhase = deps.match.value?.state?.phase === 'dungeon'
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
  const seatRunTrackerRows = computed(() => {
    const recoveryBySeatId = new Map(
      deps.seatRecoveryIndicators.value.map((entry) => [entry.seatId, entry]),
    )
    return biddingBoard.value.secondary.seats.map((row) => {
      const scoreboard = deps.match.value?.state?.scoreboard ?? {}
      const score = scoreboard[row.seatId] ?? {}
      const successes = Math.max(0, Number(score.successes ?? 0))
      const failures = Math.max(0, 2 - Number(score.lives ?? 2))
      const eliminated = !!score.eliminated
      const recovery = recoveryBySeatId.get(row.seatId)
      return {
        seatId: row.seatId,
        label: row.label,
        passed: row.passed,
        isActive: row.isActive,
        eliminated,
        successes,
        failures,
        recovering: recovery?.recovering ?? false,
        recoveryTestId: recovery?.testId ?? null,
        ariaLabel: eliminated
          ? `${row.label}: eliminated from competition`
          : `${row.label}: ${successes} successful run${successes === 1 ? '' : 's'}, ${failures} failed run${failures === 1 ? '' : 's'}`,
      }
    })
  })
  const biddingCardEmpty = computed(
    () =>
      deps.match.value?.state?.phase === 'bidding' &&
      !showDungeonStage.value &&
      biddingBoard.value.primaryCard.variant === 'empty',
  )
  const monsterCardSlotEmpty = computed(() => {
    if (showDungeonStage.value) return dungeonStageView.value.monster.visibility === 'empty'
    return biddingCardEmpty.value
  })
  const biddingStageSpecies = computed(() => {
    if (showDungeonStage.value) return null
    if (deps.match.value?.state?.phase !== 'bidding') return null
    if (deps.activePresentation.value?.kind === 'BIDDING_DRAW') return null
    return biddingBoard.value.primaryCard.variant === 'revealed'
      ? biddingBoard.value.primaryCard.monsterCard
      : null
  })
  const biddingStageFaceDown = computed(() => {
    if (showDungeonStage.value) return true
    if (deps.match.value?.state?.phase !== 'bidding') return true
    if (deps.activePresentation.value?.kind === 'BIDDING_DRAW') return true
    return biddingBoard.value.primaryCard.variant !== 'revealed'
  })
  const heroChangeInterstitialView = computed(() => {
    if (deps.activePresentation.value?.kind !== 'HERO_CHANGE_INTERSTITIAL') return null
    const payload = deps.activePresentation.value?.payload
    if (!payload?.heroAfter) return null
    const seats = deps.match.value?.state?.seats ?? []
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
  const showBiddingPostDrawActionPane = isHumanBiddingPostDrawContext
  const biddingPostDrawActionPane = computed(() =>
    buildBiddingPostDrawActionPane({
      sacrificeModeActive: sacrificeModeActive.value,
      phase: deps.match.value?.state?.phase ?? null,
      revealedMonsterCard: humanBiddingRevealedMonsterCard.value,
      legalActions: legalActions.value,
      humanGameplayBlocked: deps.getHumanGameplayBlocked(),
    }),
  )
  const showActionPane = computed(
    () =>
      !!deps.activePresentationLabel.value ||
      (isHumanTurn.value &&
        (visiblePrimaryActions.value.length > 0 ||
          biddingPostDrawActionPane.value.length > 0 ||
          dungeonOutcomeTransitionControls.value.length > 0)),
  )

  watch(isHumanBiddingPostDrawContext, (active) => {
    if (!active) sacrificeModeActive.value = false
  })

  const vorpalPickerView = computed(() =>
    createVorpalDeclarationPickerView({
      isHumanTurn: isHumanTurn.value,
      gameplayInputLocked: deps.gameplayInputLocked.value,
      phase: deps.match.value?.state?.phase ?? null,
      subphase: deps.match.value?.state?.dungeon?.subphase ?? null,
      legalActions: legalActions.value,
      memoryAidEnabled: memoryAidState.value.enabled,
      viewerOwnPileAdds:
        visibleState.value?.playerOwnPileAdds?.[humanSeatId.value ?? ''] ?? [],
      selectedSpecies: selectedVorpalSpecies.value,
      humanGameplayBlocked: deps.getHumanGameplayBlocked(),
    }),
  )

  watch(
    () => vorpalPickerView.value.open,
    () => {
      resetVorpalPickerSelection()
    },
  )

  function clearAutoResolveTimer() {
    if (autoResolveTimerId) {
      clearTimeoutFn(autoResolveTimerId)
      autoResolveTimerId = null
    }
  }

  function scheduleHumanAutoResolveIfReady() {
    if (!deps.isLifecycleActive()) return
    if (!deps.match.value) {
      return
    }
    if (deps.getHumanGameplayBlocked()) {
      return
    }
    if (!isHumanTurn.value) {
      return
    }
    if (deps.match.value.state.phase !== 'dungeon') {
      return
    }
    if (deps.getEquipmentModalOpen() || autoResolveTimerId) {
      return
    }
    const action = dungeonResolutionView.value.autoAdvanceAction
    const gate = {
      phase: deps.match.value.state.phase,
      gameplayInputLocked: deps.gameplayInputLocked.value,
      isHumanTurn: isHumanTurn.value,
      legalActions: legalActions.value,
      autoAdvanceAction: action,
      resolutionStatus: dungeonResolutionView.value.resolutionStatus,
      activeAnimationKind: deps.activePresentation.value?.kind ?? null,
    }
    if (!shouldAutoResolveDungeonAdvance(gate)) {
      return
    }
    autoResolveTimerId = setTimeoutFn(() => {
      autoResolveTimerId = null
      const execGate = {
        phase: deps.match.value?.state?.phase ?? null,
        gameplayInputLocked: deps.gameplayInputLocked.value,
        isHumanTurn: isHumanTurn.value,
        equipmentModalOpen: deps.getEquipmentModalOpen(),
        autoAdvanceAction: action,
        legalActions: legalActions.value,
        resolutionStatus: dungeonResolutionView.value.resolutionStatus,
        activeAnimationKind: deps.activePresentation.value?.kind ?? null,
      }
      if (!shouldExecuteScheduledAutoResolve(execGate)) {
        return
      }
      takeHumanAction(action)
    }, deps.humanDungeonAutoRevealGapMs())
  }

  function takeHumanAction(action) {
    if (!deps.match.value || !humanSeatId.value) {
      return
    }
    clearAiTurnPrefetch()
    if (deps.getHumanGameplayBlocked()) {
      return
    }
    clearAutoResolveTimer()
    deps.closeEquipmentModalIfOpen()
    if (action.type === 'SACRIFICE') sacrificeModeActive.value = false
    const prevState = deps.match.value.state
    deps.previousVisibleState.value = getPlayerView(prevState, { seatId: humanSeatId.value })
    const result = applyAction(prevState, action, { seatId: humanSeatId.value })
    if (!result.ok) {
      return
    }
    const deferExit = deferDungeonExitUntilOutcomeAck(prevState, result.state)
    if (deferExit) {
      deps.deferredPostDungeonState.value = result.state
      deps.match.value = { ...deps.match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
    } else {
      deps.deferredPostDungeonState.value = null
      deps.match.value = { ...deps.match.value, state: result.state }
    }
    persistCurrentMatch(storage, deps.match.value)
    deps.enqueuePresentationTransition(prevState, result.state, action, humanSeatId.value, 'human')
  }

  function onDeckTap() {
    memoryAidState.value = tapDeck(memoryAidState.value)
  }

  function enterSacrificeMode() {
    if (
      !canEnterBiddingSacrificeMode({
        isHumanTurn: isHumanTurn.value,
        phase: deps.match.value?.state?.phase ?? null,
        revealedMonsterCard: humanBiddingRevealedMonsterCard.value,
        legalActions: legalActions.value,
        humanGameplayBlocked: deps.getHumanGameplayBlocked(),
      })
    ) {
      return
    }
    sacrificeModeActive.value = true
  }

  function cancelSacrificeMode() {
    sacrificeModeActive.value = false
    deps.closeEquipmentModal()
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

  function onVorpalPickerCardTap(species) {
    selectedVorpalSpecies.value = applyVorpalPickerSpeciesTap({
      selectedSpecies: selectedVorpalSpecies.value,
      tappedSpecies: species,
      humanGameplayBlocked: deps.getHumanGameplayBlocked(),
    })
  }

  function confirmVorpalDeclaration(confirmAction) {
    if (!confirmAction) return
    takeHumanAction(confirmAction)
  }

  function resetVorpalPickerSelection() {
    selectedVorpalSpecies.value = null
  }

  function onEquipmentTokenTap(token) {
    if (
      shouldRejectEquipmentTokenTap({
        hasModal: token?.hasModal,
        humanGameplayBlocked: deps.getHumanGameplayBlocked(),
      })
    ) {
      return
    }
    deps.showEquipmentModal(token.equipmentId)
  }

  const board = {
    showDungeonStage,
    dungeonStageView,
    biddingBoard,
    seatRunTrackerRows,
    monsterCardSlotEmpty,
    boardEquipmentTokens,
    openEquipmentModal: onEquipmentTokenTap,
    onDeckTap,
    showActionPane,
    isHumanTurn,
    showBiddingPostDrawActionPane,
    biddingPostDrawActionPane,
    biddingPostDrawActionPaneKey,
    enterSacrificeMode,
    cancelSacrificeMode,
    actionKey,
    actionLabel,
    takeHumanAction,
    showHeroPickActionGrid,
    heroPickActionsOrdered,
    getAdventurerIdentity,
    getAdventurerTypeChipLabel,
    visiblePrimaryActions,
    dungeonOutcomeTransitionControls,
    heroChangeInterstitialView,
    heroChangeInterstitialAriaLabel,
    biddingStageSpecies,
    biddingStageFaceDown,
    uiAssets: dungeonRunnerAssetPack,
  }

  return {
    memoryAidState,
    sacrificeModeActive,
    humanSeatId,
    isHumanTurn,
    legalActions,
    visibleState,
    dungeonResolutionView,
    takeHumanAction,
    onDeckTap,
    onEquipmentTokenTap,
    enterSacrificeMode,
    cancelSacrificeMode,
    actionKey,
    actionLabel,
    biddingPostDrawActionPaneKey,
    selectedVorpalSpecies,
    vorpalPickerView,
    onVorpalPickerCardTap,
    confirmVorpalDeclaration,
    resetVorpalPickerSelection,
    scheduleHumanAutoResolveIfReady,
    clearAutoResolveTimer,
    getAutoResolveTimerId: () => autoResolveTimerId,
    board,
  }
}
