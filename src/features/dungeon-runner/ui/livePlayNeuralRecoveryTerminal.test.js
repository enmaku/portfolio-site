import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialMatchState } from '../engine/kernel.js'
import { NeuralRecoveryTerminalError, createChooseNnActionWithRecovery } from '../nn/chooseWithRecovery.js'
import { NN_FAILURE_KIND } from '../nn/runtime.js'
import { createNeuralRuntimeRecoveryCoordinator, NEURAL_RECOVERY_TERMINAL } from '../nn/recovery.js'
import {
  CURRENT_MATCH_SCHEMA_VERSION,
  clearCurrentMatch,
  loadCurrentMatch,
  persistCurrentMatch,
} from '../persistence/currentMatch.js'
import { applySetupSnapshot } from '../setup/state.js'
import { bootstrapCurrentMatchFromStorage } from '../matchPageOrchestration.js'
import { createMatchPageOrchestrationContext } from '../createMatchPageOrchestrationContext.js'
import { handleNeuralRecoveryTerminalOutcome } from '../neuralMatchReadiness.js'
import { createLivePlayActionChooser } from './livePlayActionChooser.js'
import { handleLivePlayNeuralRecoveryTerminalError } from './livePlayNeuralRecoveryTerminal.js'

const NN_SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'nn', modelId: 'latest' }],
}

function createMemoryStorage() {
  /** @type {Record<string, string>} */
  const data = {}
  return {
    getItem(key) {
      return key in data ? data[key] : null
    },
    setItem(key, value) {
      data[key] = value
    },
    removeItem(key) {
      delete data[key]
    },
  }
}

test('handleLivePlayNeuralRecoveryTerminalError persists REFRESH snapshot before refresh UX', async () => {
  const storage = createMemoryStorage()
  const initial = createInitialMatchState(NN_SETUP, { seed: 2050 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-live-refresh',
    setup: NN_SETUP,
    state: initial,
    history: initial.history,
  }
  persistCurrentMatch(storage, match)

  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  const chooser = createLivePlayActionChooser({
    nnRecovery: recovery,
    nnRuntimeOptions: () => ({}),
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction: async () => ({ ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest' }),
      resetRuntimeForModel: () => {},
    }),
  })

  let terminalError = null
  try {
    await chooser({ state: initial, seatId: nnSeat.id })
  } catch (error) {
    terminalError = error
  }
  assert.ok(terminalError instanceof NeuralRecoveryTerminalError)
  assert.equal(terminalError.terminal, NEURAL_RECOVERY_TERMINAL.REFRESH)

  const result = handleLivePlayNeuralRecoveryTerminalError({
    error: terminalError,
    match,
    recovery,
    storage,
    persistCurrentMatch,
    restoreSetup: () => {},
  })

  assert.equal(result.handled, true)
  assert.equal(result.action, 'refresh-dialog')
  assert.equal(
    result.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )

  const loaded = loadCurrentMatch(storage)
  assert.equal(loaded.ok, true)
  assert.equal(
    loaded.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )

  const resumedRecovery = createNeuralRuntimeRecoveryCoordinator()
  const resumed = handleNeuralRecoveryTerminalOutcome({
    kind: 'persisted-snapshot',
    recovery: resumedRecovery,
    neuralRecoveryByModelId: loaded.match.neuralRecoveryByModelId,
    hasMatchSetup: true,
    match: loaded.match,
    restoreSetup: () => {},
  })
  assert.equal(resumed.surfaced, true)
  assert.equal(resumed.action, 'refresh-dialog')
})

test('live-play REFRESH persistence resumes through bootstrap refresh-terminal', async () => {
  const storage = createMemoryStorage()
  const setupTarget = { totalSeats: 2, opponents: [] }
  const initial = createInitialMatchState(NN_SETUP, { seed: 2051 })
  const nnSeat = initial.seats.find((seat) => seat.role.type === 'nn')
  assert.ok(nnSeat)
  const match = {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: 'm-live-bootstrap-refresh',
    setup: NN_SETUP,
    state: initial,
    history: initial.history,
  }
  persistCurrentMatch(storage, match)

  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  const chooser = createLivePlayActionChooser({
    nnRecovery: recovery,
    nnRuntimeOptions: () => ({}),
    chooseNnActionWithRecovery: createChooseNnActionWithRecovery({
      recovery,
      chooseNnAction: async () => ({ ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest' }),
      resetRuntimeForModel: () => {},
    }),
  })

  let terminalError = null
  try {
    await chooser({ state: initial, seatId: nnSeat.id })
  } catch (error) {
    terminalError = error
  }
  assert.ok(terminalError instanceof NeuralRecoveryTerminalError)

  const handled = handleLivePlayNeuralRecoveryTerminalError({
    error: terminalError,
    match,
    recovery,
    storage,
    persistCurrentMatch,
    restoreSetup: () => {},
  })
  assert.equal(handled.handled, true)
  assert.equal(handled.action, 'refresh-dialog')

  const bootstrapRecovery = createNeuralRuntimeRecoveryCoordinator()
  const ctx = createMatchPageOrchestrationContext({
    storage,
    recovery: bootstrapRecovery,
    loadModel: async () => {},
    setMatchNeuralLoadGateInFlight: () => {},
    clearCurrentMatch,
    persistCurrentMatch,
    applySetupSnapshot,
    setupTarget,
    cloneSetup: (setup) => structuredClone(setup),
  })

  const boot = await bootstrapCurrentMatchFromStorage(ctx)
  assert.equal(boot.kind, 'refresh-terminal')
  assert.equal(
    boot.match.neuralRecoveryByModelId.latest.terminal,
    NEURAL_RECOVERY_TERMINAL.REFRESH,
  )
  assert.equal(bootstrapRecovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('handleLivePlayNeuralRecoveryTerminalError returns handled false for non-terminal errors', () => {
  const result = handleLivePlayNeuralRecoveryTerminalError({
    error: new Error('other'),
    match: { setup: NN_SETUP },
    recovery: createNeuralRuntimeRecoveryCoordinator(),
    storage: createMemoryStorage(),
    persistCurrentMatch,
    restoreSetup: () => {},
  })
  assert.equal(result.handled, false)
})
