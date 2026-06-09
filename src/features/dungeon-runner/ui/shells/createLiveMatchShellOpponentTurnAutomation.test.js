import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { applyAction, getLegalActions, MATCH_PHASES } from '../../engine/kernel.js'
import { bootstrapMatchStateForReplay } from '../../debug/replayBootstrap.js'
import { buildAiTurnRunToken } from '../dungeonRunnerAiTurnToken.js'
import { resetAiTurnPrefetch } from '../dungeonRunnerAiTurnPrefetch.js'
import { createLiveMatchShellOpponentTurnAutomation } from './createLiveMatchShellOpponentTurnAutomation.js'

const REPLAY_SETUP = { totalSeats: 3, opponents: [{ type: 'randombot' }, { type: 'randombot' }] }

function advanceToOpponentTurn(seed = 42) {
  let state = bootstrapMatchStateForReplay(REPLAY_SETUP, seed)
  const humanSeatId = state.seats.find((seat) => seat.role.type === 'human')?.id
  for (let step = 0; step < 30; step += 1) {
    if (state.turn.activeSeatId !== humanSeatId) {
      return { state, activeSeatId: state.turn.activeSeatId, humanSeatId }
    }
    const actorSeatId = state.turn.activeSeatId
    const legal = getLegalActions(state, { seatId: actorSeatId })
    const action =
      legal.find((candidate) => candidate.type === 'CHOOSE_NEXT_ADVENTURER') ?? legal[0]
    const applied = applyAction(state, action, { seatId: actorSeatId })
    if (!applied.ok) break
    state = applied.state
  }
  return { state: null, activeSeatId: null, humanSeatId }
}

function createMockRecovery(overrides = {}) {
  return {
    isRecovering: () => false,
    getLoadAttempts: () => 0,
    getInferAttempts: () => 0,
    getBackendPreference: () => null,
    getTerminalOutcome: () => 'NONE',
    subscribe: () => () => {},
    ...overrides,
  }
}

function createMatchState(overrides = {}) {
  return {
    phase: MATCH_PHASES.BIDDING,
    turn: { activeSeatId: 'seat-nn', turnNumber: 1 },
    seats: [
      { id: 'seat-human', role: { type: 'human' } },
      { id: 'seat-nn', role: { type: 'nn', modelId: 'latest' } },
    ],
    bidding: { subphase: 'draw', revealedMonsterCard: null },
    rng: { step: 0 },
    ...overrides,
  }
}

function createAutomation(overrides = {}) {
  const match = ref({
    id: 'match-1',
    state: createMatchState(),
  })
  const debugMode = ref(false)
  const deferredPostDungeonState = ref(null)
  const matchNeuralLoadGateInFlight = ref(false)
  const gameplayInputLocked = ref(false)
  const previousVisibleState = ref(null)
  const activePresentation = ref(null)
  const persistCalls = []
  const enqueueCalls = []
  const scheduled = []
  const clearedTimerIds = []
  let lifecycleActive = true

  const presentationOrchestrator = {
    getQueueSnapshot: () => [],
  }

  const automation = createLiveMatchShellOpponentTurnAutomation({
    match,
    debugMode,
    nnRecovery: createMockRecovery(),
    getHumanSeatId: () => 'seat-human',
    getIsHumanTurn: () => false,
    deferredPostDungeonState,
    matchNeuralLoadGateInFlight,
    gameplayInputLocked,
    previousVisibleState,
    presentationOrchestrator,
    activePresentation,
    enqueuePresentationTransition: (...args) => {
      enqueueCalls.push(args)
    },
    getNeuralRefreshTerminalOpen: () => false,
    getHeadlessCompletionInFlight: () => false,
    ensureNnModelsReady: async () => {},
    nnRuntimeOptions: () => ({}),
    handleNeuralRecoveryTerminalError: () => false,
    isLifecycleActive: () => lifecycleActive,
    getMatchPageOrchestrationCtx: () => ({}),
    createHeadlessCompletionFlightGate: () => ({
      inFlight: false,
      tryStart: () => true,
      finish: () => {},
    }),
    syncPresentationLabel: () => {},
    clearPresentationOrchestrator: () => {},
    ackDungeonRunForTeardown: () => {},
    onClearAutoResolveTimer: () => {},
    storage: {
      setItem: () => {},
      getItem: () => null,
      removeItem: () => {},
    },
    persistCurrentMatch: (_storage, envelope) => {
      persistCalls.push(envelope)
    },
    createLivePlayActionChooser: () => async () => ({ type: 'PASS' }),
    startAiTurnPrefetch: () => {},
    setTimeout: (fn) => {
      scheduled.push(fn)
      return scheduled.length
    },
    clearTimeout: (id) => {
      clearedTimerIds.push(id)
    },
    ...overrides.deps,
  })

  return {
    automation,
    match,
    debugMode,
    deferredPostDungeonState,
    matchNeuralLoadGateInFlight,
    gameplayInputLocked,
    previousVisibleState,
    persistCalls,
    enqueueCalls,
    scheduled,
    clearedTimerIds,
    setLifecycleActive: (next) => {
      lifecycleActive = next
    },
  }
}

test('createLiveMatchShellOpponentTurnAutomation exposes concern API shape', () => {
  const { automation } = createAutomation()
  assert.ok(automation.seatRecoveryIndicators)
  assert.equal(typeof automation.chooseNnActionWithRecovery, 'function')
  assert.equal(typeof automation.buildLivePlayChooserDeps, 'function')
  assert.equal(typeof automation.evaluatePageAiTurnPipelineGate, 'function')
  assert.equal(typeof automation.syncMatchStateRecovery, 'function')
  assert.equal(typeof automation.onNnRecoveryChanged, 'function')
  assert.equal(typeof automation.scheduleAiTurnIfReady, 'function')
  assert.equal(typeof automation.runAiTurn, 'function')
  assert.equal(typeof automation.teardownOpponentTurnAutomation, 'function')
  assert.equal(typeof automation.maybeRunHeadlessMatchCompletion, 'function')
  assert.equal(typeof automation.activateMatchStateSubscription, 'function')
  assert.equal(typeof automation.onPresentationGameplayUnlocked, 'function')
})

test('syncMatchStateRecovery builds seat recovery indicators from nn recovery state', () => {
  const { automation, match } = createAutomation({
    deps: {
      nnRecovery: createMockRecovery({
        isRecovering: (modelId) => modelId === 'latest',
      }),
    },
  })

  automation.syncMatchStateRecovery()

  assert.equal(automation.seatRecoveryIndicators.value.length, 2)
  const nnSeat = automation.seatRecoveryIndicators.value.find((entry) => entry.seatId === 'seat-nn')
  assert.equal(nnSeat?.recovering, true)
  assert.equal(nnSeat?.testId, 'neural-seat-recovery-seat-nn')

  match.value = {
    ...match.value,
    state: createMatchState({
      turn: { activeSeatId: 'seat-human', turnNumber: 2 },
    }),
  }
  automation.syncMatchStateRecovery()
  assert.equal(
    automation.seatRecoveryIndicators.value.find((entry) => entry.seatId === 'seat-nn')?.recovering,
    true,
  )
})

test('applySeatRecoveryBlockingTransition cancels prefetch when active seat begins recovering', () => {
  resetAiTurnPrefetch()
  const { automation } = createAutomation({
    deps: {
      nnRecovery: createMockRecovery({
        isRecovering: () => true,
      }),
    },
  })

  automation.syncMatchStateRecovery()

  assert.equal(automation.getAiTurnTimerId(), null)
})

test('evaluatePageAiTurnPipelineGate blocks run on human turn', () => {
  const { automation } = createAutomation({
    deps: {
      getIsHumanTurn: () => true,
    },
  })

  const gate = automation.evaluatePageAiTurnPipelineGate({ runToken: 'token-1' })
  assert.equal(gate.mayRunTurn, false)
  assert.equal(gate.runSkipReason, 'phase-not-actionable')
})

test('scheduleAiTurnIfReady no-ops when lifecycle inactive', () => {
  const { automation, scheduled, setLifecycleActive } = createAutomation()
  setLifecycleActive(false)

  automation.scheduleAiTurnIfReady()

  assert.equal(scheduled.length, 0)
})

test('onNnRecoveryChanged re-schedules when lifecycle active', () => {
  const { automation, scheduled } = createAutomation()
  automation.onNnRecoveryChanged()
  assert.equal(scheduled.length, 1)
})

test('scheduleAiTurnIfReady arms timer when opponent turn may schedule', () => {
  const { automation, scheduled } = createAutomation()

  automation.scheduleAiTurnIfReady()

  assert.equal(scheduled.length, 1)
  assert.equal(typeof scheduled[0], 'function')
})

test('teardownOpponentTurnAutomation clears timer and applied token state', () => {
  const { automation, scheduled } = createAutomation()
  automation.scheduleAiTurnIfReady()
  assert.equal(scheduled.length, 1)

  automation.teardownOpponentTurnAutomation()
  assert.equal(automation.getAiTurnTimerId(), null)
})

test('buildLivePlayChooserDeps includes recovery chooser wiring', () => {
  const { automation } = createAutomation()
  const deps = automation.buildLivePlayChooserDeps()
  assert.equal(typeof deps.chooseNnActionWithRecovery, 'function')
  assert.equal(typeof deps.ensureNnModelsReady, 'function')
  assert.equal(typeof deps.nnRuntimeOptions, 'function')
})

test('bootstrapRecoveryState syncs seat recovery indicators without requiring lifecycle', () => {
  const { automation, match } = createAutomation({
    deps: {
      nnRecovery: createMockRecovery({
        isRecovering: (modelId) => modelId === 'latest',
      }),
    },
  })
  match.value = {
    ...match.value,
    state: createMatchState({
      seats: [
        { id: 'seat-human', role: { type: 'human' } },
        { id: 'seat-nn', role: { type: 'nn', modelId: 'latest' } },
      ],
    }),
  }

  automation.bootstrapRecoveryState()

  assert.equal(
    automation.seatRecoveryIndicators.value.find((entry) => entry.seatId === 'seat-nn')?.recovering,
    true,
  )
})

test('runAiTurn applies opponent action, persists match, and enqueues presentation', async () => {
  const opponentTurn = advanceToOpponentTurn()
  assert.ok(opponentTurn.state, 'expected opponent turn state from replay bootstrap')

  const { automation, match, persistCalls, enqueueCalls, previousVisibleState } = createAutomation({
    deps: {
      getHumanSeatId: () => opponentTurn.humanSeatId,
      getIsHumanTurn: () => false,
      createLivePlayActionChooser:
        () =>
        async ({ state, seatId }) =>
          getLegalActions(state, { seatId })[0],
    },
  })
  match.value = { id: 'match-opponent', state: opponentTurn.state }

  await automation.runAiTurn()

  assert.equal(persistCalls.length, 1)
  assert.equal(enqueueCalls.length, 1)
  assert.notEqual(match.value.state, opponentTurn.state)
  assert.ok(previousVisibleState.value)
})

test('runAiTurn aborts without mutating match when gate blocks', async () => {
  const opponentTurn = advanceToOpponentTurn()
  assert.ok(opponentTurn.state)

  const { automation, match, persistCalls, gameplayInputLocked } = createAutomation({
    deps: {
      getHumanSeatId: () => opponentTurn.humanSeatId,
      getIsHumanTurn: () => false,
    },
  })
  match.value = { id: 'match-blocked', state: opponentTurn.state }
  const turnBefore = match.value.state.turn.turnNumber

  gameplayInputLocked.value = true
  await automation.runAiTurn()

  assert.equal(persistCalls.length, 0)
  assert.equal(match.value.state.turn.turnNumber, turnBefore)
})

test('runAiTurn delegates neural recovery terminal errors to handler', async () => {
  const opponentTurn = advanceToOpponentTurn()
  assert.ok(opponentTurn.state)

  const terminalErrors = []
  const { automation, match, persistCalls } = createAutomation({
    deps: {
      getHumanSeatId: () => opponentTurn.humanSeatId,
      getIsHumanTurn: () => false,
      createLivePlayActionChooser: () => async () => {
        const error = new Error('nn terminal')
        error.terminal = 'REFRESH'
        error.modelId = 'latest'
        throw error
      },
      handleNeuralRecoveryTerminalError: (error) => {
        terminalErrors.push(error)
        return true
      },
    },
  })
  match.value = { id: 'match-terminal', state: opponentTurn.state }

  await automation.runAiTurn()

  assert.equal(terminalErrors.length, 1)
  assert.equal(persistCalls.length, 0)
})

test('scheduled timer callback runs opponent turn when fired', async () => {
  const opponentTurn = advanceToOpponentTurn()
  assert.ok(opponentTurn.state)

  const { automation, match, scheduled, persistCalls } = createAutomation({
    deps: {
      getHumanSeatId: () => opponentTurn.humanSeatId,
      getIsHumanTurn: () => false,
      createLivePlayActionChooser:
        () =>
        async ({ state, seatId }) =>
          getLegalActions(state, { seatId })[0],
    },
  })
  match.value = { id: 'match-scheduled', state: opponentTurn.state }

  automation.scheduleAiTurnIfReady()
  assert.equal(scheduled.length, 1)

  await scheduled[0]()

  assert.equal(persistCalls.length, 1)
  assert.equal(automation.getAiTurnTimerId(), null)
})

test('scheduleAiTurnOnPresentationTick no-ops for deferred post-dungeon state', () => {
  const { automation, scheduled, deferredPostDungeonState } = createAutomation()
  deferredPostDungeonState.value = { phase: MATCH_PHASES.DUNGEON }

  automation.scheduleAiTurnOnPresentationTick()

  assert.equal(scheduled.length, 0)
})

test('scheduleAiTurnOnPresentationTick no-ops while headless completion in flight', () => {
  const { automation, scheduled } = createAutomation({
    deps: {
      getHeadlessCompletionInFlight: () => true,
    },
  })

  automation.scheduleAiTurnOnPresentationTick()

  assert.equal(scheduled.length, 0)
})

test('scheduleAiTurnIfReady clears armed timer when gameplay input locks', () => {
  const { automation, scheduled, clearedTimerIds, gameplayInputLocked } = createAutomation()
  automation.scheduleAiTurnIfReady()
  assert.equal(scheduled.length, 1)
  const timerId = automation.getAiTurnTimerId()
  assert.ok(timerId)

  gameplayInputLocked.value = true
  automation.scheduleAiTurnIfReady()

  assert.equal(clearedTimerIds.includes(timerId), true)
  assert.equal(automation.getAiTurnTimerId(), null)
})

test('resetLastAppliedAiTurnToken clears dedupe gate for the same run token', async () => {
  const opponentTurn = advanceToOpponentTurn()
  assert.ok(opponentTurn.state)

  const runToken = buildAiTurnRunToken({ matchId: 'match-token', state: opponentTurn.state })
  const { automation, match } = createAutomation({
    deps: {
      getHumanSeatId: () => opponentTurn.humanSeatId,
      getIsHumanTurn: () => false,
      createLivePlayActionChooser:
        () =>
        async ({ state, seatId }) =>
          getLegalActions(state, { seatId })[0],
    },
  })
  match.value = { id: 'match-token', state: opponentTurn.state }

  await automation.runAiTurn()
  const gateAfterApply = automation.evaluatePageAiTurnPipelineGate({ runToken })
  assert.equal(gateAfterApply.mayRunTurn, false)
  assert.equal(gateAfterApply.runSkipReason, 'duplicate-token')

  automation.resetLastAppliedAiTurnToken()
  const gateAfterReset = automation.evaluatePageAiTurnPipelineGate({ runToken })
  assert.equal(gateAfterReset.mayRunTurn, true)
})

test('teardownOpponentTurnAutomation resets applied token dedupe state', async () => {
  const opponentTurn = advanceToOpponentTurn()
  assert.ok(opponentTurn.state)

  const runToken = buildAiTurnRunToken({ matchId: 'match-teardown', state: opponentTurn.state })
  const { automation, match } = createAutomation({
    deps: {
      getHumanSeatId: () => opponentTurn.humanSeatId,
      getIsHumanTurn: () => false,
      createLivePlayActionChooser:
        () =>
        async ({ state, seatId }) =>
          getLegalActions(state, { seatId })[0],
    },
  })
  match.value = { id: 'match-teardown', state: opponentTurn.state }

  await automation.runAiTurn()
  automation.teardownOpponentTurnAutomation()

  const gate = automation.evaluatePageAiTurnPipelineGate({ runToken })
  assert.equal(gate.mayRunTurn, true)
})

test('maybeRunHeadlessMatchCompletion delegates to runHeadlessMatchCompletionForPage and syncs label', async () => {
  const runCalls = []
  const syncCalls = []
  const flightGate = {
    inFlight: false,
    tryStart: () => true,
    finish: () => {},
  }
  const orchestrationCtx = { id: 'orchestration-ctx' }

  const { automation, match } = createAutomation({
    deps: {
      getMatchPageOrchestrationCtx: () => orchestrationCtx,
      createHeadlessCompletionFlightGate: () => flightGate,
      syncPresentationLabel: () => {
        syncCalls.push('sync')
      },
      runHeadlessMatchCompletionForPage: async (ctx, options) => {
        runCalls.push({
          ctx,
          match: options.match,
          humanPlayerSeatId: options.humanPlayerSeatId,
          gate: options.gate,
          hasChooseAction: typeof options.chooseAction === 'function',
          hasTeardown: typeof options.teardown === 'function',
        })
        return { kind: 'skipped', reason: 'NOT_NEEDED' }
      },
    },
  })

  const result = await automation.maybeRunHeadlessMatchCompletion()

  assert.equal(runCalls.length, 1)
  assert.equal(runCalls[0].ctx, orchestrationCtx)
  assert.equal(runCalls[0].match, match.value)
  assert.equal(runCalls[0].humanPlayerSeatId, 'seat-human')
  assert.equal(runCalls[0].gate, flightGate)
  assert.equal(runCalls[0].hasChooseAction, true)
  assert.equal(runCalls[0].hasTeardown, true)
  assert.equal(syncCalls.length, 1)
  assert.equal(result.kind, 'skipped')
})

test('teardownForHeadlessMatchCompletion runs when headless flight starts', async () => {
  const teardownCalls = []
  const clearPresentationCalls = []
  const ackCalls = []
  const autoResolveClears = []

  const { automation, deferredPostDungeonState } = createAutomation({
    deps: {
      clearPresentationOrchestrator: () => {
        clearPresentationCalls.push('clear')
      },
      ackDungeonRunForTeardown: (run) => {
        ackCalls.push(run)
      },
      onClearAutoResolveTimer: () => {
        autoResolveClears.push('clear-auto-resolve')
      },
      runHeadlessMatchCompletionForPage: async (_ctx, options) => {
        options.teardown()
        teardownCalls.push('teardown')
        return { kind: 'skipped', reason: 'NOT_NEEDED' }
      },
    },
  })
  deferredPostDungeonState.value = { phase: MATCH_PHASES.DUNGEON }

  await automation.maybeRunHeadlessMatchCompletion()

  assert.equal(teardownCalls.length, 1)
  assert.equal(clearPresentationCalls.length, 1)
  assert.equal(autoResolveClears.length, 1)
  assert.equal(ackCalls.length, 1)
  assert.equal(deferredPostDungeonState.value, null)
})
