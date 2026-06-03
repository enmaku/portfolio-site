import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cancelAiTurnPrefetch,
  consumeAiTurnPrefetch,
  resetAiTurnPrefetch,
  startAiTurnPrefetch,
} from './dungeonRunnerAiTurnPrefetch.js'

test('prefetch is consumed only for the matching run token', async () => {
  resetAiTurnPrefetch()
  startAiTurnPrefetch({
    runToken: 'a',
    compute: async () => ({ type: 'PASS' }),
  })
  assert.deepEqual(await consumeAiTurnPrefetch({ runToken: 'a', trace: () => {} }), { type: 'PASS' })
  assert.equal(await consumeAiTurnPrefetch({ runToken: 'a', trace: () => {} }), null)
})

test('stale prefetch token is ignored', async () => {
  resetAiTurnPrefetch()
  startAiTurnPrefetch({
    runToken: 'a',
    compute: async () => ({ type: 'DRAW' }),
  })
  assert.equal(await consumeAiTurnPrefetch({ runToken: 'b', trace: () => {} }), null)
  assert.deepEqual(await consumeAiTurnPrefetch({ runToken: 'a', trace: () => {} }), { type: 'DRAW' })
})

test('duplicate in-flight prefetch logs skip once per run token', async () => {
  resetAiTurnPrefetch()
  const skipSteps = []
  const trace = (step) => {
    skipSteps.push(step)
  }
  let resolveCompute
  startAiTurnPrefetch({
    runToken: 'a',
    trace,
    compute: () => new Promise((resolve) => {
      resolveCompute = resolve
    }),
  })
  startAiTurnPrefetch({ runToken: 'a', trace, compute: async () => ({ type: 'PASS' }) })
  startAiTurnPrefetch({ runToken: 'a', trace, compute: async () => ({ type: 'PASS' }) })
  assert.deepEqual(
    skipSteps.filter((step) => step === 'prefetch.skip'),
    ['prefetch.skip'],
  )
  resolveCompute({ type: 'DRAW' })
  await consumeAiTurnPrefetch({ runToken: 'a', trace: () => {} })
})

test('new run token supersedes in-flight prefetch', async () => {
  resetAiTurnPrefetch()
  const steps = []
  const trace = (step) => {
    steps.push(step)
  }
  let resolveA
  startAiTurnPrefetch({
    runToken: 'a',
    trace,
    compute: () => new Promise((resolve) => {
      resolveA = resolve
    }),
  })
  startAiTurnPrefetch({
    runToken: 'b',
    trace,
    compute: async () => ({ type: 'PASS' }),
  })
  assert.ok(steps.includes('prefetch.supersede'))
  assert.deepEqual(await consumeAiTurnPrefetch({ runToken: 'b', trace }), { type: 'PASS' })
  resolveA({ type: 'DRAW' })
  assert.equal(await consumeAiTurnPrefetch({ runToken: 'a', trace }), null)
})

test('consume awaits in-flight prefetch to completion', async () => {
  resetAiTurnPrefetch()
  const steps = []
  const trace = (step) => {
    steps.push(step)
  }
  startAiTurnPrefetch({
    runToken: 'a',
    trace,
    compute: () => new Promise((resolve) => {
      setTimeout(() => resolve({ type: 'DRAW' }), 40)
    }),
  })
  const action = await consumeAiTurnPrefetch({ runToken: 'a', trace })
  assert.deepEqual(action, { type: 'DRAW' })
  assert.ok(steps.includes('prefetch.consume.hit'))
  assert.equal(steps.includes('prefetch.consume.timeout'), false)
})

test('prefetch start is skipped when mayPrefetch is false', async () => {
  resetAiTurnPrefetch()
  let computeCalls = 0
  const traceEvents = []
  startAiTurnPrefetch({
    runToken: 'a',
    mayPrefetch: false,
    prefetchSkipReason: 'model-recovering',
    trace: (step, detail) => traceEvents.push({ step, detail }),
    compute: async () => {
      computeCalls += 1
      return { type: 'PASS' }
    },
  })
  assert.equal(computeCalls, 0)
  assert.deepEqual(traceEvents, [{
    step: 'prefetch.skip',
    detail: { reason: 'model-recovering', runToken: 'a' },
  }])
  assert.equal(await consumeAiTurnPrefetch({ runToken: 'a', trace: () => {} }), null)
})

test('prefetch start skip falls back to blocked when skip reason omitted', async () => {
  resetAiTurnPrefetch()
  const traceEvents = []
  startAiTurnPrefetch({
    runToken: 'a',
    mayPrefetch: false,
    trace: (step, detail) => traceEvents.push({ step, detail }),
    compute: async () => ({ type: 'PASS' }),
  })
  assert.equal(traceEvents[0]?.detail?.reason, 'blocked')
})

test('prefetch consume is blocked when mayPrefetch is false', async () => {
  resetAiTurnPrefetch()
  startAiTurnPrefetch({
    runToken: 'a',
    compute: async () => ({ type: 'DRAW' }),
  })
  const traceEvents = []
  assert.equal(await consumeAiTurnPrefetch({
    runToken: 'a',
    mayPrefetch: false,
    prefetchSkipReason: 'model-recovering',
    trace: (step, detail) => traceEvents.push({ step, detail }),
  }), null)
  assert.deepEqual(traceEvents, [{
    step: 'prefetch.consume.blocked',
    detail: { runToken: 'a', reason: 'model-recovering' },
  }])
})

test('prefetch is allowed when mayPrefetch is true', async () => {
  resetAiTurnPrefetch()
  startAiTurnPrefetch({
    runToken: 'a',
    mayPrefetch: true,
    compute: async () => ({ type: 'PASS' }),
  })
  assert.deepEqual(await consumeAiTurnPrefetch({
    runToken: 'a',
    mayPrefetch: true,
    trace: () => {},
  }), { type: 'PASS' })
})

test('cancelAiTurnPrefetch clears in-flight entry', async () => {
  resetAiTurnPrefetch()
  let resolveCompute
  startAiTurnPrefetch({
    runToken: 'a',
    compute: () => new Promise((resolve) => {
      resolveCompute = resolve
    }),
  })
  cancelAiTurnPrefetch()
  assert.equal(await consumeAiTurnPrefetch({ runToken: 'a', trace: () => {} }), null)
  resolveCompute({ type: 'DRAW' })
})
