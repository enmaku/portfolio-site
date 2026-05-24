import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import { MATCH_PHASES, createInitialMatchState } from '../engine/kernel.js'
import { createLivePlayActionChooser } from './headlessMatchCompletionRunner.js'

const RANDOMBOT_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'randombot' }],
}

const NN_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'nn', modelId: 'latest' }],
}

function expectedActionType(state, seatId, deps) {
  const seat = state.seats.find((candidate) => candidate.id === seatId)
  const roleType = seat?.role?.type
  if (roleType === 'nn') {
    const modelId = seat.role.modelId ?? 'latest'
    if (state.phase === MATCH_PHASES.PICK_ADVENTURER && !deps.isNnAdventurerPickEnabled()) {
      return chooseRandombotAction(state, { seatId })?.type ?? null
    }
    if (deps.nnFailureRecovery.isCoolingDown(modelId)) {
      return chooseRandombotAction(state, { seatId })?.type ?? null
    }
    return deps.fallbackActionType
  }
  return chooseRandombotAction(state, { seatId })?.type ?? null
}

test('createLivePlayActionChooser matches inline live AI action types for randombot seats', async () => {
  const initial = createInitialMatchState(RANDOMBOT_SETUP, { seed: 21 })
  const bot = initial.seats.find((seat) => seat.role.type === 'randombot')
  assert.ok(bot)
  const deps = {
    nnFailureRecovery: { isCoolingDown: () => false },
    nnRuntimeOptions: () => ({}),
    isNnAdventurerPickEnabled: () => true,
    fallbackActionType: 'PASS',
  }
  const chooser = createLivePlayActionChooser(deps)
  const action = await chooser({ state: initial, seatId: bot.id })
  assert.equal(action?.type ?? null, expectedActionType(initial, bot.id, deps))
})

test('createLivePlayActionChooser matches inline live AI action types when nn is cooling down', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 22 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const deps = {
    nnFailureRecovery: { isCoolingDown: () => true },
    nnRuntimeOptions: () => ({}),
    isNnAdventurerPickEnabled: () => true,
    fallbackActionType: 'PASS',
  }
  const chooser = createLivePlayActionChooser(deps)
  const action = await chooser({ state: initial, seatId: nnSeat.id })
  assert.equal(action?.type ?? null, expectedActionType(initial, nnSeat.id, deps))
})

test('createLivePlayActionChooser matches inline live AI action types on nn pick-adventurer when pick disabled', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 23 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const pickState = {
    ...initial,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    turn: { ...initial.turn, activeSeatId: nnSeat.id },
    pickAdventurer: { ...initial.pickAdventurer, activeSeatId: nnSeat.id },
  }
  const deps = {
    nnFailureRecovery: { isCoolingDown: () => false },
    nnRuntimeOptions: () => ({}),
    isNnAdventurerPickEnabled: () => false,
    fallbackActionType: 'PASS',
  }
  const chooser = createLivePlayActionChooser(deps)
  const action = await chooser({ state: pickState, seatId: nnSeat.id })
  assert.equal(action?.type ?? null, expectedActionType(pickState, nnSeat.id, deps))
})

test('createLivePlayActionChooser matches inline live AI action types on nn inference path', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 24 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const deps = {
    nnFailureRecovery: { isCoolingDown: () => false },
    nnRuntimeOptions: () => ({}),
    isNnAdventurerPickEnabled: () => true,
    fallbackActionType: 'DRAW',
  }
  const chooser = createLivePlayActionChooser({
    ...deps,
    chooseNnAction: async () => ({ type: deps.fallbackActionType }),
  })
  const action = await chooser({ state: initial, seatId: nnSeat.id })
  assert.equal(action?.type ?? null, expectedActionType(initial, nnSeat.id, deps))
})
