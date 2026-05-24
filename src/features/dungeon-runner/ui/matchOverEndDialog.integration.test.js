import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import {
  ACTION_TYPES,
  DUNGEON_SUBPHASES,
  MATCH_PHASES,
  applyAction,
  createInitialMatchState,
} from '../engine/kernel.js'
import {
  buildDeferredDungeonOutcomeDisplayState,
  DEFAULT_MAX_HEADLESS_ACTIONS,
  resolveHeadlessCompletionStartState,
  resolveStateAfterDungeonOutcomeContinue,
  runHeadlessMatchCompletion,
} from './headlessMatchCompletionRunner.js'
import {
  getMatchOverEndDialogVariant,
  MATCH_OVER_END_VARIANTS,
  needsHeadlessCompletion,
} from './humanEliminationCompletionPolicy.js'
import { buildMatchOverSummary } from './matchOverSummaryBuilder.js'

const ONE_V_ONE_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'randombot' }],
}

const FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
}

const THREE_PLAYER_SETUP = {
  totalSeats: 3,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }],
}

function seatByRole(state, roleType) {
  return state.seats.find((seat) => seat.role.type === roleType)
}

function survivingOpponentCount(state, humanSeatId) {
  return state.seats.filter(
    (seat) => seat.id !== humanSeatId && !state.scoreboard[seat.id]?.eliminated,
  ).length
}

async function assertMultiSeatLethalEliminationHeadlessEndDialog(setup, seed) {
  const initial = createInitialMatchState(setup, { seed })
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
  assert.equal(eliminated.state.scoreboard[human.id].eliminated, true)
  assert.equal(eliminated.state.scoreboard[human.id].lives, 0)
  assert.equal(eliminated.state.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.ok(survivingOpponentCount(eliminated.state, human.id) >= 2)
  assert.equal(needsHeadlessCompletion(eliminated.state, human.id), true)

  const completion = await runHeadlessMatchCompletion(eliminated.state, {
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(completion.ok, true)
  assert.equal(completion.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(completion.state.matchWinnerSeatId != null, true)
  assert.notEqual(completion.state.matchWinnerSeatId, human.id)

  const variant = getMatchOverEndDialogVariant(completion.state, human.id)
  const summary = buildMatchOverSummary({
    state: completion.state,
    humanPlayerSeatId: human.id,
    seats: completion.state.seats,
  })

  assert.equal(variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.showWinner, false)
  assert.equal(summary.winnerLabel, null)
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

function emptyClearDungeonState(state, runnerSeatId, scoreboardPatch = {}) {
  return {
    ...state,
    phase: MATCH_PHASES.DUNGEON,
    turn: { ...state.turn, activeSeatId: runnerSeatId },
    bidding: { ...state.bidding, runnerSeatId, dungeonMonsters: [] },
    scoreboard: {
      ...state.scoreboard,
      ...scoreboardPatch,
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

test('4-player lethal elimination then headless completion yields elimination-end-human without winner row', async () => {
  await assertMultiSeatLethalEliminationHeadlessEndDialog(FOUR_PLAYER_SETUP, 9001)
})

test('deferred dungeon outcome continue then headless completion yields elimination-end-human', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 9003 })
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
  const prevState = onLastLife
  const eliminated = applyAction(prevState, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(eliminated.ok, true)
  assert.equal(eliminated.state.scoreboard[human.id].eliminated, true)

  const { displayState, deferredState } = buildDeferredDungeonOutcomeDisplayState(
    prevState,
    eliminated.state,
  )
  assert.equal(displayState.phase, MATCH_PHASES.DUNGEON)
  assert.ok(deferredState)
  assert.equal(deferredState.phase, MATCH_PHASES.PICK_ADVENTURER)
  assert.equal(needsHeadlessCompletion(deferredState, human.id), true)

  const continued = resolveStateAfterDungeonOutcomeContinue(displayState, deferredState)
  const start = resolveHeadlessCompletionStartState(continued, human.id)
  const completion = await runHeadlessMatchCompletion(start, {
    chooseAction: async ({ state, seatId }) => chooseRandombotAction(state, { seatId }),
    humanPlayerSeatId: human.id,
    maxActions: DEFAULT_MAX_HEADLESS_ACTIONS,
  })

  assert.equal(completion.ok, true)
  assert.equal(completion.state.phase, MATCH_PHASES.MATCH_OVER)

  const variant = getMatchOverEndDialogVariant(completion.state, human.id)
  const summary = buildMatchOverSummary({
    state: completion.state,
    humanPlayerSeatId: human.id,
    seats: completion.state.seats,
  })
  assert.equal(variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.showWinner, false)
})

test('3-player lethal elimination then headless completion yields elimination-end-human without winner row', async () => {
  await assertMultiSeatLethalEliminationHeadlessEndDialog(THREE_PLAYER_SETUP, 9002)
})

test('1v1 lethal dungeon elimination yields elimination-end-human summary without winner row', () => {
  const initial = createInitialMatchState(ONE_V_ONE_SETUP, { seed: 2001 })
  const human = seatByRole(initial, 'human')
  const opponent = seatByRole(initial, 'randombot')
  assert.ok(human)
  assert.ok(opponent)

  const onLastLife = {
    ...lethalRevealDungeonState(initial, human.id),
    scoreboard: {
      ...initial.scoreboard,
      [human.id]: { ...initial.scoreboard[human.id], lives: 1, eliminated: false },
    },
  }
  const result = applyAction(onLastLife, { type: ACTION_TYPES.REVEAL_OR_CONTINUE }, { seatId: human.id })
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(result.state.matchWinnerSeatId, opponent.id)
  assert.equal(result.state.scoreboard[human.id].eliminated, true)
  assert.equal(result.state.scoreboard[human.id].lives, 0)

  const variant = getMatchOverEndDialogVariant(result.state, human.id)
  const summary = buildMatchOverSummary({
    state: result.state,
    humanPlayerSeatId: human.id,
    seats: result.state.seats,
  })

  assert.equal(variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.showWinner, false)
  assert.equal(summary.winnerLabel, null)
})

test('1v1 opponent two successes while human has lives yields defeat-not-eliminated summary with winner label', () => {
  const initial = createInitialMatchState(ONE_V_ONE_SETUP, { seed: 1 })
  const human = seatByRole(initial, 'human')
  const opponent = seatByRole(initial, 'randombot')
  assert.ok(human)
  assert.ok(opponent)

  const opponentOneWinFromClear = emptyClearDungeonState(initial, opponent.id, {
    [opponent.id]: { ...initial.scoreboard[opponent.id], successes: 1 },
    [human.id]: { ...initial.scoreboard[human.id], lives: 2, eliminated: false },
  })
  const result = applyAction(
    opponentOneWinFromClear,
    { type: ACTION_TYPES.REVEAL_OR_CONTINUE },
    { seatId: opponent.id },
  )
  assert.equal(result.ok, true)
  assert.equal(result.state.phase, MATCH_PHASES.MATCH_OVER)
  assert.equal(result.state.matchWinnerSeatId, opponent.id)
  assert.equal(result.state.scoreboard[opponent.id].successes, 2)
  assert.equal(result.state.scoreboard[human.id].eliminated, false)
  assert.ok((result.state.scoreboard[human.id].lives ?? 0) > 0)

  const variant = getMatchOverEndDialogVariant(result.state, human.id)
  const summary = buildMatchOverSummary({
    state: result.state,
    humanPlayerSeatId: human.id,
    seats: result.state.seats,
  })

  assert.equal(variant, MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED)
  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED)
  assert.equal(summary.showWinner, true)
  assert.equal(summary.winnerLabel, opponent.label)
})
