import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import {
  ACTION_TYPES,
  DUNGEON_SUBPHASES,
  MATCH_PHASES,
  applyAction,
  createInitialMatchState,
  getLegalActions,
} from '../engine/kernel.js'
import {
  getMatchOverEndDialogVariant,
  MATCH_OVER_END_VARIANTS,
  needsHeadlessCompletion,
} from './humanEliminationCompletionPolicy.js'
import { buildMatchOverSummary } from './matchOverSummaryBuilder.js'
import {
  buildDeferredDungeonOutcomeDisplayState,
  createHeadlessCompletionFlightGate,
  DEFAULT_MAX_HEADLESS_ACTIONS,
  HEADLESS_COMPLETION_ERROR_CODES,
  resolveHeadlessCompletionStartState,
  resolveStateAfterDungeonOutcomeContinue,
  runContinueFromDeferredThenHeadlessCompletion,
  runHeadlessMatchCompletion,
  canContinueFromDungeonOutcome,
  shouldAutoContinueDeferredDungeonExit,
  shouldBlockLiveAiPipelineWhileHeadless,
  shouldDeferDungeonExitUntilOutcomeAck,
  shouldShowFinishingMatchOverlay,
} from './headlessMatchCompletionRunner.js'
import { createLivePlayActionChooser } from './livePlayActionChooser.js'
import {
  NEURAL_RECOVERY_TERMINAL,
  createNeuralRuntimeRecoveryCoordinator,
} from '../nn/recovery.js'
import { NeuralRecoveryTerminalError, createChooseNnActionWithRecovery } from '../nn/chooseWithRecovery.js'
import { NN_FAILURE_KIND } from '../nn/runtime.js'

const FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
}

function seatByRole(state, roleType) {
  return state.seats.find((seat) => seat.role.type === roleType)
}

function humanEliminatedBeforeMatchOver(state, humanSeatId) {
  const opponent = state.seats.find(
    (seat) => seat.id !== humanSeatId && !state.scoreboard[seat.id]?.eliminated,
  )
  assert.ok(opponent)
  return {
    ...state,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    scoreboard: {
      ...state.scoreboard,
      [humanSeatId]: {
        ...state.scoreboard[humanSeatId],
        lives: 0,
        eliminated: true,
        successes: 0,
      },
    },
    turn: { ...state.turn, activeSeatId: opponent.id, turnNumber: state.turn.turnNumber + 1 },
    pickAdventurer: {
      ...state.pickAdventurer,
      activeSeatId: opponent.id,
    },
  }
}

function lethalRevealDungeonState(state, runnerSeatId) {
  return {
    ...state,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...state.turn, activeSeatId: runnerSeatId },
    bidding: { ...state.bidding, runnerSeatId, dungeonMonsters: ['dragon'] },
    dungeon: {
      ...state.dungeon,
      subphase: DUNGEON_SUBPHASES.REVEAL,
      currentMonster: null,
      remainingMonsters: ['dragon'],
      hp: 3,
      inPlayEquipmentIds: ['W_VORPAL'],
      discardedRunMonsters: [],
      polySpent: true,
      axeSpent: true,
    },
  }
}

const ONE_V_ONE_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'randombot' }],
}

function secondSuccessMatchWinDungeonState(state, runnerSeatId) {
  return {
    ...state,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...state.turn, activeSeatId: runnerSeatId },
    bidding: { ...state.bidding, runnerSeatId, dungeonMonsters: [] },
    scoreboard: {
      ...state.scoreboard,
      [runnerSeatId]: { ...state.scoreboard[runnerSeatId], successes: 1 },
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
}

test('runHeadlessMatchCompletion reaches match over with injected randombot chooser on multi-seat setup', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 4242 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedBeforeMatchOver(initial, human.id)
  assert.equal(needsHeadlessCompletion(start, human.id), true)

  const chooseAction = async ({ state, seatId }) => chooseRandombotAction(state, { seatId })

  const result = await runHeadlessMatchCompletion(start, {
    chooseAction,
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(result.state.matchWinnerSeatId != null, true)
  assert.equal(result.state.scoreboard[human.id].eliminated, true)
  assert.ok(result.actionCount > 0)
  assert.equal(result.errorCode, undefined)
})

test('runHeadlessMatchCompletion auto-acks deferred dungeon exit without leaving dungeon phase stuck', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9001 })
  const human = seatByRole(initial, 'human')
  const opponent = initial.seats.find((seat) => seat.role.type === 'randombot' && seat.id !== human.id)
  assert.ok(human)
  assert.ok(opponent)

  const onLastLife = {
    ...lethalRevealDungeonState(initial, human.id),
    scoreboard: {
      ...initial.scoreboard,
      [human.id]: { ...initial.scoreboard[human.id], lives: 1, eliminated: false },
      [opponent.id]: { ...initial.scoreboard[opponent.id], eliminated: false },
    },
    turn: { ...initial.turn, activeSeatId: human.id },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  assert.equal(eliminated.state.scoreboard[human.id].eliminated, true)
  assert.equal(eliminated.state.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(needsHeadlessCompletion(eliminated.state, human.id), true)

  const result = await runHeadlessMatchCompletion(eliminated.state, {
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
})

test('resolveHeadlessCompletionStartState promotes deferred dungeon display to pick-adventurer', () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9001 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const onLastLife = lethalRevealDungeonState(initial, human.id)
  onLastLife.scoreboard = {
    ...onLastLife.scoreboard,
    [human.id]: { ...onLastLife.scoreboard[human.id], lives: 1, eliminated: false },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  const persistedDeferred = { ...eliminated.state, phase: MATCH_PHASES.DUNGEON }

  const resolved = resolveHeadlessCompletionStartState(persistedDeferred, human.id)
  assert.equal(resolved.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(resolved.turn.activeSeatId, eliminated.state.turn.activeSeatId)
})

test('runHeadlessMatchCompletion reaches match over from reloaded deferred dungeon display', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9001 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const onLastLife = lethalRevealDungeonState(initial, human.id)
  onLastLife.scoreboard = {
    ...onLastLife.scoreboard,
    [human.id]: { ...onLastLife.scoreboard[human.id], lives: 1, eliminated: false },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  const start = resolveHeadlessCompletionStartState(
    { ...eliminated.state, phase: MATCH_PHASES.DUNGEON },
    human.id,
  )

  const result = await runHeadlessMatchCompletion(start, {
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
})

test('buildDeferredDungeonOutcomeDisplayState defers pick-adventurer behind dungeon phase', () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9001 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const onLastLife = lethalRevealDungeonState(initial, human.id)
  onLastLife.scoreboard = {
    ...onLastLife.scoreboard,
    [human.id]: { ...onLastLife.scoreboard[human.id], lives: 1, eliminated: false },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  const { displayState, deferredState } = buildDeferredDungeonOutcomeDisplayState(onLastLife, eliminated.state)
  assert.equal(displayState.phase, MATCH_PHASES.DUNGEON)
  assert.equal(deferredState?.phase, MATCH_PHASES.PICK_ADVENTURER)
  const continued = resolveStateAfterDungeonOutcomeContinue(displayState, deferredState)
  assert.equal(continued.phase, MATCH_PHASES.PICK_ADVENTURER)
})

test('shouldDeferDungeonExitUntilOutcomeAck is true for dungeon to match-over', () => {
  const initial = createInitialMatchState(ONE_V_ONE_SETUP, { seed: 1 })
  const runnerId = initial.seats[0].id
  const almostWon = secondSuccessMatchWinDungeonState(initial, runnerId)
  const result = applyAction(almostWon, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: runnerId })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(shouldDeferDungeonExitUntilOutcomeAck(almostWon, result.state), true)
})

test('buildDeferredDungeonOutcomeDisplayState defers match-over behind dungeon phase', () => {
  const initial = createInitialMatchState(ONE_V_ONE_SETUP, { seed: 1 })
  const runnerId = initial.seats[0].id
  const almostWon = secondSuccessMatchWinDungeonState(initial, runnerId)
  const result = applyAction(almostWon, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: runnerId })
  assert.equal(result.ok, true)
  const { displayState, deferredState } = buildDeferredDungeonOutcomeDisplayState(almostWon, result.state)
  assert.equal(displayState.phase, MATCH_PHASES.DUNGEON)
  assert.equal(deferredState?.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(deferredState?.matchWinnerSeatId, runnerId)
  const continued = resolveStateAfterDungeonOutcomeContinue(displayState, deferredState)
  assert.equal(continued.phase, MATCH_PHASES.MATCH_OVER)
})

test('shouldAutoContinueDeferredDungeonExit skips pick-adventurer exits that need dungeon-outcome ack', () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9001 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const onLastLife = lethalRevealDungeonState(initial, human.id)
  onLastLife.scoreboard = {
    ...onLastLife.scoreboard,
    [human.id]: { ...onLastLife.scoreboard[human.id], lives: 1, eliminated: false },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  const { deferredState } = buildDeferredDungeonOutcomeDisplayState(onLastLife, eliminated.state)
  assert.equal(
    shouldAutoContinueDeferredDungeonExit({
      deferredPostDungeonState: deferredState,
      lastDungeonRun: eliminated.state.lastDungeonRun,
    }),
    false,
  )
})

test('shouldAutoContinueDeferredDungeonExit auto-continues deferred match-over without lastDungeonRun', () => {
  const initial = createInitialMatchState(ONE_V_ONE_SETUP, { seed: 1 })
  const runnerId = initial.seats[0].id
  const almostWon = secondSuccessMatchWinDungeonState(initial, runnerId)
  const result = applyAction(almostWon, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: runnerId })
  assert.equal(result.ok, true)
  const { deferredState } = buildDeferredDungeonOutcomeDisplayState(almostWon, result.state)
  assert.equal(
    shouldAutoContinueDeferredDungeonExit({
      deferredPostDungeonState: deferredState,
      lastDungeonRun: result.state.lastDungeonRun,
    }),
    true,
  )
})

test('canContinueFromDungeonOutcome allows deferred match-over without lastDungeonRun', () => {
  const initial = createInitialMatchState(ONE_V_ONE_SETUP, { seed: 1 })
  const runnerId = initial.seats[0].id
  const almostWon = secondSuccessMatchWinDungeonState(initial, runnerId)
  const result = applyAction(almostWon, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: runnerId })
  assert.equal(result.ok, true)
  const { deferredState } = buildDeferredDungeonOutcomeDisplayState(almostWon, result.state)
  assert.equal(result.state.lastDungeonRun, null)
  assert.equal(
    canContinueFromDungeonOutcome({
      lastDungeonRun: result.state.lastDungeonRun,
      deferredPostDungeonState: deferredState,
    }),
    true,
  )
  const continued = resolveStateAfterDungeonOutcomeContinue(
    buildDeferredDungeonOutcomeDisplayState(almostWon, result.state).displayState,
    deferredState,
  )
  assert.equal(continued.phase, MATCH_PHASES.MATCH_OVER)
})

test('headless completion appends actions to state history through match over', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 4242 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedBeforeMatchOver(initial, human.id)
  const historyBefore = start.history.length
  assert.equal(needsHeadlessCompletion(start, human.id), true)

  const result = await runHeadlessMatchCompletion(start, {
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.ok(result.state.history.length > historyBefore)
  assert.ok(result.actionCount > 0)
  assert.equal(result.state.history.length, historyBefore + result.actionCount)
})

function survivingOpponentCount(state, humanSeatId) {
  return state.seats.filter(
    (seat) => seat.id !== humanSeatId && !state.scoreboard[seat.id]?.eliminated,
  ).length
}

function buildFourPlayerDeferredEliminationContinue(seed) {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const onLastLife = {
    ...lethalRevealDungeonState(initial, human.id),
    scoreboard: {
      ...initial.scoreboard,
      [human.id]: { ...initial.scoreboard[human.id], lives: 1, eliminated: false },
    },
    turn: { ...initial.turn, activeSeatId: human.id },
  }
  const eliminated = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  const { displayState, deferredState } = buildDeferredDungeonOutcomeDisplayState(onLastLife, eliminated.state)
  assert.equal(displayState.phase, MATCH_PHASES.DUNGEON)
  assert.ok(deferredState)
  assert.ok(survivingOpponentCount(deferredState, human.id) >= 2)
  assert.equal(needsHeadlessCompletion(deferredState, human.id), true)
  return { human, displayState, deferredState }
}

test('continue from deferred dungeon runs headless orchestration with overlay flight semantics', async () => {
  const { human, displayState, deferredState } = buildFourPlayerDeferredEliminationContinue(9003)
  const gate = createHeadlessCompletionFlightGate()
  const chooseAction = async ({ state, seatId }) => chooseRandombotAction(state, { seatId })
  let sawOverlayDuringRun = false

  const completion = await runContinueFromDeferredThenHeadlessCompletion({
    displayedState: displayState,
    deferredPostDungeonState: deferredState,
    humanPlayerSeatId: human.id,
    chooseAction,
    gate,
    afterFlightStart: () => {
      assert.equal(gate.inFlight, true)
      assert.equal(shouldShowFinishingMatchOverlay(gate.inFlight), true)
      assert.equal(shouldBlockLiveAiPipelineWhileHeadless(gate.inFlight), true)
      sawOverlayDuringRun = true
    },
  })

  assert.equal(sawOverlayDuringRun, true)
  assert.equal(gate.inFlight, false)
  assert.equal(shouldShowFinishingMatchOverlay(gate.inFlight), false)
  assert.equal(completion.ran, true)
  assert.equal(completion.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(getMatchOverEndDialogVariant(completion.state, human.id), MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  const summary = buildMatchOverSummary({
    state: completion.state,
    humanPlayerSeatId: human.id,
    seats: completion.state.seats,
  })
  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.showWinner, false)
})

test('headless orchestration skips duplicate start while in flight', async () => {
  const { human, displayState, deferredState } = buildFourPlayerDeferredEliminationContinue(9004)
  const gate = createHeadlessCompletionFlightGate()
  assert.equal(gate.tryStart(), true)
  const blocked = await runContinueFromDeferredThenHeadlessCompletion({
    displayedState: displayState,
    deferredPostDungeonState: deferredState,
    humanPlayerSeatId: human.id,
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    gate,
  })
  assert.equal(blocked.ran, false)
  assert.equal(blocked.skippedReason, 'IN_FLIGHT')
  gate.finish()
})

const NN_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'nn', modelId: 'latest' }],
}

function liveChooserDeps(overrides = {}) {
  return {
    nnRecovery: overrides.nnRecovery ?? createNeuralRuntimeRecoveryCoordinator(),
    nnRuntimeOptions: overrides.nnRuntimeOptions ?? (() => ({})),
    isNnAdventurerPickEnabled: overrides.isNnAdventurerPickEnabled ?? (() => true),
    chooseNnActionWithRecovery: overrides.chooseNnActionWithRecovery,
    tryConsumePrefetch: overrides.tryConsumePrefetch,
    onRecoveryBegin: overrides.onRecoveryBegin,
  }
}

test('runHeadlessMatchCompletion propagates nn load terminal without randombot fallback', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 500 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedBeforeMatchOver(initial, human.id)
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 1 })
  const chooseAction = createLivePlayActionChooser(liveChooserDeps({
    nnRecovery: recovery,
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction: async () => ({ ok: false, kind: NN_FAILURE_KIND.LOAD, modelId: 'latest' }),
      resetRuntimeForModel: () => {},
    }),
  }))
  await assert.rejects(
    () => runHeadlessMatchCompletion(start, {
      chooseAction,
      humanPlayerSeatId: human.id,
      maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
    }),
    (error) => error instanceof NeuralRecoveryTerminalError && error.terminal === NEURAL_RECOVERY_TERMINAL.SETUP,
  )
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.SETUP)
})

test('runHeadlessMatchCompletion propagates nn infer terminal without randombot fallback', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 501 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedBeforeMatchOver(initial, human.id)
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  const chooseAction = createLivePlayActionChooser(liveChooserDeps({
    nnRecovery: recovery,
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction: async () => ({ ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest' }),
      resetRuntimeForModel: () => {},
    }),
  }))
  await assert.rejects(
    () => runHeadlessMatchCompletion(start, {
      chooseAction,
      humanPlayerSeatId: human.id,
      maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
    }),
    (error) => error instanceof NeuralRecoveryTerminalError,
  )
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
})

const NN_FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'nn', modelId: 'latest' }, { type: 'randombot' }, { type: 'randombot' }],
}

test('runHeadlessMatchCompletion reaches match over with nn recovery chooser on success', async () => {
  const initial = createInitialMatchState(NN_FOUR_PLAYER_SETUP, { seed: 502 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const start = humanEliminatedBeforeMatchOver(initial, human.id)
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const chooseAction = createLivePlayActionChooser(liveChooserDeps({
    nnRecovery: recovery,
    chooseNnActionWithRecovery: async (state, actor) =>
      chooseRandombotAction(state, { seatId: actor.seatId }),
  }))
  const result = await runHeadlessMatchCompletion(start, {
    chooseAction,
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
})

test('runHeadlessMatchCompletion fails closed when safety cap exceeded', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 1 })
  const human = seatByRole(initial, 'human')
  assert.ok(human)
  const opponent = initial.seats.find((seat) => seat.role.type === 'randombot')
  assert.ok(opponent)
  const start = {
    ...initial,
    turn: { ...initial.turn, activeSeatId: opponent.id },
  }

  const chooseAction = async ({ state, seatId }) => {
    const legal = getLegalActions(state, { seatId })
    return legal[0] ?? null
  }

  const result = await runHeadlessMatchCompletion(start, {
    chooseAction,
    humanPlayerSeatId: human.id,
    maxActions: 3,
  })

  assert.equal(result.ok, false)
  assert.equal(result.errorCode, HEADLESS_COMPLETION_ERROR_CODES.SAFETY_CAP)
  assert.equal(result.state.phase !== MATCH_PHASES.MATCH_OVER, true)
  assert.equal(result.actionCount, 3)
})
