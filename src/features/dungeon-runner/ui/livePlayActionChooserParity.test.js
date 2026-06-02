import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import { MATCH_PHASES, createInitialMatchState } from '../engine/kernel.js'
import { createNeuralRuntimeRecoveryCoordinator } from '../nn/recovery.js'
import { NeuralRecoveryTerminalError, createChooseNnActionWithRecovery } from '../nn/chooseWithRecovery.js'
import { NEURAL_RECOVERY_TERMINAL } from '../nn/recovery.js'
import { createLivePlayActionChooser } from './headlessMatchCompletionRunner.js'

const RANDOMBOT_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'randombot' }],
}

const NN_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'nn', modelId: 'latest' }],
}

function parityDeps(overrides = {}) {
  const nnRecovery = overrides.nnRecovery ?? createNeuralRuntimeRecoveryCoordinator()
  return {
    nnRecovery,
    nnRuntimeOptions: overrides.nnRuntimeOptions ?? (() => ({})),
    isNnAdventurerPickEnabled: overrides.isNnAdventurerPickEnabled ?? (() => true),
    chooseNnActionWithRecovery: overrides.chooseNnActionWithRecovery ?? createChooseNnActionWithRecovery({
      recovery: nnRecovery,
      chooseNnAction: overrides.chooseNnAction ?? (async () => ({
        ok: true,
        action: { type: overrides.fallbackActionType ?? 'PASS', meta: { modelId: 'latest' } },
      })),
      resetRuntimeForModel: () => {},
    }),
  }
}

test('createLivePlayActionChooser matches inline live AI action types for randombot seats', async () => {
  const initial = createInitialMatchState(RANDOMBOT_SETUP, { seed: 21 })
  const bot = initial.seats.find((seat) => seat.role.type === 'randombot')
  assert.ok(bot)
  const chooser = createLivePlayActionChooser(parityDeps())
  const action = await chooser({ state: initial, seatId: bot.id })
  assert.deepEqual(action, chooseRandombotAction(initial, { seatId: bot.id }))
})

test('createLivePlayActionChooser propagates terminal error when nn recovery exhausts', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 22 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const chooser = createLivePlayActionChooser(parityDeps({
    chooseNnActionWithRecovery: async () => {
      throw new NeuralRecoveryTerminalError(NEURAL_RECOVERY_TERMINAL.REFRESH, 'latest')
    },
  }))
  await assert.rejects(
    () => chooser({ state: initial, seatId: nnSeat.id }),
    (error) => error instanceof NeuralRecoveryTerminalError,
  )
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
  const chooser = createLivePlayActionChooser(parityDeps({
    isNnAdventurerPickEnabled: () => false,
  }))
  const action = await chooser({ state: pickState, seatId: nnSeat.id })
  assert.deepEqual(action, chooseRandombotAction(pickState, { seatId: nnSeat.id }))
})

test('createLivePlayActionChooser matches inline live AI action types on nn inference path', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 24 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const deps = parityDeps({ fallbackActionType: 'DRAW' })
  const chooser = createLivePlayActionChooser(deps)
  const action = await chooser({ state: initial, seatId: nnSeat.id })
  assert.equal(action?.type, 'DRAW')
})
