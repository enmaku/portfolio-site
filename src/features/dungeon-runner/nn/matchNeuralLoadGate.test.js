import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEURAL_RECOVERY_TERMINAL,
  collectNeuralModelIdsFromSetup,
  resolveNeuralLoadGateSetupTerminal,
  runMatchNeuralLoadGate,
} from './matchNeuralLoadGate.js'

test('collectNeuralModelIdsFromSetup dedupes nn model ids with latest default', () => {
  assert.deepEqual(
    collectNeuralModelIdsFromSetup({
      totalSeats: 4,
      opponents: [
        { type: 'nn', modelId: 'v1.0.0' },
        { type: 'randombot' },
        { type: 'nn' },
      ],
    }),
    ['v1.0.0', 'latest'],
  )
})

test('runMatchNeuralLoadGate succeeds when every nn model loads once', async () => {
  const loads = []
  const result = await runMatchNeuralLoadGate(
    {
      totalSeats: 3,
      opponents: [{ type: 'nn', modelId: 'v1.0.0' }, { type: 'nn', modelId: 'v0.9.0' }],
    },
    {
      loadModel(modelId) {
        loads.push(modelId)
        return Promise.resolve()
      },
    },
  )
  assert.equal(result.ok, true)
  assert.equal(result.terminal, NEURAL_RECOVERY_TERMINAL.NONE)
  assert.deepEqual(loads, ['v1.0.0', 'v0.9.0'])
})

test('runMatchNeuralLoadGate stops on first failed load with SETUP terminal', async () => {
  const loads = []
  const result = await runMatchNeuralLoadGate(
    {
      totalSeats: 3,
      opponents: [{ type: 'nn', modelId: 'missing-model' }, { type: 'nn', modelId: 'v0.9.0' }],
    },
    {
      loadModel(modelId) {
        loads.push(modelId)
        if (modelId === 'missing-model') {
          return Promise.reject(new Error('missing model'))
        }
        return Promise.resolve()
      },
    },
  )
  assert.equal(result.ok, false)
  assert.equal(result.terminal, NEURAL_RECOVERY_TERMINAL.SETUP)
  assert.equal(result.failedModelId, 'missing-model')
  assert.deepEqual(loads, ['missing-model'])
})

test('runMatchNeuralLoadGate skips load attempts when setup has no nn seats', async () => {
  let loadCalls = 0
  const result = await runMatchNeuralLoadGate(
    {
      totalSeats: 2,
      opponents: [{ type: 'randombot' }],
    },
    {
      loadModel() {
        loadCalls += 1
        return Promise.resolve()
      },
    },
  )
  assert.equal(result.ok, true)
  assert.equal(loadCalls, 0)
})

test('resolveNeuralLoadGateSetupTerminal clears match and restores setup snapshot', () => {
  const storage = { removed: false }
  const setupTarget = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const snapshot = {
    totalSeats: 3,
    opponents: [{ type: 'nn', modelId: 'v1.0.0' }, { type: 'randombot' }],
  }
  const result = resolveNeuralLoadGateSetupTerminal({
    storage,
    setupSnapshot: snapshot,
    clearCurrentMatch: (targetStorage) => {
      assert.equal(targetStorage, storage)
      targetStorage.removed = true
    },
    applySetupSnapshot: (target, nextSnapshot) => {
      assert.equal(target, setupTarget)
      assert.deepEqual(nextSnapshot, snapshot)
      target.totalSeats = nextSnapshot.totalSeats
      target.opponents.splice(0, target.opponents.length, ...nextSnapshot.opponents.map((opponent) => ({ ...opponent })))
    },
    setupTarget,
  })
  assert.equal(result.terminal, NEURAL_RECOVERY_TERMINAL.SETUP)
  assert.equal(storage.removed, true)
  assert.deepEqual(setupTarget, snapshot)
})
