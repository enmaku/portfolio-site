import { computed, ref } from 'vue'
import { createNeuralRuntimeRecoveryCoordinator } from '../../nn/recovery.js'
import { createDefaultSetupConfig } from '../../setup/config.js'
import { LIVE_MATCH_SHELL_SESSION_GROUPS as LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS } from './liveMatchShellSessionGroups.js'

export { LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS }

export const LIVE_MATCH_SHELL_SESSION_GROUPS = LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS

export const EXPECTED_BOARD_KEYS = [
  'match',
  'boardShellRef',
  'heroCardSlotRef',
  'dungeonCardMotionWrap',
  'dungeonCardFaceRef',
  'deckBadgeRef',
  'dungeonPileMotionAnchorRef',
  'heroChangeInterstitialOverlayRef',
  'presentationFlightLayerRef',
  'bindBoardShellRef',
  'bindHeroCardSlotRef',
  'bindDungeonCardMotionWrapRef',
  'bindDungeonCardFaceRef',
  'bindDeckBadgeRef',
  'bindDungeonPileMotionAnchorRef',
  'bindHeroChangeInterstitialOverlayRef',
  'bindPresentationFlightLayerRef',
  'bindBiddingEquipmentBadgeRef',
  'dungeonStageAnimationClass',
  'activePresentationLabel',
  'gameplayInputLocked',
  'activePresentation',
  'skipActivePresentation',
  'humanGameplayBlocked',
  'headlessCompletionInFlight',
  'showDungeonStage',
  'dungeonStageView',
  'biddingBoard',
  'seatRunTrackerRows',
  'monsterCardSlotEmpty',
  'boardEquipmentTokens',
  'openEquipmentModal',
  'onDeckTap',
  'showActionPane',
  'isHumanTurn',
  'showBiddingPostDrawActionPane',
  'biddingPostDrawActionPane',
  'biddingPostDrawActionPaneKey',
  'enterSacrificeMode',
  'cancelSacrificeMode',
  'actionKey',
  'actionLabel',
  'takeHumanAction',
  'showHeroPickActionGrid',
  'heroPickActionsOrdered',
  'visiblePrimaryActions',
  'dungeonOutcomeTransitionControls',
  'heroChangeInterstitialView',
  'heroChangeInterstitialAriaLabel',
  'biddingStageSpecies',
  'biddingStageFaceDown',
  'getAdventurerIdentity',
  'getAdventurerTypeChipLabel',
  'uiAssets',
]

export const EXPECTED_DIALOG_KEYS = [
  'dungeonOutcomeDialogOpen',
  'dungeonOutcomeSummary',
  'dungeonOutcomeToneClass',
  'dungeonOutcomeMessage',
  'continueFromDungeonOutcome',
  'equipmentModalOpen',
  'selectedEquipmentModalView',
  'equipmentModalActionsDisabled',
  'takeEquipmentUseAction',
  'takeEquipmentSacrificeAction',
  'continueFromEquipmentModal',
  'confirmationDialogOpen',
  'confirmationDialogTitle',
  'confirmationDialogMessage',
  'confirmationDialogOkLabel',
  'confirmationDialogCancelLabel',
  'onConfirmationDialogCancel',
  'onConfirmationDialogOk',
  'neuralRefreshTerminalOpen',
  'reloadPageForNeuralRefreshTerminal',
  'vorpalPickerView',
  'onVorpalPickerCardTap',
  'confirmVorpalDeclaration',
  'deckSplayOpen',
  'onCloseDeckSplay',
]

export const EXPECTED_DEBUG_KEYS = [
  'debugMode',
  'nnDebugTraceHistory',
  'nnDebugTraceText',
  'exportReplay',
  'importReplay',
  'replayExportText',
  'replayImportText',
]

export const EXPECTED_PAGE_KEYS = [
  'mountLiveMatchShell',
  'unmountLiveMatchShell',
  'applyBootstrappedMatchSession',
  'processBootstrappedSession',
  'kickMatchAutomation',
  'maybeRunHeadlessMatchCompletion',
  'resetForSetupTerminal',
  'resetForFreshMatchEntry',
  'resetForBackToSetup',
  'matchPageOrchestrationCtx',
  'runLivePageMatchEntryGate',
  'requestConfirmation',
  'buildNewMatchEnvelope',
]

function createStorage() {
  const map = new Map()
  return {
    setItem(key, value) {
      map.set(key, value)
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

let prevWindow = globalThis.window

export function installLiveMatchShellTestWindow() {
  prevWindow = globalThis.window
  globalThis.window = {
    localStorage: createStorage(),
    location: { reload: () => {} },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

export function restoreLiveMatchShellTestWindow() {
  globalThis.window = prevWindow
}

export function createOrchestratorDeps(overrides = {}) {
  const setup = createDefaultSetupConfig()
  const presentationSpeedProfile = ref('cinematic')
  return {
    match: ref(null),
    debugMode: ref(false),
    presentationSpeedProfile: computed({
      get: () => presentationSpeedProfile.value,
      set: (value) => {
        presentationSpeedProfile.value = value
      },
    }),
    dungeonRunnerSettingsStore: {
      memoryAidEnabled: false,
      setAnimationPace: () => {},
    },
    setup,
    cloneSetup: (source = setup) => ({
      totalSeats: source.totalSeats,
      opponents: source.opponents.map((opponent) => ({ ...opponent })),
    }),
    nnRecovery: createNeuralRuntimeRecoveryCoordinator(),
    replayImportText: ref(''),
    replayExportText: ref(''),
    nnDebugTraceText: ref(''),
    nnDebugTraceHistory: ref([]),
    neuralLoadGateTerminalOpen: ref(false),
    matchNeuralLoadGateInFlight: ref(false),
    notify: () => {},
    ...overrides,
  }
}
