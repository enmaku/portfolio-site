import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRandombotAction } from '../bots/randombot.js'
import { MATCH_PHASES, createInitialMatchState } from '../engine/kernel.js'
import { NeuralRecoveryTerminalError, createChooseNnActionWithRecovery } from '../nn/chooseWithRecovery.js'
import { NN_FAILURE_KIND } from '../nn/runtime.js'
import { createNeuralRuntimeRecoveryCoordinator, NEURAL_RECOVERY_TERMINAL } from '../nn/recovery.js'
import { createLivePlayActionChooser } from './livePlayActionChooser.js'

const FOUR_PLAYER_SETUP = {
  totalSeats: 4,
  opponents: [{ type: 'randombot' }, { type: 'randombot' }, { type: 'randombot' }],
}

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

test('createLivePlayActionChooser matches randombot for randombot seats', async () => {
  const initial = createInitialMatchState(FOUR_PLAYER_SETUP, { seed: 11 })
  const bot = initial.seats.find((seat) => seat.role.type === 'randombot')
  assert.ok(bot)
  const chooser = createLivePlayActionChooser(liveChooserDeps())
  const action = await chooser({ state: initial, seatId: bot.id })
  assert.deepEqual(action, chooseRandombotAction(initial, { seatId: bot.id }))
})

test('createLivePlayActionChooser propagates terminal error instead of randombot on nn failure', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 12 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    chooseNnActionWithRecovery: async () => {
      throw new NeuralRecoveryTerminalError(NEURAL_RECOVERY_TERMINAL.REFRESH, 'latest')
    },
  }))
  await assert.rejects(
    () => chooser({ state: initial, seatId: nnSeat.id }),
    (error) => error instanceof NeuralRecoveryTerminalError,
  )
})

test('createLivePlayActionChooser blocks concurrent nn calls while recovery is in flight', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 120 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let attempts = 0
  let releaseRetry
  const retryGate = new Promise((resolve) => { releaseRetry = resolve })
  const chooseNnAction = async () => {
    attempts += 1
    if (attempts === 1) {
      return { ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest' }
    }
    await retryGate
    return { ok: true, action: { type: 'DRAW', meta: { modelId: 'latest' } } }
  }
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    nnRecovery: recovery,
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction,
      resetRuntimeForModel: () => {},
    }),
  }))
  const first = chooser({ state: initial, seatId: nnSeat.id })
  await Promise.resolve()
  const second = chooser({ state: initial, seatId: nnSeat.id })
  releaseRetry()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.type, 'DRAW')
  assert.equal(b.type, 'DRAW')
  assert.equal(attempts, 2)
})

test('createLivePlayActionChooser never returns randombot on nn infer failure', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 121 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const randombotAction = chooseRandombotAction(initial, { seatId: nnSeat.id })
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    chooseNnActionWithRecovery: async () => {
      throw new NeuralRecoveryTerminalError(NEURAL_RECOVERY_TERMINAL.REFRESH, 'latest', {
        failureKind: NN_FAILURE_KIND.INFER,
      })
    },
  }))
  await assert.rejects(
    () => chooser({ state: initial, seatId: nnSeat.id }),
    (error) => {
      assert.ok(error instanceof NeuralRecoveryTerminalError)
      assert.notDeepEqual(error, randombotAction)
      return true
    },
  )
})

test('createLivePlayActionChooser uses randombot on pick-adventurer when nn pick flag is off', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 13 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const pickState = {
    ...initial,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    turn: { ...initial.turn, activeSeatId: nnSeat.id },
    pickAdventurer: { ...initial.pickAdventurer, activeSeatId: nnSeat.id },
  }
  let nnCalled = false
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    isNnAdventurerPickEnabled: () => false,
    chooseNnActionWithRecovery: async () => {
      nnCalled = true
      return { type: 'PASS' }
    },
  }))
  const action = await chooser({ state: pickState, seatId: nnSeat.id })
  assert.deepEqual(action, chooseRandombotAction(pickState, { seatId: nnSeat.id }))
  assert.equal(nnCalled, false)
})

test('createLivePlayActionChooser uses nn path when model ready and pick enabled', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 14 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const pickState = {
    ...initial,
    phase: MATCH_PHASES.PICK_ADVENTURER,
    turn: { ...initial.turn, activeSeatId: nnSeat.id },
    pickAdventurer: { ...initial.pickAdventurer, activeSeatId: nnSeat.id },
  }
  let nnCallCount = 0
  let lastNnOptions = null
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    nnRuntimeOptions: () => ({ modelId: 'latest', samplingMode: 'greedy' }),
    isNnAdventurerPickEnabled: () => true,
    chooseNnActionWithRecovery: async (state, actor, options) => {
      nnCallCount += 1
      lastNnOptions = options
      return { type: 'PASS' }
    },
  }))
  const action = await chooser({ state: pickState, seatId: nnSeat.id })
  assert.equal(nnCallCount, 1)
  assert.deepEqual(lastNnOptions, { modelId: 'latest', samplingMode: 'greedy' })
  assert.equal(action.type, 'PASS')
})

test('createLivePlayActionChooser consumes prefetch before nn inference', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 99 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  let nnCalled = false
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    chooseNnActionWithRecovery: async () => {
      nnCalled = true
      return { type: 'PASS' }
    },
    tryConsumePrefetch: async () => ({ type: 'DRAW' }),
  }))
  const action = await chooser({ state: initial, seatId: nnSeat.id, runToken: 'token-a' })
  assert.equal(action.type, 'DRAW')
  assert.equal(nnCalled, false)
})

test('createLivePlayActionChooser skips prefetch while model is recovering', async () => {
  const initial = createInitialMatchState(NN_SETUP, { seed: 100 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')
  let prefetchConsumed = false
  const chooser = createLivePlayActionChooser(liveChooserDeps({
    nnRecovery: recovery,
    tryConsumePrefetch: async () => {
      prefetchConsumed = true
      return { type: 'DRAW' }
    },
    chooseNnActionWithRecovery: async () => ({ type: 'PASS' }),
  }))
  const action = await chooser({ state: initial, seatId: nnSeat.id, runToken: 'token-a' })
  assert.equal(prefetchConsumed, false)
  assert.equal(action.type, 'PASS')
})
