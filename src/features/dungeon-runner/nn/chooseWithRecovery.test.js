import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEURAL_RECOVERY_TERMINAL,
  createNeuralRuntimeRecoveryCoordinator,
} from './recovery.js'
import {
  NeuralRecoveryTerminalError,
  createChooseNnActionWithRecovery,
} from './chooseWithRecovery.js'
import { NN_FAILURE_KIND } from './runtime.js'

function makeRunner(overrides = {}) {
  const recovery = overrides.recovery ?? createNeuralRuntimeRecoveryCoordinator({
    loadMaxAttempts: 3,
    inferMaxAttempts: 3,
  })
  const resetCalls = []
  let chooseImpl = overrides.chooseImpl
  const chooseNnAction = async (state, actor, options) => {
    if (chooseImpl) return chooseImpl(state, actor, options)
    return { ok: true, action: { type: 'DRAW', meta: { modelId: options.modelId } } }
  }
  const onRecoveryBegin = overrides.onRecoveryBegin ?? (() => {})
  const onRecoveryAttempt = overrides.onRecoveryAttempt
  const runner = createChooseNnActionWithRecovery({
    recovery,
    chooseNnAction,
    resetRuntimeForModel: (modelId, options) => {
      resetCalls.push({ modelId, options })
    },
    onRecoveryBegin,
    onRecoveryAttempt,
  })
  return { runner, recovery, resetCalls, setChooseImpl: (fn) => { chooseImpl = fn } }
}

test('chooseWithRecovery returns action on first success without recovery', async () => {
  const { runner } = makeRunner()
  const action = await runner({}, { seatId: 'seat-1' }, { modelId: 'latest' })
  assert.deepEqual(action, { type: 'DRAW', meta: { modelId: 'latest' } })
})

test('chooseWithRecovery retries after load failure until success', async () => {
  const { runner, recovery, resetCalls, setChooseImpl } = makeRunner()
  let attempts = 0
  setChooseImpl(async () => {
    attempts += 1
    if (attempts === 1) {
      return { ok: false, kind: NN_FAILURE_KIND.LOAD, modelId: 'latest', errorMessage: 'MODEL_LOAD_TIMEOUT' }
    }
    return { ok: true, action: { type: 'PASS', meta: { modelId: 'latest' } } }
  })
  const action = await runner({}, { seatId: 'seat-1' }, { modelId: 'latest' })
  assert.equal(action.type, 'PASS')
  assert.equal(recovery.isRecovering('latest'), false)
  assert.equal(resetCalls.length, 1)
})

test('chooseWithRecovery invokes onRecoveryAttempt with backend preference after failure', async () => {
  const attempts = []
  const { runner, setChooseImpl } = makeRunner({
    onRecoveryAttempt: (detail) => attempts.push(detail),
  })
  let calls = 0
  setChooseImpl(async () => {
    calls += 1
    if (calls === 1) {
      return { ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest', errorMessage: 'INFER_FAILED' }
    }
    return { ok: true, action: { type: 'DRAW', meta: { modelId: 'latest' } } }
  })
  await runner({}, { seatId: 'seat-1' }, { modelId: 'latest' })
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].failureKind, NN_FAILURE_KIND.INFER)
  assert.equal(attempts[0].loadAttempts, 0)
  assert.equal(attempts[0].inferAttempts, 1)
  assert.equal(attempts[0].backend, 'webgl')
})

test('chooseWithRecovery throws SETUP terminal after load exhaustion', async () => {
  const { runner, setChooseImpl } = makeRunner()
  setChooseImpl(async () => ({
    ok: false,
    kind: NN_FAILURE_KIND.LOAD,
    modelId: 'latest',
    errorMessage: 'MODEL_LOAD_TIMEOUT',
  }))
  await assert.rejects(
    () => runner({}, { seatId: 'seat-1' }, { modelId: 'latest' }),
    (error) => {
      assert.ok(error instanceof NeuralRecoveryTerminalError)
      assert.equal(error.terminal, NEURAL_RECOVERY_TERMINAL.SETUP)
      assert.equal(error.modelId, 'latest')
      return true
    },
  )
})

test('chooseWithRecovery throws REFRESH terminal after infer exhaustion', async () => {
  const { runner, setChooseImpl } = makeRunner()
  setChooseImpl(async () => ({
    ok: false,
    kind: NN_FAILURE_KIND.INFER,
    modelId: 'latest',
    errorMessage: 'INFER_FAILED',
  }))
  await assert.rejects(
    () => runner({}, { seatId: 'seat-1' }, { modelId: 'latest' }),
    (error) => {
      assert.ok(error instanceof NeuralRecoveryTerminalError)
      assert.equal(error.terminal, NEURAL_RECOVERY_TERMINAL.REFRESH)
      return true
    },
  )
})

test('chooseWithRecovery blocks concurrent calls until recovery completes', async () => {
  const { runner, setChooseImpl } = makeRunner()
  let attempts = 0
  let releaseFirstRetry
  const firstRetryGate = new Promise((resolve) => {
    releaseFirstRetry = resolve
  })
  setChooseImpl(async () => {
    attempts += 1
    if (attempts === 1) {
      return { ok: false, kind: NN_FAILURE_KIND.INFER, modelId: 'latest' }
    }
    if (attempts === 2) {
      await firstRetryGate
      return { ok: true, action: { type: 'ADD_TO_DUNGEON', meta: { modelId: 'latest' } } }
    }
    return { ok: true, action: { type: 'DRAW', meta: { modelId: 'latest' } } }
  })
  const first = runner({}, { seatId: 'seat-1' }, { modelId: 'latest' })
  await Promise.resolve()
  const second = runner({}, { seatId: 'seat-2' }, { modelId: 'latest' })
  releaseFirstRetry()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.type, 'ADD_TO_DUNGEON')
  assert.equal(b.type, 'ADD_TO_DUNGEON')
  assert.equal(attempts, 2)
})

test('chooseWithRecovery calls onRecoveryBegin on first failure', async () => {
  let began = false
  const { runner, setChooseImpl } = makeRunner({
    onRecoveryBegin: () => { began = true },
  })
  let attempts = 0
  setChooseImpl(async () => {
    attempts += 1
    if (attempts === 1) {
      return { ok: false, kind: NN_FAILURE_KIND.LOAD, modelId: 'latest' }
    }
    return { ok: true, action: { type: 'PASS', meta: { modelId: 'latest' } } }
  })
  await runner({}, { seatId: 'seat-1' }, { modelId: 'latest' })
  assert.equal(began, true)
})

test('chooseWithRecovery treats ILLEGAL_OUTPUT as infer failure', async () => {
  const { runner, recovery, setChooseImpl } = makeRunner()
  setChooseImpl(async () => ({
    ok: false,
    kind: NN_FAILURE_KIND.ILLEGAL_OUTPUT,
    modelId: 'latest',
  }))
  await assert.rejects(
    () => runner({}, { seatId: 'seat-1' }, { modelId: 'latest' }),
    (error) => error instanceof NeuralRecoveryTerminalError,
  )
  assert.equal(recovery.getInferAttempts('latest'), 3)
})
