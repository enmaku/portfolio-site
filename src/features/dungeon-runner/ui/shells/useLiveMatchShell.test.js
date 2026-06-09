import assert from 'node:assert/strict'
import test from 'node:test'
import { computed, ref } from 'vue'
import { createNeuralRuntimeRecoveryCoordinator } from '../../nn/recovery.js'
import { createDefaultSetupConfig } from '../../setup/config.js'
import { LIVE_MATCH_SHELL_SESSION_GROUPS as LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS } from './liveMatchShellSessionGroups.js'
import {
  LIVE_MATCH_SHELL_SESSION_GROUPS,
  useLiveMatchShell,
} from './useLiveMatchShell.js'

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

const prevWindow = globalThis.window
globalThis.window = {
  localStorage: createStorage(),
  location: { reload: () => {} },
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  addEventListener: () => {},
  removeEventListener: () => {},
}

function createOrchestratorDeps(overrides = {}) {
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

const EXPECTED_BOARD_KEYS = [
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

const EXPECTED_DIALOG_KEYS = [
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

const EXPECTED_DEBUG_KEYS = [
  'debugMode',
  'nnDebugTraceHistory',
  'nnDebugTraceText',
  'exportReplay',
  'importReplay',
  'replayExportText',
  'replayImportText',
]

const EXPECTED_PAGE_KEYS = [
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

test('useLiveMatchShell exposes session inject groups', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())

  for (const group of LIVE_MATCH_SHELL_SESSION_GROUPS) {
    assert.ok(group in session, `missing session group ${group}`)
  }
})

test('useLiveMatchShell board group preserves inject capability keys', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())

  for (const key of EXPECTED_BOARD_KEYS) {
    assert.ok(key in session.board, `missing board.${key}`)
  }
})

test('useLiveMatchShell dialogs group preserves inject capability keys', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())

  for (const key of EXPECTED_DIALOG_KEYS) {
    assert.ok(key in session.dialogs, `missing dialogs.${key}`)
  }
})

test('useLiveMatchShell debug group preserves inject capability keys', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())

  for (const key of EXPECTED_DEBUG_KEYS) {
    assert.ok(key in session.debug, `missing debug.${key}`)
  }
})

test('useLiveMatchShell page group preserves inject capability keys', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())

  for (const key of EXPECTED_PAGE_KEYS) {
    assert.ok(key in session.page, `missing page.${key}`)
  }
  assert.equal(typeof session.page.mountLiveMatchShell, 'function')
  assert.equal(typeof session.page.requestConfirmation, 'function')
  assert.equal(typeof session.page.buildNewMatchEnvelope, 'function')
})

test('useLiveMatchShell re-exports session group constants', () => {
  assert.deepEqual(LIVE_MATCH_SHELL_SESSION_GROUPS, LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS)
})

test('useLiveMatchShell wires shared match ref into board group', () => {
  const deps = createOrchestratorDeps()
  const session = useLiveMatchShell(deps)

  assert.ok('match' in session.board)
  assert.equal(session.board.match, deps.match.value)
})

test('useLiveMatchShell exposes matchPageOrchestrationCtx with page orchestration contract', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())
  const ctx = session.page.matchPageOrchestrationCtx

  assert.ok(ctx)
  for (const key of [
    'storage',
    'recovery',
    'loadModel',
    'setMatchNeuralLoadGateInFlight',
    'clearCurrentMatch',
    'persistCurrentMatch',
    'applySetupSnapshot',
    'setupTarget',
    'cloneSetup',
    'resolveSetupTerminal',
    'applySetupTerminal',
  ]) {
    assert.ok(key in ctx, `missing matchPageOrchestrationCtx.${key}`)
  }
})

test('useLiveMatchShell wires cross-concern refs and handlers through inject groups', () => {
  const session = useLiveMatchShell(createOrchestratorDeps())

  assert.equal(typeof session.page.maybeRunHeadlessMatchCompletion, 'function')
  assert.equal(typeof session.board.takeHumanAction, 'function')
  assert.equal(typeof session.board.openEquipmentModal, 'function')
  assert.equal(typeof session.board.humanGameplayBlocked, 'boolean')
  assert.equal(typeof session.board.headlessCompletionInFlight, 'boolean')
})

test.after(() => {
  globalThis.window = prevWindow
})
