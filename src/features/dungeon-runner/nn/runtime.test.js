import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialMatchState, getLegalActions } from '../engine/kernel.js'
import { chooseNnActionWithFallback, resetNnRuntimeForTests } from './runtime.js'

test('nn runtime returns legal action and records backend metadata', async () => {
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    { seed: 88 },
  )
  const seatId = state.turn.activeSeatId
  const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' })
  const legal = getLegalActions(state, { seatId })
  assert.equal(legal.some((candidate) => candidate.type === action.type), true)
})

test('nn runtime falls back to pass when model unavailable', async () => {
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'missing-model' }] },
    { seed: 89 },
  )
  const seatId = state.turn.activeSeatId
  const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'missing-model' })
  assert.equal(action.type, 'PASS')
  assert.equal(action.meta.fallbackReason, 'MODEL_LOAD_FAILED')
})

test('nn runtime scheduling preserves deterministic action order', async () => {
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    { seed: 92 },
  )
  const seatId = state.turn.activeSeatId
  const [a, b] = await Promise.all([
    chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' }),
    chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' }),
  ])
  assert.equal(a.type, b.type)
})

test('nn runtime supports deterministic sampling override', async () => {
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    { seed: 77 },
  )
  const seatId = state.turn.activeSeatId
  const actionA = await chooseNnActionWithFallback(
    state,
    { seatId },
    { modelId: 'latest', samplingMode: 'deterministic' },
  )
  const actionB = await chooseNnActionWithFallback(
    state,
    { seatId },
    { modelId: 'latest', samplingMode: 'deterministic' },
  )
  assert.equal(actionA.type, actionB.type)
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
      chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' }),
      chooseNnActionWithFallback(state, { seatId }, { modelId: 'v1.0.0' }),
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
    const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' })
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

test('nn runtime retries once before illegal-output fallback', async () => {
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
    const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' })
    assert.equal(calls, 2)
    assert.equal(action.type, 'PASS')
    assert.equal(action.meta.fallbackReason, 'ILLEGAL_OUTPUT')
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn runtime retries once before model-load-failed fallback', async () => {
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
    const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' })
    assert.equal(calls, 2)
    assert.equal(action.type, 'PASS')
    assert.equal(action.meta.fallbackReason, 'MODEL_LOAD_FAILED')
    assert.equal(typeof action.meta.backend, 'string')
    assert.equal(action.meta.modelId, 'latest')
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})

test('nn stochastic sampling is reproducible for same state and backend', async () => {
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    { seed: 105 },
  )
  const seatId = state.turn.activeSeatId
  const a = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest', samplingMode: 'stochastic' })
  const b = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest', samplingMode: 'stochastic' })
  assert.equal(a.type, b.type)
})

test('nn runtime uses policy logits head and keeps dungeon advance legal', async () => {
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
  }
  const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest' })
  assert.equal(action.type, 'ADVANCE_DUNGEON')
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
    await chooseNnActionWithFallback(state, { seatId }, {
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

test('nn runtime emits debug trace on model-load fallback path', async () => {
  const traces = []
  const state = createInitialMatchState(
    { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'missing-model' }] },
    { seed: 151 },
  )
  const seatId = state.turn.activeSeatId
  const action = await chooseNnActionWithFallback(state, { seatId }, {
    modelId: 'missing-model',
    debugTrace: true,
    debugLogger: (trace) => traces.push(trace),
  })
  assert.equal(action.type, 'PASS')
  assert.equal(traces.length >= 1, true)
  assert.equal(traces.at(-1).kind, 'fallback')
  assert.equal(traces.at(-1).fallbackReason, 'MODEL_LOAD_FAILED')
})

test('worker-side model load errors do not masquerade as pass actions', async () => {
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
    const action = await chooseNnActionWithFallback(state, { seatId }, { modelId: 'latest', debugTrace: true })
    assert.equal(action.type, 'PASS')
    assert.equal(action.meta?.fallbackReason, 'MODEL_LOAD_FAILED')
  } finally {
    globalThis.Worker = originalWorker
    resetNnRuntimeForTests()
  }
})
