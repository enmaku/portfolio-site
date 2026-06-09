import { computed, ref, watch } from 'vue'
import {
  createDungeonEquipmentModalView,
} from '../dungeonEquipmentInteractions.js'
import {
  createBiddingSacrificeEquipmentModalView,
  shouldUseBiddingSacrificeEquipmentModalView,
} from '../biddingSacrificeInteractions.js'
import {
  buildDungeonOutcomeSummary,
  dismissDungeonRunForOutcomeDialog,
  isDungeonOutcomeDialogOpen,
  resolveDungeonOutcomeMessage,
  resolveLastDungeonRunWatcherUpdate,
  shouldShowDungeonOutcomeDialog,
} from '../dungeonOutcomeDialog.js'
import {
  canContinueFromDungeonOutcome,
  shouldAutoContinueDeferredDungeonExit,
} from '../headlessMatchCompletionRunner.js'
import {
  isEquipmentModalActionsDisabled,
  isHumanGameplayBlocked,
} from '../humanGameplayGate.js'
import { closeDeckSplay, tapDeck } from '../memoryAidState.js'

/**
 * Mid-match dialog surface for live match shell: outcome ack, equipment modal,
 * confirmation, REFRESH terminal, deck splay, finishing-match overlay state.
 *
 * @param {{
 *   match: import('vue').Ref<object | null>
 *   gameplayInputLocked: import('vue').Ref<boolean>
 *   isHumanTurn: import('vue').ComputedRef<boolean>
 *   sacrificeModeActive: import('vue').Ref<boolean>
 *   legalActions: import('vue').ComputedRef<Array<object>>
 *   visibleState: import('vue').ComputedRef<object | null>
 *   humanSeatId: import('vue').ComputedRef<string | null>
 *   memoryAidState: import('vue').Ref<{ enabled: boolean, deckSplayOpen: boolean }>
 *   deferredPostDungeonState: import('vue').Ref<object | null>
 *   presentationOrchestrator: { flushPostDungeonOutcomeAnimations: () => void }
 *   syncPresentationLabel: () => void
 *   maybeRunHeadlessMatchCompletion: () => Promise<void>
 *   takeHumanAction: (action: object) => void
 *   vorpalPickerView: import('vue').ComputedRef<object>
 *   onVorpalPickerCardTap: (species: string) => void
 *   confirmVorpalDeclaration: (action: object | null | undefined) => void
 *   reloadPage?: () => void
 * }} deps
 */
export function createLiveMatchShellMidMatchDialogSurface(deps) {
  const equipmentModalOpen = ref(false)
  const selectedEquipmentTokenId = ref(null)
  const neuralRefreshTerminalOpen = ref(false)
  const confirmationDialogOpen = ref(false)
  const confirmationDialogTitle = ref('Confirm')
  const confirmationDialogMessage = ref('')
  const confirmationDialogOkLabel = ref('OK')
  const confirmationDialogCancelLabel = ref('Cancel')
  /** @type {((value: boolean) => void) | null} */
  let confirmationDialogResolve = null
  const dismissedDungeonRun = ref(null)
  const equipmentRemainingAtResolution = ref(null)
  const headlessCompletionInFlight = ref(false)

  const dungeonOutcomeAckPending = computed(() =>
    isDungeonOutcomeDialogOpen({
      lastDungeonRun: deps.match.value?.state?.lastDungeonRun ?? null,
      dismissedDungeonRun: dismissedDungeonRun.value,
    }),
  )

  const dungeonOutcomeSummary = computed(() =>
    buildDungeonOutcomeSummary({
      lastDungeonRun: deps.match.value?.state?.lastDungeonRun ?? null,
      seats: deps.match.value?.state?.seats ?? [],
      equipmentRemainingAtResolution: equipmentRemainingAtResolution.value,
    }),
  )

  const dungeonOutcomeToneClass = computed(() =>
    dungeonOutcomeSummary.value?.resultLabel === 'Success'
      ? 'dr-outcome--success'
      : 'dr-outcome--failure',
  )

  const dungeonOutcomeMessage = computed(() =>
    resolveDungeonOutcomeMessage(deps.match.value?.state?.lastDungeonRun ?? null),
  )

  const dungeonOutcomeDialogOpen = computed({
    get() {
      return shouldShowDungeonOutcomeDialog({
        headlessCompletionInFlight: headlessCompletionInFlight.value,
        gameplayInputLocked: deps.gameplayInputLocked.value,
        lastDungeonRun: deps.match.value?.state?.lastDungeonRun ?? null,
        dismissedDungeonRun: dismissedDungeonRun.value,
      })
    },
    set(open) {
      if (open) return
      void continueFromDungeonOutcome()
    },
  })

  const humanGameplayBlocked = computed(() =>
    isHumanGameplayBlocked({
      gameplayInputLocked: deps.gameplayInputLocked.value,
      dungeonOutcomeDialogOpen: dungeonOutcomeDialogOpen.value,
      headlessCompletionInFlight: headlessCompletionInFlight.value,
      neuralRefreshTerminalOpen: neuralRefreshTerminalOpen.value,
    }),
  )

  const equipmentModalActionsDisabled = computed(() =>
    isEquipmentModalActionsDisabled({
      humanGameplayBlocked: humanGameplayBlocked.value,
      isHumanTurn: deps.isHumanTurn.value,
    }),
  )

  const selectedEquipmentModalView = computed(() => {
    if (!selectedEquipmentTokenId.value) return null
    const phase = deps.match.value?.state?.phase ?? null
    if (
      shouldUseBiddingSacrificeEquipmentModalView({
        phase,
        sacrificeModeActive: deps.sacrificeModeActive.value,
      })
    ) {
      return createBiddingSacrificeEquipmentModalView({
        equipmentId: selectedEquipmentTokenId.value,
        legalActions: deps.legalActions.value,
        sacrificeModeActive: deps.sacrificeModeActive.value,
      })
    }
    return createDungeonEquipmentModalView({
      equipmentId: selectedEquipmentTokenId.value,
      legalActions: deps.legalActions.value,
    })
  })

  const deckSplayOpen = computed({
    get() {
      return deps.memoryAidState.value.deckSplayOpen
    },
    set(open) {
      deps.memoryAidState.value = open
        ? tapDeck(deps.memoryAidState.value)
        : closeDeckSplay(deps.memoryAidState.value)
    },
  })

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

  function openNeuralRefreshTerminal() {
    neuralRefreshTerminalOpen.value = true
  }

  function reloadPageForNeuralRefreshTerminal() {
    const reload = deps.reloadPage ?? (() => window.location.reload())
    reload()
  }

  function closeEquipmentModalIfOpen() {
    if (equipmentModalOpen.value) equipmentModalOpen.value = false
  }

  function closeEquipmentModal() {
    equipmentModalOpen.value = false
  }

  function showEquipmentModal(equipmentId) {
    selectedEquipmentTokenId.value = equipmentId
    equipmentModalOpen.value = true
  }

  function takeEquipmentSacrificeAction() {
    if (equipmentModalActionsDisabled.value || !selectedEquipmentModalView.value?.sacrificeAction) {
      return
    }
    deps.takeHumanAction(selectedEquipmentModalView.value.sacrificeAction)
  }

  function takeEquipmentUseAction() {
    if (equipmentModalActionsDisabled.value || !selectedEquipmentModalView.value?.useAction) return
    deps.takeHumanAction(selectedEquipmentModalView.value.useAction)
  }

  function continueFromEquipmentModal() {
    if (!equipmentModalActionsDisabled.value && selectedEquipmentModalView.value?.continueAction) {
      deps.takeHumanAction(selectedEquipmentModalView.value.continueAction)
      return
    }
    equipmentModalOpen.value = false
  }

  async function continueFromDungeonOutcome() {
    const run = deps.match.value?.state?.lastDungeonRun
    if (
      !canContinueFromDungeonOutcome({
        lastDungeonRun: run,
        deferredPostDungeonState: deps.deferredPostDungeonState.value,
      })
    ) {
      return
    }
    if (run) {
      dismissedDungeonRun.value = dismissDungeonRunForOutcomeDialog(run)
    }
    if (deps.deferredPostDungeonState.value) {
      deps.match.value = { ...deps.match.value, state: deps.deferredPostDungeonState.value }
      deps.deferredPostDungeonState.value = null
    }
    deps.presentationOrchestrator.flushPostDungeonOutcomeAnimations()
    deps.syncPresentationLabel()
    await deps.maybeRunHeadlessMatchCompletion()
  }

  function onCloseDeckSplay() {
    deps.memoryAidState.value = closeDeckSplay(deps.memoryAidState.value)
  }

  function syncLastDungeonRun(lastDungeonRun, centerEquipment) {
    const update = resolveLastDungeonRunWatcherUpdate(lastDungeonRun, centerEquipment)
    if ('dismissedDungeonRun' in update) {
      dismissedDungeonRun.value = update.dismissedDungeonRun
      equipmentRemainingAtResolution.value = update.equipmentRemainingAtResolution
      return
    }
    equipmentRemainingAtResolution.value = update.equipmentRemainingAtResolution
  }

  function ackDungeonRunForTeardown(run) {
    if (run) dismissedDungeonRun.value = run
  }

  function createHeadlessCompletionFlightGate() {
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

  function getConfirmationDialogResolve() {
    return confirmationDialogResolve
  }

  function autoContinueDeferredDungeonExitIfReady() {
    if (
      shouldAutoContinueDeferredDungeonExit({
        deferredPostDungeonState: deps.deferredPostDungeonState.value,
        lastDungeonRun: deps.match.value?.state?.lastDungeonRun ?? null,
        dismissedDungeonRun: dismissedDungeonRun.value,
      })
    ) {
      void continueFromDungeonOutcome()
    }
  }

  watch(
    () => deps.match.value?.state?.lastDungeonRun ?? null,
    (run) => {
      syncLastDungeonRun(run, deps.match.value?.state?.centerEquipment)
    },
    { immediate: true },
  )

  const dialogs = {
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
    vorpalPickerView: deps.vorpalPickerView,
    onVorpalPickerCardTap: deps.onVorpalPickerCardTap,
    confirmVorpalDeclaration: () =>
      deps.confirmVorpalDeclaration(deps.vorpalPickerView.value.confirmAction),
    deckSplayOpen,
    onCloseDeckSplay,
  }

  return {
    dialogs,
    dungeonOutcomeAckPending,
    humanGameplayBlocked,
    headlessCompletionInFlight,
    neuralRefreshTerminalOpen,
    dismissedDungeonRun,
    equipmentRemainingAtResolution,
    equipmentModalOpen,
    requestConfirmation,
    openNeuralRefreshTerminal,
    showEquipmentModal,
    closeEquipmentModal,
    closeEquipmentModalIfOpen,
    syncLastDungeonRun,
    ackDungeonRunForTeardown,
    createHeadlessCompletionFlightGate,
    getConfirmationDialogResolve,
    autoContinueDeferredDungeonExitIfReady,
  }
}
