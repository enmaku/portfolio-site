import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
  assert.deepEqual(await consumeAiTurnPrefetch('a', () => {}), { type: 'PASS' })
  assert.equal(await consumeAiTurnPrefetch('a', () => {}), null)
})

test('stale prefetch token is ignored', async () => {
  resetAiTurnPrefetch()
  startAiTurnPrefetch({
    runToken: 'a',
    compute: async () => ({ type: 'DRAW' }),
  })
  assert.equal(await consumeAiTurnPrefetch('b', () => {}), null)
  assert.deepEqual(await consumeAiTurnPrefetch('a', () => {}), { type: 'DRAW' })
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
  await consumeAiTurnPrefetch('a', () => {})
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
  assert.deepEqual(await consumeAiTurnPrefetch('b', trace), { type: 'PASS' })
  resolveA({ type: 'DRAW' })
  assert.equal(await consumeAiTurnPrefetch('a', trace), null)
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
  const action = await consumeAiTurnPrefetch('a', trace)
  assert.deepEqual(action, { type: 'DRAW' })
  assert.ok(steps.includes('prefetch.consume.hit'))
  assert.equal(steps.includes('prefetch.consume.timeout'), false)
})
