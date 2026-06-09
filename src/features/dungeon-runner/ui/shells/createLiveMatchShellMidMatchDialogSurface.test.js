import assert from 'node:assert/strict'
import test from 'node:test'
import { computed, nextTick, ref } from 'vue'
import { ACTION_TYPES, MATCH_PHASES, createInitialMatchState } from '../../engine/kernel.js'
import { createLiveMatchShellMidMatchDialogSurface } from './createLiveMatchShellMidMatchDialogSurface.js'
import { createLiveMatchShellHumanGameplaySurface } from './createLiveMatchShellHumanGameplaySurface.js'

function createTestDeps(overrides = {}) {
  const match = ref({
    state: {
      lastDungeonRun: { result: 'success', runnerSeatId: 'seat-1' },
      seats: [{ id: 'seat-1', role: { type: 'human' }, label: 'You' }],
      turn: { activeSeatId: 'seat-1' },
      centerEquipment: ['eq-1', 'eq-2'],
    },
  })
  const gameplayInputLocked = ref(false)
  const sacrificeModeActive = ref(false)
  const memoryAidState = ref({ enabled: true, deckSplayOpen: false })
  const deferredPostDungeonState = ref(null)
  const calls = []

  const vorpalPickerView = computed(() => ({
    open: false,
    confirmAction: null,
    hasSelection: false,
    cards: [],
  }))

  const deps = {
    match,
    gameplayInputLocked,
    isHumanTurn: computed(() => true),
    sacrificeModeActive,
    legalActions: computed(() => []),
    visibleState: computed(() => ({ playerOwnPileAdds: {} })),
    humanSeatId: computed(() => 'seat-1'),
    memoryAidState,
    deferredPostDungeonState,
    vorpalPickerView,
    onVorpalPickerCardTap: (species) => {
      calls.push(['vorpalTap', species])
    },
    confirmVorpalDeclaration: (action) => {
      calls.push(['vorpalConfirm', action?.type ?? null, action?.species ?? null])
    },
    presentationOrchestrator: {
      flushPostDungeonOutcomeAnimations: () => {
        calls.push('flushPostDungeonOutcomeAnimations')
      },
    },
    syncPresentationLabel: () => {
      calls.push('syncPresentationLabel')
    },
    maybeRunHeadlessMatchCompletion: async () => {
      calls.push('maybeRunHeadlessMatchCompletion')
    },
    takeHumanAction: (action) => {
      calls.push(['takeHumanAction', action?.type ?? null, action?.equipmentId ?? null])
    },
    reloadPage: () => {
      calls.push('reloadPage')
    },
    ...overrides,
  }

  return {
    deps,
    calls,
    match: deps.match,
    gameplayInputLocked,
    sacrificeModeActive,
    memoryAidState,
    deferredPostDungeonState: deps.deferredPostDungeonState,
  }
}

function createStorage() {
  const map = new Map()
  return {
    setItem(key, value) {
      map.set(key, value)
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
  }
}

function createWiredMatchRef(overrides = {}) {
  return ref({
    id: 'match-wired',
    state: createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'randombot' }] },
      { seed: 1 },
    ),
    ...overrides,
  })
}

function createWiredSurfaces(overrides = {}) {
  const equipmentModalBridge = { show: () => {} }
  const humanGameplayGate = {
    getBlocked: () => false,
    getDungeonOutcomeAckPending: () => false,
    getEquipmentModalOpen: () => false,
    closeEquipmentModalIfOpen: () => {},
    closeEquipmentModal: () => {},
  }
  const ctx = createTestDeps({
    match: createWiredMatchRef(),
    ...(overrides.deps ?? {}),
  })
  const humanSurface = createLiveMatchShellHumanGameplaySurface({
    match: ctx.match,
    dungeonRunnerSettingsStore: { memoryAidEnabled: false },
    gameplayInputLocked: ctx.gameplayInputLocked,
    activePresentation: ref(null),
    activePresentationLabel: ref(''),
    previousVisibleState: ref(null),
    deferredPostDungeonState: ctx.deferredPostDungeonState,
    seatRecoveryIndicators: ref([]),
    getHumanGameplayBlocked: () => humanGameplayGate.getBlocked(),
    getDungeonOutcomeAckPending: () => humanGameplayGate.getDungeonOutcomeAckPending(),
    closeEquipmentModalIfOpen: () => humanGameplayGate.closeEquipmentModalIfOpen(),
    closeEquipmentModal: () => humanGameplayGate.closeEquipmentModal(),
    showEquipmentModal: (equipmentId) => equipmentModalBridge.show(equipmentId),
    enqueuePresentationTransition: () => {},
    isLifecycleActive: () => true,
    getEquipmentModalOpen: () => humanGameplayGate.getEquipmentModalOpen(),
    humanDungeonAutoRevealGapMs: () => 0,
    storage: createStorage(),
    ...overrides.humanDeps,
  })
  const midSurface = createLiveMatchShellMidMatchDialogSurface({
    match: ctx.match,
    gameplayInputLocked: ctx.gameplayInputLocked,
    isHumanTurn: humanSurface.isHumanTurn,
    sacrificeModeActive: humanSurface.sacrificeModeActive,
    legalActions: humanSurface.legalActions,
    visibleState: humanSurface.visibleState,
    humanSeatId: humanSurface.humanSeatId,
    memoryAidState: humanSurface.memoryAidState,
    deferredPostDungeonState: ctx.deferredPostDungeonState,
    presentationOrchestrator: { flushPostDungeonOutcomeAnimations: () => {} },
    syncPresentationLabel: () => {},
    maybeRunHeadlessMatchCompletion: async () => {},
    takeHumanAction: (action) => ctx.calls.push(['takeHumanAction', action?.type ?? null, action?.equipmentId ?? null]),
    vorpalPickerView: humanSurface.vorpalPickerView,
    onVorpalPickerCardTap: humanSurface.onVorpalPickerCardTap,
    confirmVorpalDeclaration: humanSurface.confirmVorpalDeclaration,
    ...overrides.midDeps,
  })
  humanGameplayGate.getBlocked = () => midSurface.humanGameplayBlocked.value
  humanGameplayGate.getDungeonOutcomeAckPending = () => midSurface.dungeonOutcomeAckPending.value
  humanGameplayGate.closeEquipmentModalIfOpen = () => midSurface.closeEquipmentModalIfOpen()
  humanGameplayGate.closeEquipmentModal = () => midSurface.closeEquipmentModal()
  humanGameplayGate.getEquipmentModalOpen = () => midSurface.equipmentModalOpen.value
  equipmentModalBridge.show = midSurface.showEquipmentModal
  return { ...ctx, humanSurface, midSurface }
}

function createBiddingSacrificeModalDeps(overrides = {}) {
  const sacrificeModeActive = ref(true)
  const legalActions = computed(() => [
    { type: ACTION_TYPES.SACRIFICE, equipmentId: 'W_SHIELD' },
    { type: ACTION_TYPES.ADD_TO_DUNGEON },
  ])
  const match = ref({
    state: {
      phase: MATCH_PHASES.BIDDING,
      lastDungeonRun: null,
      seats: [{ id: 'seat-1', role: { type: 'human' }, label: 'You' }],
      turn: { activeSeatId: 'seat-1' },
      bidding: { revealedMonsterCard: 'goblin' },
      centerEquipment: ['W_SHIELD', 'B_AXE'],
    },
  })
  return createTestDeps({
    match,
    sacrificeModeActive,
    legalActions,
    isHumanTurn: computed(() => true),
    ...overrides,
  })
}

test('createLiveMatchShellMidMatchDialogSurface exposes surface return API shape', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  const expectedKeys = [
    'dialogs',
    'dungeonOutcomeAckPending',
    'humanGameplayBlocked',
    'headlessCompletionInFlight',
    'neuralRefreshTerminalOpen',
    'dismissedDungeonRun',
    'equipmentRemainingAtResolution',
    'equipmentModalOpen',
    'requestConfirmation',
    'openNeuralRefreshTerminal',
    'showEquipmentModal',
    'closeEquipmentModal',
    'closeEquipmentModalIfOpen',
    'syncLastDungeonRun',
    'ackDungeonRunForTeardown',
    'createHeadlessCompletionFlightGate',
    'getConfirmationDialogResolve',
  ]

  for (const key of expectedKeys) {
    assert.ok(key in surface, `missing surface.${key}`)
  }
})

test('createLiveMatchShellMidMatchDialogSurface exposes dialogs inject contract keys', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)
  const dialogs = surface.dialogs

  const expectedKeys = [
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

  for (const key of expectedKeys) {
    assert.ok(key in dialogs, `missing dialogs.${key}`)
  }
})

test('requestConfirmation resolves through ok and cancel handlers', async () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  const pending = surface.requestConfirmation({ message: 'Proceed?' })
  assert.equal(surface.dialogs.confirmationDialogOpen.value, true)

  surface.dialogs.onConfirmationDialogOk()
  assert.equal(await pending, true)
  assert.equal(surface.dialogs.confirmationDialogOpen.value, false)

  const pendingCancel = surface.requestConfirmation({ message: 'Again?' })
  surface.dialogs.onConfirmationDialogCancel()
  assert.equal(await pendingCancel, false)
})

test('requestConfirmation supersedes a prior pending resolver with false', async () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  const first = surface.requestConfirmation({ message: 'first' })
  const second = surface.requestConfirmation({ message: 'second' })

  assert.equal(await first, false)
  surface.dialogs.onConfirmationDialogOk()
  assert.equal(await second, true)
})

test('openNeuralRefreshTerminal and humanGameplayBlocked reflect dialog blockers', () => {
  const { deps, gameplayInputLocked } = createTestDeps({
    match: ref({
      state: {
        lastDungeonRun: null,
        seats: [],
      },
    }),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  assert.equal(surface.humanGameplayBlocked.value, false)

  surface.openNeuralRefreshTerminal()
  assert.equal(surface.neuralRefreshTerminalOpen.value, true)
  assert.equal(surface.humanGameplayBlocked.value, true)

  surface.neuralRefreshTerminalOpen.value = false
  gameplayInputLocked.value = true
  assert.equal(surface.humanGameplayBlocked.value, true)
})

test('dungeonOutcomeDialogOpen defers while headless completion is in flight', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  assert.equal(surface.dialogs.dungeonOutcomeDialogOpen.value, true)

  const gate = surface.createHeadlessCompletionFlightGate()
  assert.equal(gate.tryStart(), true)
  assert.equal(surface.dialogs.dungeonOutcomeDialogOpen.value, false)

  gate.finish()
  assert.equal(surface.dialogs.dungeonOutcomeDialogOpen.value, true)
})

test('createHeadlessCompletionFlightGate rejects concurrent tryStart', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)
  const gate = surface.createHeadlessCompletionFlightGate()

  assert.equal(gate.tryStart(), true)
  assert.equal(gate.inFlight, true)
  assert.equal(gate.tryStart(), false)

  gate.finish()
  assert.equal(gate.inFlight, false)
})

test('dungeonOutcomeAckPending tracks dismissed dungeon run state', async () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  assert.equal(surface.dungeonOutcomeAckPending.value, true)

  const run = deps.match.value.state.lastDungeonRun
  surface.dismissedDungeonRun.value = run
  assert.equal(surface.dungeonOutcomeAckPending.value, false)
})

test('syncLastDungeonRun applies watcher update contract', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.syncLastDungeonRun(null, [])
  assert.equal(surface.dismissedDungeonRun.value, null)
  assert.equal(surface.equipmentRemainingAtResolution.value, null)

  const run = { result: 'failure' }
  surface.syncLastDungeonRun(run, ['eq-a'])
  assert.equal(surface.equipmentRemainingAtResolution.value, 1)
})

test('lastDungeonRun watcher syncs equipment remaining on create and update', async () => {
  const match = ref({
    state: {
      lastDungeonRun: { result: 'success' },
      centerEquipment: ['eq-1', 'eq-2'],
      seats: [],
    },
  })
  const { deps } = createTestDeps({ match })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  await nextTick()
  assert.equal(surface.equipmentRemainingAtResolution.value, 2)

  match.value = {
    state: {
      lastDungeonRun: null,
      centerEquipment: [],
      seats: [],
    },
  }
  await nextTick()
  assert.equal(surface.dismissedDungeonRun.value, null)
  assert.equal(surface.equipmentRemainingAtResolution.value, null)
})

test('deckSplayOpen toggles memory aid splay state', () => {
  const { deps, memoryAidState } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.dialogs.deckSplayOpen.value = true
  assert.equal(memoryAidState.value.deckSplayOpen, true)

  surface.dialogs.onCloseDeckSplay()
  assert.equal(memoryAidState.value.deckSplayOpen, false)
})

test('showEquipmentModal opens modal lifecycle for equipment id', () => {
  const { deps } = createTestDeps({
    match: ref({
      state: {
        lastDungeonRun: null,
        seats: [{ id: 'seat-1', label: 'You' }],
        centerEquipment: [],
      },
    }),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('B_AXE')

  assert.equal(surface.equipmentModalOpen.value, true)
  assert.equal(surface.dialogs.selectedEquipmentModalView.value?.equipmentId, 'B_AXE')
})

test('showEquipmentModal opens modal and selects bidding-sacrifice view in sacrifice mode', () => {
  const { deps } = createBiddingSacrificeModalDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('W_SHIELD')

  assert.equal(surface.equipmentModalOpen.value, true)
  const view = surface.dialogs.selectedEquipmentModalView.value
  assert.equal(view?.equipmentId, 'W_SHIELD')
  assert.equal(view?.showSacrificeButton, true)
  assert.equal(view?.showUseButton, false)
  assert.deepEqual(view?.sacrificeAction, { type: ACTION_TYPES.SACRIFICE, equipmentId: 'W_SHIELD' })
  assert.equal(view?.continueAction, null)
})

test('selectedEquipmentModalView uses dungeon modal outside bidding sacrifice mode', () => {
  const legalActions = computed(() => [
    { type: 'USE_FIRE_AXE' },
    { type: 'DECLINE_FIRE_AXE' },
  ])
  const { deps } = createTestDeps({
    legalActions,
    sacrificeModeActive: ref(false),
    match: ref({
      state: {
        phase: MATCH_PHASES.DUNGEON,
        lastDungeonRun: null,
        seats: [{ id: 'seat-1', label: 'You' }],
        centerEquipment: [],
      },
    }),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('B_AXE')

  const view = surface.dialogs.selectedEquipmentModalView.value
  assert.equal(view?.equipmentId, 'B_AXE')
  assert.equal(view?.showUseButton, true)
  assert.equal(view?.showSacrificeButton, undefined)
})

test('takeEquipmentSacrificeAction forwards legal sacrifice action when enabled', () => {
  const { deps, calls } = createBiddingSacrificeModalDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('W_SHIELD')
  surface.dialogs.takeEquipmentSacrificeAction()

  assert.deepEqual(calls.at(-1), ['takeHumanAction', ACTION_TYPES.SACRIFICE, 'W_SHIELD'])
})

test('takeEquipmentSacrificeAction is a no-op when modal actions are disabled', () => {
  const { deps, calls, gameplayInputLocked } = createBiddingSacrificeModalDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('W_SHIELD')
  gameplayInputLocked.value = true
  surface.dialogs.takeEquipmentSacrificeAction()

  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'takeHumanAction'), false)
})

test('continueFromEquipmentModal dismisses bidding-sacrifice modal without engine action', () => {
  const { deps, calls } = createBiddingSacrificeModalDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('W_SHIELD')
  surface.dialogs.continueFromEquipmentModal()

  assert.equal(surface.equipmentModalOpen.value, false)
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'takeHumanAction'), false)
})

test('continueFromEquipmentModal dismisses modal without action when actions are disabled', () => {
  const { deps, calls, gameplayInputLocked } = createBiddingSacrificeModalDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('W_SHIELD')
  gameplayInputLocked.value = true
  surface.dialogs.continueFromEquipmentModal()

  assert.equal(surface.equipmentModalOpen.value, false)
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'takeHumanAction'), false)
})

test('presentation lock with sacrifice mode and open equipment modal preserves sacrifice and disables actions', () => {
  const { humanSurface, midSurface, gameplayInputLocked } = createWiredSurfaces({
    deps: {
      match: ref({
        state: {
          phase: MATCH_PHASES.BIDDING,
          lastDungeonRun: null,
          seats: [{ id: 'seat-1', role: { type: 'human' }, label: 'You' }],
          turn: { activeSeatId: 'seat-1' },
          bidding: { revealedMonsterCard: 'goblin' },
          centerEquipment: ['W_SHIELD'],
        },
      }),
    },
  })

  humanSurface.sacrificeModeActive.value = true
  midSurface.showEquipmentModal('W_SHIELD')
  assert.equal(midSurface.equipmentModalOpen.value, true)

  gameplayInputLocked.value = true
  assert.equal(midSurface.equipmentModalOpen.value, true)
  assert.equal(midSurface.dialogs.equipmentModalActionsDisabled.value, true)
  assert.equal(humanSurface.sacrificeModeActive.value, true)

  midSurface.dialogs.takeEquipmentSacrificeAction()
  midSurface.dialogs.continueFromEquipmentModal()

  assert.equal(midSurface.equipmentModalOpen.value, false)
  assert.equal(humanSurface.sacrificeModeActive.value, true)
})

test('takeEquipmentUseAction forwards legal use action when enabled', () => {
  const legalActions = computed(() => [
    { type: 'USE_FIRE_AXE' },
    { type: 'DECLINE_FIRE_AXE' },
  ])
  const { deps, calls } = createTestDeps({
    legalActions,
    match: ref({
      state: {
        lastDungeonRun: null,
        seats: [{ id: 'seat-1', label: 'You' }],
        centerEquipment: [],
      },
    }),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('B_AXE')
  surface.dialogs.takeEquipmentUseAction()

  assert.deepEqual(calls.at(-1), ['takeHumanAction', 'USE_FIRE_AXE', null])
})

test('takeEquipmentUseAction is a no-op when modal actions are disabled', () => {
  const legalActions = computed(() => [
    { type: 'USE_FIRE_AXE' },
    { type: 'DECLINE_FIRE_AXE' },
  ])
  const { deps, calls, gameplayInputLocked } = createTestDeps({ legalActions })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('B_AXE')
  gameplayInputLocked.value = true
  surface.dialogs.takeEquipmentUseAction()

  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'takeHumanAction'), false)
})

test('continueFromDungeonOutcome applies deferred state and runs completion hooks', async () => {
  const deferredState = { phase: 'match-over', lastDungeonRun: { result: 'success' } }
  const { deps, calls, match, deferredPostDungeonState } = createTestDeps({
    deferredPostDungeonState: ref(deferredState),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  await surface.dialogs.continueFromDungeonOutcome()

  assert.deepEqual(match.value.state, deferredState)
  assert.equal(deferredPostDungeonState.value, null)
  assert.notEqual(surface.dismissedDungeonRun.value, null)
  assert.deepEqual(calls, [
    'flushPostDungeonOutcomeAnimations',
    'syncPresentationLabel',
    'maybeRunHeadlessMatchCompletion',
  ])
})

test('continueFromDungeonOutcome is a no-op without run or deferred state', async () => {
  const { deps, calls, match } = createTestDeps({
    match: ref({ state: { lastDungeonRun: null, seats: [], centerEquipment: [] } }),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  await surface.dialogs.continueFromDungeonOutcome()

  assert.equal(match.value.state.lastDungeonRun, null)
  assert.equal(calls.length, 0)
})

test('ackDungeonRunForTeardown dismisses the active dungeon run', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)
  const run = { result: 'failure', runnerSeatId: 'seat-1' }

  surface.ackDungeonRunForTeardown(run)

  assert.deepEqual(surface.dismissedDungeonRun.value, run)
})

test('reloadPageForNeuralRefreshTerminal uses injected reloadPage', () => {
  const { deps, calls } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.dialogs.reloadPageForNeuralRefreshTerminal()

  assert.deepEqual(calls, ['reloadPage'])
})

test('closeEquipmentModal and closeEquipmentModalIfOpen clear modal open state', () => {
  const { deps } = createTestDeps({
    match: ref({
      state: {
        lastDungeonRun: null,
        seats: [{ id: 'seat-1', label: 'You' }],
        centerEquipment: [],
      },
    }),
  })
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  surface.showEquipmentModal('B_AXE')
  surface.closeEquipmentModalIfOpen()
  assert.equal(surface.equipmentModalOpen.value, false)

  surface.showEquipmentModal('B_AXE')
  surface.closeEquipmentModal()
  assert.equal(surface.equipmentModalOpen.value, false)
})

test('mid-match dialog forwards vorpal picker view from human gameplay surface', () => {
  const { humanSurface, midSurface } = createWiredSurfaces()
  assert.equal(midSurface.dialogs.vorpalPickerView, humanSurface.vorpalPickerView)
})

test('getConfirmationDialogResolve returns pending resolver for lifecycle teardown', () => {
  const { deps } = createTestDeps()
  const surface = createLiveMatchShellMidMatchDialogSurface(deps)

  void surface.requestConfirmation({ message: 'x' })
  assert.equal(typeof surface.getConfirmationDialogResolve(), 'function')
})
