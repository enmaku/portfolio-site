import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'

/** @type {MockWorker | undefined} */
let lastWorker

/** @type {typeof import('./runDerivedGeographyInWorker.js')} */
let runDerivedGeographyInWorker

class MockWorker {
  constructor() {
    this.onmessage = null
    this.onerror = null
    /** @type {unknown[]} */
    this.postMessageCalls = []
    this.terminated = false
    lastWorker = this
  }

  /** @param {unknown} message */
  postMessage(message) {
    this.postMessageCalls.push(message)
  }

  terminate() {
    this.terminated = true
  }
}

const workerParams = {
  geographySeed: 42,
  prevailingWindDegrees: 90,
  width: 8,
  height: 8,
  options: DEFAULT_WORLD_GENERATION_OPTIONS,
}

before(async () => {
  globalThis.Worker = MockWorker
  ;({ runDerivedGeographyInWorker } = await import('./runDerivedGeographyInWorker.js'))
})

after(() => {
  delete globalThis.Worker
})

/**
 * @param {import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} callbacks
 */
function startWorker(callbacks) {
  return runDerivedGeographyInWorker(workerParams, callbacks)
}

/**
 * @param {Record<string, unknown>} payload
 */
function deliverWorkerMessage(payload) {
  assert.ok(lastWorker?.onmessage)
  lastWorker.onmessage({ data: payload })
}

test('runDerivedGeographyInWorker posts start params to the worker', () => {
  startWorker({})
  assert.deepStrictEqual(lastWorker?.postMessageCalls[0], { type: 'start', params: workerParams })
})

test('runDerivedGeographyInWorker forwards step-start messages to onStepStart', () => {
  const steps = []
  startWorker({
    onStepStart: (payload) => steps.push(payload),
  })

  deliverWorkerMessage({
    type: 'step-start',
    stepId: 'baseline',
    stepIndex: 0,
    stepCount: 3,
    label: 'baseline-label',
  })

  assert.strictEqual(steps.length, 1)
  assert.strictEqual(steps[0].stepId, 'baseline')
  assert.strictEqual(steps[0].stepIndex, 0)
})

test('runDerivedGeographyInWorker forwards step-complete with world document', () => {
  const completed = []
  startWorker({
    onStepComplete: (payload) => completed.push(payload),
  })

  const worldDocument = { gridWidth: 8, gridHeight: 8, pipelineStage: 'derivedGeography' }
  deliverWorkerMessage({
    type: 'step-complete',
    stepId: 'hydrology',
    stepIndex: 2,
    stepCount: 3,
    label: 'hydrology-label',
    worldDocument,
  })

  assert.strictEqual(completed.length, 1)
  assert.strictEqual(completed[0].worldDocument, worldDocument)
})

test('runDerivedGeographyInWorker forwards hydrology substep lifecycle callbacks', () => {
  const started = []
  const progressed = []
  const completed = []
  startWorker({
    onSubstepStart: (payload) => started.push(payload),
    onSubstepProgress: (payload) => progressed.push(payload),
    onSubstepComplete: (payload) => completed.push(payload),
  })

  deliverWorkerMessage({
    type: 'substep-start',
    stepId: 'hydrology',
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 2,
    label: 'fill',
  })
  deliverWorkerMessage({
    type: 'substep-progress',
    stepId: 'hydrology',
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 2,
    label: 'fill',
    progress: 0.5,
  })
  deliverWorkerMessage({
    type: 'substep-complete',
    stepId: 'hydrology',
    substepId: 'hydrologyFill',
    substepIndex: 0,
    substepCount: 2,
    label: 'fill',
  })

  assert.strictEqual(started.length, 1)
  assert.strictEqual(progressed.length, 1)
  assert.strictEqual(completed.length, 1)
  assert.strictEqual(started[0].substepId, 'hydrologyFill')
})

test('runDerivedGeographyInWorker terminates worker and calls onComplete', () => {
  let completed = false
  startWorker({
    onComplete: () => {
      completed = true
    },
  })

  deliverWorkerMessage({ type: 'complete' })

  assert.strictEqual(completed, true)
  assert.strictEqual(lastWorker?.terminated, true)
})

test('runDerivedGeographyInWorker forwards worker errors and terminates', () => {
  const errors = []
  startWorker({
    onError: (message) => errors.push(message),
  })

  deliverWorkerMessage({ type: 'error', message: 'pipeline failed' })

  assert.deepStrictEqual(errors, ['pipeline failed'])
  assert.strictEqual(lastWorker?.terminated, true)
})

test('runDerivedGeographyInWorker forwards worker cancellation callback', () => {
  const cancelled = []
  startWorker({
    onCancelled: () => cancelled.push(true),
  })

  deliverWorkerMessage({ type: 'cancelled' })

  assert.strictEqual(cancelled.length, 1)
  assert.strictEqual(lastWorker?.terminated, true)
})

test('runDerivedGeographyInWorker cancel posts cancel and terminates worker', () => {
  const job = startWorker({})

  job.cancel()

  assert.strictEqual(lastWorker?.terminated, true)
  assert.deepStrictEqual(lastWorker?.postMessageCalls.at(-1), { type: 'cancel' })
})

test('runDerivedGeographyInWorker ignores unknown worker message types', () => {
  const completed = []
  startWorker({
    onComplete: () => completed.push(true),
  })

  deliverWorkerMessage({ type: 'noop' })
  deliverWorkerMessage({ type: 'complete' })

  assert.strictEqual(completed.length, 1)
})

test('runDerivedGeographyInWorker forwards worker onerror and terminates', () => {
  const errors = []
  startWorker({
    onError: (message) => errors.push(message),
  })

  assert.ok(lastWorker?.onerror)
  lastWorker.onerror({ message: 'worker script error' })

  assert.deepStrictEqual(errors, ['worker script error'])
  assert.strictEqual(lastWorker?.terminated, true)
})

test('runDerivedGeographyInWorker uses fallback error text when onerror has no message', () => {
  const errors = []
  startWorker({
    onError: (message) => errors.push(message),
  })

  lastWorker?.onerror({})

  assert.deepStrictEqual(errors, ['Worker failed'])
})
test('runDerivedGeographyInWorker throws when Worker is unavailable', () => {
  delete globalThis.Worker
  assert.throws(
    () => runDerivedGeographyInWorker(workerParams, {}),
    /Web Workers are not available/,
  )
  globalThis.Worker = MockWorker
})
