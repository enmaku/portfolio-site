import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTick, reactive, ref } from 'vue'
import {
  ACTION_TYPES,
  DUNGEON_SUBPHASES,
  MATCH_PHASES,
  applyAction,
  createInitialMatchState,
  getLegalActions,
} from '../../engine/kernel.js'
import { bootstrapMatchStateForReplay } from '../../debug/replayBootstrap.js'
import { persistCurrentMatch } from '../../persistence/currentMatch.js'
import { createLiveMatchShellHumanGameplaySurface } from './createLiveMatchShellHumanGameplaySurface.js'

const REPLAY_SETUP = { totalSeats: 3, opponents: [{ type: 'randombot' }, { type: 'randombot' }] }

function advanceToHumanTurn(seed = 88) {
  let state = bootstrapMatchStateForReplay(REPLAY_SETUP, seed)
  const humanSeatId = state.seats.find((seat) => seat.role.type === 'human')?.id
  for (let step = 0; step < 20; step += 1) {
    if (state.turn.activeSeatId === humanSeatId) return { state, humanSeatId }
    const actorSeatId = state.turn.activeSeatId
    const action =
      getLegalActions(state, { seatId: actorSeatId }).find(
        (candidate) => candidate.type === 'CHOOSE_NEXT_ADVENTURER',
      ) ?? getLegalActions(state, { seatId: actorSeatId })[0]
    const applied = applyAction(state, action, { seatId: actorSeatId })
    if (!applied.ok) break
    state = applied.state
  }
  return { state: null, humanSeatId }
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

function createTestDeps(overrides = {}) {
  const match = ref({
    id: 'match-1',
    state: {
      phase: 'bidding',
      turn: { activeSeatId: 'seat-bot', turnNumber: 1 },
      seats: [
        { id: 'seat-human', role: { type: 'human' }, label: 'You' },
        { id: 'seat-bot', role: { type: 'randombot' } },
      ],
      bidding: { subphase: 'draw', revealedMonsterCard: null },
      scoreboard: {},
      centerEquipment: [],
      history: [],
      rng: { seed: 1 },
    },
  })
  const dungeonRunnerSettingsStore = reactive({ memoryAidEnabled: true })
  const gameplayInputLocked = ref(false)
  const activePresentation = ref(null)
  const activePresentationLabel = ref('')
  const previousVisibleState = ref(null)
  const deferredPostDungeonState = ref(null)
  const seatRecoveryIndicators = ref([])
  const calls = []
  const storage = createStorage()

  const deps = {
    match,
    dungeonRunnerSettingsStore,
    gameplayInputLocked,
    activePresentation,
    activePresentationLabel,
    previousVisibleState,
    deferredPostDungeonState,
    seatRecoveryIndicators,
    getHumanGameplayBlocked: () => false,
    getDungeonOutcomeAckPending: () => false,
    closeEquipmentModalIfOpen: () => {
      calls.push('closeEquipmentModalIfOpen')
    },
    closeEquipmentModal: () => {
      calls.push('closeEquipmentModal')
    },
    showEquipmentModal: (equipmentId) => {
      calls.push(['showEquipmentModal', equipmentId])
    },
    enqueuePresentationTransition: (...args) => {
      calls.push(['enqueuePresentationTransition', ...args])
    },
    isLifecycleActive: () => true,
    getEquipmentModalOpen: () => false,
    humanDungeonAutoRevealGapMs: () => 0,
    storage,
    persistCurrentMatch,
    ...overrides,
  }

  return { deps, calls, match, dungeonRunnerSettingsStore, storage }
}

function createSurface(overrides = {}) {
  const ctx = createTestDeps(overrides.deps)
  const surface = createLiveMatchShellHumanGameplaySurface({
    ...ctx.deps,
    ...overrides.deps,
  })
  return { surface, ...ctx }
}

function createHumanBiddingPostDrawState(seed = 42) {
  const state = createInitialMatchState(REPLAY_SETUP, { seed })
  const humanSeatId = state.seats.find((seat) => seat.role.type === 'human')?.id
  assert.ok(humanSeatId)
  const postDraw = {
    ...state,
    phase: MATCH_PHASES.BIDDING,
    turn: { ...state.turn, activeSeatId: humanSeatId },
    centerEquipment: ['W_SHIELD', 'B_AXE'],
    bidding: {
      ...state.bidding,
      revealedMonsterCard: 'goblin',
    },
  }
  const legal = getLegalActions(postDraw, { seatId: humanSeatId })
  assert.ok(legal.some((action) => action.type === ACTION_TYPES.SACRIFICE))
  return { state: postDraw, humanSeatId }
}

function createMatchWinRevealState(seed = 1) {
  const state = createInitialMatchState({ totalSeats: 2, opponents: [{ type: 'randombot' }] }, { seed })
  const humanSeatId = state.seats.find((seat) => seat.role.type === 'human')?.id
  assert.ok(humanSeatId)
  const revealReady = {
    ...state,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...state.turn, activeSeatId: humanSeatId },
    bidding: { ...state.bidding, runnerSeatId: humanSeatId, dungeonMonsters: [] },
    scoreboard: {
      ...state.scoreboard,
      [humanSeatId]: { ...state.scoreboard[humanSeatId], successes: 1 },
    },
    dungeon: {
      ...state.dungeon,
      subphase: DUNGEON_SUBPHASES.REVEAL,
      currentMonster: null,
      remainingMonsters: [],
      hp: 1,
      inPlayEquipmentIds: [],
      discardedRunMonsters: [],
      polySpent: true,
      axeSpent: true,
    },
  }
  const action = getLegalActions(revealReady, { seatId: humanSeatId })[0]
  assert.equal(action?.type, ACTION_TYPES.REVEAL_OR_CONTINUE)
  const applied = applyAction(revealReady, action, { seatId: humanSeatId })
  assert.equal(applied.ok, true)
  assert.equal(applied.state.phase, MATCH_PHASES.MATCH_OVER)
  return { revealReady, humanSeatId, winningAction: action }
}

test('createLiveMatchShellHumanGameplaySurface exposes concern API shape', () => {
  const { surface } = createSurface()

  const expectedKeys = [
    'memoryAidState',
    'sacrificeModeActive',
    'humanSeatId',
    'isHumanTurn',
    'legalActions',
    'visibleState',
    'dungeonResolutionView',
    'takeHumanAction',
    'onDeckTap',
    'enterSacrificeMode',
    'cancelSacrificeMode',
    'actionKey',
    'actionLabel',
    'biddingPostDrawActionPaneKey',
    'selectedVorpalSpecies',
    'onVorpalPickerCardTap',
    'confirmVorpalDeclaration',
    'resetVorpalPickerSelection',
    'onEquipmentTokenTap',
    'scheduleHumanAutoResolveIfReady',
    'clearAutoResolveTimer',
    'getAutoResolveTimerId',
    'board',
  ]

  for (const key of expectedKeys) {
    assert.ok(key in surface, `missing surface.${key}`)
  }
})

test('createLiveMatchShellHumanGameplaySurface board inject preserves group keys', () => {
  const { surface } = createSurface()
  const expectedBoardKeys = [
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

  for (const key of expectedBoardKeys) {
    assert.ok(key in surface.board, `missing board.${key}`)
  }
})

test('onDeckTap opens deck splay only when memory aid is enabled', async () => {
  const { surface, dungeonRunnerSettingsStore } = createSurface()
  dungeonRunnerSettingsStore.memoryAidEnabled = false
  await nextTick()
  surface.onDeckTap()
  assert.equal(surface.memoryAidState.value.deckSplayOpen, false)

  dungeonRunnerSettingsStore.memoryAidEnabled = true
  await nextTick()
  surface.onDeckTap()
  assert.equal(surface.memoryAidState.value.deckSplayOpen, true)
})

test('takeHumanAction is a no-op when human gameplay is blocked', () => {
  const { surface, match, calls } = createSurface({
    deps: { getHumanGameplayBlocked: () => true },
  })
  const before = JSON.stringify(match.value.state)

  surface.takeHumanAction({ type: 'PASS' })

  assert.equal(JSON.stringify(match.value.state), before)
  assert.equal(calls.length, 0)
})

test('takeHumanAction persists match and enqueues presentation for legal action', () => {
  const { state: humanTurnState, humanSeatId } = advanceToHumanTurn()
  assert.ok(humanTurnState && humanSeatId)
  const match = ref({ id: 'match-1', state: humanTurnState })
  const { surface, calls, storage } = createSurface({ deps: { match } })
  const action = getLegalActions(humanTurnState, { seatId: humanSeatId }).find(
    (candidate) => candidate.type === 'CHOOSE_NEXT_ADVENTURER',
  )
  assert.ok(action)

  surface.takeHumanAction(action)

  assert.ok(calls.includes('closeEquipmentModalIfOpen'))
  assert.ok(
    calls.some(
      (entry) => Array.isArray(entry) && entry[0] === 'enqueuePresentationTransition',
    ),
  )
  assert.ok(storage.getItem('dungeon-runner/current-match'))
})

test('enterSacrificeMode is a no-op when human gameplay is blocked', () => {
  const { surface } = createSurface({
    deps: { getHumanGameplayBlocked: () => true },
  })
  surface.enterSacrificeMode()
  assert.equal(surface.sacrificeModeActive.value, false)
})

test('cancelSacrificeMode closes equipment modal', () => {
  const { surface, calls } = createSurface()
  surface.sacrificeModeActive.value = true
  surface.cancelSacrificeMode()
  assert.equal(surface.sacrificeModeActive.value, false)
  assert.deepEqual(calls, ['closeEquipmentModal'])
})

test('board openEquipmentModal rejects taps without modal metadata', () => {
  const { surface, calls } = createSurface()

  surface.board.openEquipmentModal({ hasModal: false, equipmentId: 'B_AXE' })

  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === 'showEquipmentModal'), false)
})

test('vorpal picker tap selects species when gameplay is unblocked', () => {
  const { surface } = createSurface()
  surface.onVorpalPickerCardTap('dragon')
  assert.equal(surface.selectedVorpalSpecies.value, 'dragon')
})

test('confirmVorpalDeclaration is a no-op without confirm action', () => {
  const { surface, calls } = createSurface()
  surface.confirmVorpalDeclaration(null)
  assert.equal(calls.length, 0)
})

test('confirmVorpalDeclaration is a no-op when human gameplay is blocked', () => {
  const { surface, calls } = createSurface({
    deps: { getHumanGameplayBlocked: () => true },
  })
  surface.confirmVorpalDeclaration({ type: 'DECLARE_VORPAL', species: 'dragon' })
  assert.equal(calls.length, 0)
})

test('vorpal picker tap is a no-op when human gameplay is blocked', () => {
  const { surface } = createSurface({
    deps: { getHumanGameplayBlocked: () => true },
  })

  surface.onVorpalPickerCardTap('dragon')
  assert.equal(surface.selectedVorpalSpecies.value, null)
})

test('resetVorpalPickerSelection clears selected species', () => {
  const { surface } = createSurface()
  surface.selectedVorpalSpecies.value = 'goblin'
  surface.resetVorpalPickerSelection()
  assert.equal(surface.selectedVorpalSpecies.value, null)
})

test('actionKey distinguishes actions with equipment and hero fields', () => {
  const { surface } = createSurface()
  assert.equal(surface.actionKey({ type: 'PASS' }), 'PASS')
  assert.equal(
    surface.actionKey({ type: 'SACRIFICE', equipmentId: 'B_AXE' }),
    'SACRIFICE-B_AXE',
  )
  assert.equal(
    surface.actionKey({ type: 'CHOOSE_NEXT_ADVENTURER', hero: 'MAGE' }),
    'CHOOSE_NEXT_ADVENTURER-MAGE',
  )
})

test('humanSeatId and isHumanTurn follow active match turn', () => {
  const { surface, match } = createSurface()
  match.value.state.turn.activeSeatId = 'seat-human'
  assert.equal(surface.humanSeatId.value, 'seat-human')
  assert.equal(surface.isHumanTurn.value, true)

  match.value.state.turn.activeSeatId = 'seat-bot'
  assert.equal(surface.isHumanTurn.value, false)
  assert.deepEqual(surface.legalActions.value, [])
})

test('showDungeonStage is true during dungeon phase and while outcome ack is pending', () => {
  const { surface, match } = createSurface()
  match.value.state.phase = MATCH_PHASES.BIDDING
  assert.equal(surface.board.showDungeonStage.value, false)

  match.value.state.phase = MATCH_PHASES.DUNGEON
  assert.equal(surface.board.showDungeonStage.value, true)

  match.value.state.phase = MATCH_PHASES.BIDDING
  const { surface: ackSurface } = createSurface({
    deps: { getDungeonOutcomeAckPending: () => true },
  })
  assert.equal(ackSurface.board.showDungeonStage.value, true)
})

test('enterSacrificeMode activates only in human bidding post-draw context', async () => {
  const { state } = createHumanBiddingPostDrawState()
  const match = ref({ id: 'match-1', state })
  const { surface } = createSurface({ deps: { match } })
  assert.equal(surface.board.showBiddingPostDrawActionPane.value, true)

  surface.enterSacrificeMode()
  assert.equal(surface.sacrificeModeActive.value, true)
  assert.equal(
    surface.board.biddingPostDrawActionPane.value.some((item) => item.kind === 'cancelSacrificeMode'),
    true,
  )

  surface.sacrificeModeActive.value = true
  match.value = {
    ...match.value,
    state: {
      ...state,
      bidding: { ...state.bidding, revealedMonsterCard: null },
    },
  }
  await nextTick()
  assert.equal(surface.board.showBiddingPostDrawActionPane.value, false)
  assert.equal(surface.sacrificeModeActive.value, false)
})

test('takeHumanAction clears sacrifice mode and prefetches before applying', () => {
  const { state, humanSeatId } = createHumanBiddingPostDrawState()
  const match = ref({ id: 'match-1', state })
  const prefetchCalls = []
  const { surface } = createSurface({
    deps: {
      match,
      resetAiTurnPrefetch: () => {
        prefetchCalls.push('reset')
      },
    },
  })
  surface.enterSacrificeMode()
  const sacrificeAction = getLegalActions(state, { seatId: humanSeatId }).find(
    (action) => action.type === ACTION_TYPES.SACRIFICE,
  )
  assert.ok(sacrificeAction)

  surface.takeHumanAction(sacrificeAction)

  assert.deepEqual(prefetchCalls, ['reset'])
  assert.equal(surface.sacrificeModeActive.value, false)
  assert.notEqual(match.value.state.bidding.revealedMonsterCard, 'goblin')
})

test('takeHumanAction defers match-over exit until dungeon outcome is acknowledged', () => {
  const { revealReady, humanSeatId, winningAction } = createMatchWinRevealState()
  const match = ref({ id: 'match-1', state: revealReady })
  const deferredPostDungeonState = ref(null)
  const { surface } = createSurface({ deps: { match, deferredPostDungeonState } })

  surface.takeHumanAction(winningAction)

  assert.equal(match.value.state.phase, MATCH_PHASES.DUNGEON)
  assert.equal(deferredPostDungeonState.value?.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(deferredPostDungeonState.value?.matchWinnerSeatId, humanSeatId)
})

test('takeHumanAction snapshots previousVisibleState before state mutation', () => {
  const { state: humanTurnState, humanSeatId } = advanceToHumanTurn()
  assert.ok(humanTurnState && humanSeatId)
  const match = ref({ id: 'match-1', state: humanTurnState })
  const previousVisibleState = ref(null)
  const { surface } = createSurface({ deps: { match, previousVisibleState } })
  const action = getLegalActions(humanTurnState, { seatId: humanSeatId }).find(
    (candidate) => candidate.type === 'CHOOSE_NEXT_ADVENTURER',
  )
  assert.ok(action)

  surface.takeHumanAction(action)

  assert.ok(previousVisibleState.value)
  assert.equal(previousVisibleState.value.phase, humanTurnState.phase)
  assert.notEqual(match.value.state.phase, humanTurnState.phase)
})

test('confirmVorpalDeclaration delegates to takeHumanAction when gameplay is unblocked', () => {
  const { state: humanTurnState, humanSeatId } = advanceToHumanTurn()
  assert.ok(humanTurnState && humanSeatId)
  const match = ref({ id: 'match-1', state: humanTurnState })
  const { surface, calls } = createSurface({ deps: { match } })
  const confirmAction = getLegalActions(humanTurnState, { seatId: humanSeatId }).find(
    (candidate) => candidate.type === ACTION_TYPES.CHOOSE_NEXT_ADVENTURER,
  )
  assert.ok(confirmAction)

  surface.confirmVorpalDeclaration(confirmAction)

  assert.ok(
    calls.some(
      (entry) => Array.isArray(entry) && entry[0] === 'enqueuePresentationTransition',
    ),
  )
})

test('biddingPostDrawActionPaneKey distinguishes engine actions from control kinds', () => {
  const { surface } = createSurface()
  assert.equal(surface.biddingPostDrawActionPaneKey({ kind: 'enter' }), 'enter')
  assert.equal(
    surface.biddingPostDrawActionPaneKey({
      kind: 'engine',
      action: { type: ACTION_TYPES.SACRIFICE, equipmentId: 'W_SHIELD' },
    }),
    'SACRIFICE-W_SHIELD',
  )
})

test('showHeroPickActionGrid and heroPickActionsOrdered follow engine hero order', () => {
  const { state: humanTurnState, humanSeatId } = advanceToHumanTurn()
  assert.ok(humanTurnState && humanSeatId)
  const match = ref({ id: 'match-1', state: humanTurnState })
  const { surface } = createSurface({ deps: { match } })

  assert.equal(surface.board.showHeroPickActionGrid.value, true)
  assert.equal(surface.board.heroPickActionsOrdered.value.length, 4)
  assert.deepEqual(
    surface.board.heroPickActionsOrdered.value.map((action) => action.hero),
    ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE'],
  )
})

test('actionLabel returns a non-empty label for legal engine actions', () => {
  const { surface } = createSurface()
  const label = surface.actionLabel({ type: ACTION_TYPES.PASS })
  assert.equal(typeof label, 'string')
  assert.ok(label.length > 0)
})

test('onEquipmentTokenTap rejects taps while human gameplay is blocked', () => {
  const { surface, calls } = createSurface({
    deps: { getHumanGameplayBlocked: () => true },
  })

  surface.onEquipmentTokenTap({ hasModal: true, equipmentId: 'B_AXE' })

  assert.equal(calls.length, 0)
})

test('onEquipmentTokenTap rejects tokens without modal affordance', () => {
  const { surface, calls } = createSurface()

  surface.onEquipmentTokenTap({ hasModal: false, equipmentId: 'B_AXE' })

  assert.equal(calls.length, 0)
})

test('onEquipmentTokenTap delegates eligible token to injected showEquipmentModal', () => {
  const { surface, calls } = createSurface()

  surface.board.openEquipmentModal({ hasModal: true, equipmentId: 'B_AXE' })

  assert.deepEqual(calls, [['showEquipmentModal', 'B_AXE']])
})

test('seatRunTrackerRows merges scoreboard and recovery indicators by seat', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }
  const match = ref({
    id: 'match-1',
    state: createInitialMatchState(setup, { seed: 7 }),
  })
  const humanSeatId = match.value.state.seats.find((seat) => seat.role.type === 'human')?.id
  const nnSeatId = match.value.state.seats.find((seat) => seat.role.type === 'nn')?.id
  assert.ok(humanSeatId)
  assert.ok(nnSeatId)
  match.value = {
    ...match.value,
    state: {
      ...match.value.state,
      scoreboard: {
        ...match.value.state.scoreboard,
        [humanSeatId]: { successes: 2, lives: 1, eliminated: false },
        [nnSeatId]: { successes: 0, lives: 0, eliminated: true },
      },
    },
  }
  const seatRecoveryIndicators = ref([
    { seatId: nnSeatId, recovering: true, testId: `neural-seat-recovery-${nnSeatId}` },
  ])
  const { surface } = createSurface({ deps: { match, seatRecoveryIndicators } })
  const rows = surface.board.seatRunTrackerRows.value
  const humanRow = rows.find((row) => row.seatId === humanSeatId)
  const nnRow = rows.find((row) => row.seatId === nnSeatId)

  assert.equal(humanRow?.successes, 2)
  assert.equal(humanRow?.failures, 1)
  assert.equal(humanRow?.eliminated, false)
  assert.equal(humanRow?.recovering, false)
  assert.equal(humanRow?.recoveryTestId, null)

  assert.equal(nnRow?.successes, 0)
  assert.equal(nnRow?.failures, 2)
  assert.equal(nnRow?.eliminated, true)
  assert.equal(nnRow?.recovering, true)
  assert.equal(nnRow?.recoveryTestId, `neural-seat-recovery-${nnSeatId}`)
})
