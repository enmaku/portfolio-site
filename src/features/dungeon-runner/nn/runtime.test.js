import assert from 'node:assert/strict'
import test from 'node:test'
import * as tf from '@tensorflow/tfjs'
import { createInitialMatchState, getLegalActions } from '../engine/kernel.js'
import {
  NN_FAILURE_KIND,
  cacheNnModelForTests,
  chooseNnAction,
  isNnModelCachedForTests,
  resetNnRuntimeForTests,
  resetRuntimeForModel,
} from './runtime.js'

function assertSuccess(result) {
  assert.equal(result?.ok, true)
  return result.action
}

function installPassWorker() {
  const originalWorker = globalThis.Worker
  class FakeWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            action: { type: 'PASS' },
            backend: 'webgl',
            modelId: payload.modelId,
          },
        })
      })
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  return () => {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
}

test('nn runtime returns legal action and records backend metadata', async () => {
  const restore = installPassWorker()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 88 },
    )
    const seatId = state.turn.activeSeatId
    const action = assertSuccess(await chooseNnAction(state, { seatId }, { modelId: 'latest' }))
    const legal = getLegalActions(state, { seatId })
    assert.equal(legal.some((candidate) => candidate.type === action.type), true)
    assert.equal(typeof action.meta?.backend, 'string')
  } finally {
    restore()
  }
})

test('nn runtime returns typed LOAD failure when model unavailable', async () => {
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'missing-model' }] },
    { seed: 89 },
  )
  const seatId = state.turn.activeSeatId
  const result = await chooseNnAction(state, { seatId }, { modelId: 'missing-model' })
  assert.equal(result.ok, false)
  assert.equal(result.kind, NN_FAILURE_KIND.LOAD)
  assert.equal(result.modelId, 'missing-model')
  assert.equal(result.action?.meta?.fallbackReason, undefined)
})

test('nn runtime scheduling preserves deterministic action order', async () => {
  const restore = installPassWorker()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 92 },
    )
    const seatId = state.turn.activeSeatId
    const [a, b] = await Promise.all([
      assertSuccess(await chooseNnAction(state, { seatId }, { modelId: 'latest' })),
      assertSuccess(await chooseNnAction(state, { seatId }, { modelId: 'latest' })),
    ])
    assert.equal(a.type, b.type)
  } finally {
    restore()
  }
})

test('nn runtime supports deterministic sampling override', async () => {
  const restore = installPassWorker()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 77 },
    )
    const seatId = state.turn.activeSeatId
    const actionA = assertSuccess(
      await chooseNnAction(state, { seatId }, { modelId: 'latest', samplingMode: 'deterministic' }),
    )
    const actionB = assertSuccess(
      await chooseNnAction(state, { seatId }, { modelId: 'latest', samplingMode: 'deterministic' }),
    )
    assert.equal(actionA.type, actionB.type)
  } finally {
    restore()
  }
})

test('nn runtime serializes cross-model requests deterministically', async () => {
  const originalWorker = globalThis.Worker
  let inFlight = 0
  let maxInFlight = 0
  class FakeWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      setTimeout(() => {
        inFlight -= 1
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            action: { type: 'PASS' },
            backend: 'webgl',
            modelId: payload.modelId,
          },
        })
      }, 5)
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 103 },
    )
    const seatId = state.turn.activeSeatId
    await Promise.all([
      chooseNnAction(state, { seatId }, { modelId: 'latest' }),
      chooseNnAction(state, { seatId }, { modelId: 'v1.0.0' }),
    ])
    assert.equal(maxInFlight, 1)
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn runtime uses worker path when available', async () => {
  const originalWorker = globalThis.Worker
  let workerUsed = false
  let payloadShapeOk = false
  class FakeWorker {
    constructor() {
      workerUsed = true
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      payloadShapeOk =
        Array.isArray(payload.features) &&
        payload.features.length === 87 &&
        Array.isArray(payload.legalMask) &&
        payload.legalMask.length === 26
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            action: { type: 'PASS' },
            backend: 'webgl',
            modelId: payload.modelId,
          },
        })
      })
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 101 },
    )
    const seatId = state.turn.activeSeatId
    const action = assertSuccess(await chooseNnAction(state, { seatId }, { modelId: 'latest' }))
    assert.equal(workerUsed, true)
    const legal = getLegalActions(state, { seatId })
    assert.equal(legal.some((candidate) => candidate.type === action.type), true)
    assert.equal(action.meta.backend, 'webgl')
    assert.equal(payloadShapeOk, true)
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn runtime returns ILLEGAL_OUTPUT without retrying worker', async () => {
  const originalWorker = globalThis.Worker
  let calls = 0
  class FakeWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      calls += 1
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            action: { type: 'NOT_LEGAL' },
            backend: 'webgl',
            modelId: payload.modelId,
          },
        })
      })
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 104 },
    )
    const seatId = state.turn.activeSeatId
    const result = await chooseNnAction(state, { seatId }, { modelId: 'latest' })
    assert.equal(calls, 1)
    assert.equal(result.ok, false)
    assert.equal(result.kind, NN_FAILURE_KIND.ILLEGAL_OUTPUT)
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn runtime returns INFER failure on worker runtime error without retrying', async () => {
  const originalWorker = globalThis.Worker
  let calls = 0
  class FakeWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage() {
      calls += 1
      queueMicrotask(() => {
        this.onerror?.(new Error('worker inference failed'))
      })
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 106 },
    )
    const seatId = state.turn.activeSeatId
    const result = await chooseNnAction(state, { seatId }, { modelId: 'latest', allowMainThreadInfer: false })
    assert.equal(calls, 1)
    assert.equal(result.ok, false)
    assert.equal(result.kind, NN_FAILURE_KIND.INFER)
    assert.equal(result.modelId, 'latest')
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn stochastic sampling is reproducible for same state and backend', async () => {
  const restore = installPassWorker()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 105 },
    )
    const seatId = state.turn.activeSeatId
    const a = assertSuccess(
      await chooseNnAction(state, { seatId }, { modelId: 'latest', samplingMode: 'stochastic' }),
    )
    const b = assertSuccess(
      await chooseNnAction(state, { seatId }, { modelId: 'latest', samplingMode: 'stochastic' }),
    )
    assert.equal(a.type, b.type)
  } finally {
    restore()
  }
})

test('nn runtime uses policy logits head and keeps dungeon reveal legal', async () => {
  const base = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    { seed: 130 },
  )
  const seatId = base.turn.activeSeatId
  const state = {
    ...base,
    phase: 'dungeon',
    turn: { ...base.turn, activeSeatId: seatId },
    bidding: { ...base.bidding, runnerSeatId: seatId },
    dungeon: {
      ...base.dungeon,
      subphase: 'reveal',
      remainingMonsters: ['goblin'],
      hp: 5,
    },
  }
  const action = assertSuccess(await chooseNnAction(state, { seatId }, { modelId: 'latest' }))
  assert.equal(action.type, 'REVEAL_OR_CONTINUE')
})

test('nn runtime emits debug trace payload when requested', async () => {
  const originalWorker = globalThis.Worker
  const traces = []
  class FakeWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            action: { type: 'PASS' },
            debug: {
              mode: 'policy-26',
              values: [0, 1, 2],
              legalMask: [1, 1, 0],
              selectedIndex: 1,
              features: [0.1, 0.2],
            },
            backend: 'webgl',
            modelId: payload.modelId,
          },
        })
      })
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 150 },
    )
    const seatId = state.turn.activeSeatId
    await chooseNnAction(state, { seatId }, {
      modelId: 'latest',
      debugTrace: true,
      debugLogger: (trace) => traces.push(trace),
    })
    assert.equal(traces.length, 1)
    assert.equal(traces[0].mode, 'policy-26')
    assert.equal(Array.isArray(traces[0].values), true)
    assert.equal(Array.isArray(traces[0].legalMask), true)
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn runtime emits debug trace on model-load failure path', async () => {
  const traces = []
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'missing-model' }] },
    { seed: 151 },
  )
  const seatId = state.turn.activeSeatId
  const result = await chooseNnAction(state, { seatId }, {
    modelId: 'missing-model',
    debugTrace: true,
    debugLogger: (trace) => traces.push(trace),
  })
  assert.equal(result.ok, false)
  assert.equal(traces.length >= 1, true)
  assert.equal(traces.at(-1).kind, 'failure')
  assert.equal(traces.at(-1).failureKind, NN_FAILURE_KIND.LOAD)
})

test('hanging worker times out and returns INFER failure without blocking the inference queue', async () => {
  const originalWorker = globalThis.Worker
  class HangingWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage() {
      // Intentionally never responds.
    }

    terminate() {}
  }
  globalThis.Worker = HangingWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 153 },
    )
    const seatId = state.turn.activeSeatId
    const started = Date.now()
    const result = await chooseNnAction(state, { seatId }, {
      modelId: 'latest',
      workerTimeoutMs: 40,
      loadTimeoutMs: 40,
    })
    const elapsed = Date.now() - started
    assert.equal(result.ok, false)
    assert.equal(result.kind, NN_FAILURE_KIND.INFER)
    assert.ok(elapsed < 500, `expected bounded inference time, got ${elapsed}ms`)
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('worker-side model load errors return LOAD failure not pass actions', async () => {
  const originalWorker = globalThis.Worker
  class FakeWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            error: 'MODEL_LOAD_FAILED',
          },
        })
      })
    }

    terminate() {}
  }
  globalThis.Worker = FakeWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 152 },
    )
    const seatId = state.turn.activeSeatId
    const result = await chooseNnAction(state, { seatId }, { modelId: 'latest', debugTrace: true })
    assert.equal(result.ok, false)
    assert.equal(result.kind, NN_FAILURE_KIND.LOAD)
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('inferBudgetMs returns INFER failure without waiting for slow inference', async () => {
  const originalWorker = globalThis.Worker
  class SlowWorker {
    constructor() {
      this.onmessage = null
      this.onerror = null
    }

    postMessage(payload) {
      setTimeout(() => {
        this.onmessage?.({
          data: {
            requestId: payload.requestId,
            action: { type: 'PASS' },
            backend: 'webgl',
            modelId: payload.modelId,
          },
        })
      }, 500)
    }

    terminate() {}
  }
  globalThis.Worker = SlowWorker
  resetNnRuntimeForTests()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 153 },
    )
    const seatId = state.turn.activeSeatId
    const start = performance.now()
    const result = await chooseNnAction(state, { seatId }, {
      modelId: 'latest',
      inferBudgetMs: 40,
    })
    const elapsed = performance.now() - start
    assert.ok(elapsed < 250, `expected budget cap, got ${elapsed}ms`)
    assert.equal(result.ok, false)
    assert.equal(result.kind, NN_FAILURE_KIND.INFER)
    assert.equal(result.errorMessage, 'INFER_BUDGET_EXCEEDED')
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('resetRuntimeForModel evicts cached model for subsequent loads', () => {
  resetNnRuntimeForTests()
  let disposed = false
  cacheNnModelForTests('latest', { dispose() { disposed = true } })
  assert.equal(isNnModelCachedForTests('latest'), true)
  resetRuntimeForModel('latest')
  assert.equal(disposed, true)
  assert.equal(isNnModelCachedForTests('latest'), false)
})

test('resetRuntimeForModel abandons scheduled inference queue', async () => {
  const restore = installPassWorker()
  try {
    const state = createInitialMatchState(
      { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
      { seed: 202 },
    )
    const seatId = state.turn.activeSeatId
    const pending = chooseNnAction(state, { seatId }, { modelId: 'latest' })
    resetRuntimeForModel('latest')
    const result = assertSuccess(await chooseNnAction(state, { seatId }, { modelId: 'latest' }))
    await pending.catch(() => {})
    assert.equal(result.type, 'PASS')
  } finally {
    restore()
  }
})

test('resetRuntimeForModel can force cpu backend', async () => {
  resetNnRuntimeForTests()
  await tf.setBackend('cpu')
  resetRuntimeForModel('latest', { forceCpu: true })
  assert.equal(tf.getBackend(), 'cpu')
})
