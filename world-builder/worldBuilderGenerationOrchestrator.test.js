import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGenerationRunController,
  createInitialGenerationProgress,
  reduceGenerationProgressOnStepComplete,
  reduceGenerationProgressOnStepStart,
  reduceGenerationProgressOnSubstepComplete,
  reduceGenerationProgressOnSubstepStart,
  startDerivedGeographyGeneration,
} from './worldBuilderGenerationOrchestrator.js'

test('createInitialGenerationProgress starts idle before any pipeline step', () => {
  assert.deepStrictEqual(createInitialGenerationProgress(), {
    percent: 0,
    activeStepIndex: -1,
    completedStepIndex: -1,
    label: '',
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex: -1,
    skippedHydrologySubstepIds: [],
  })
})

test('reduceGenerationProgressOnStepStart advances active step and percent', () => {
  const next = reduceGenerationProgressOnStepStart(createInitialGenerationProgress(), {
    stepIndex: 1,
    stepCount: 6,
    label: 'Hydrology',
    stepId: 'hydrology',
  })
  assert.strictEqual(next.activeStepIndex, 1)
  assert.strictEqual(next.percent, 33)
  assert.strictEqual(next.label, 'Hydrology')
  assert.strictEqual(next.activeHydrologySubstepIndex, -1)
  assert.strictEqual(next.completedHydrologySubstepIndex, -1)
  assert.deepStrictEqual(next.skippedHydrologySubstepIds, [])
})

test('reduceGenerationProgressOnSubstepStart tracks active hydrology substep', () => {
  const progress = reduceGenerationProgressOnStepStart(createInitialGenerationProgress(), {
    stepIndex: 4,
    stepCount: 6,
    label: 'Hydrology',
    stepId: 'hydrology',
  })
  const next = reduceGenerationProgressOnSubstepStart(progress, { substepIndex: 2 })
  assert.strictEqual(next.activeHydrologySubstepIndex, 2)
})

test('reduceGenerationProgressOnSubstepComplete records skipped hydrology substeps', () => {
  const progress = reduceGenerationProgressOnSubstepStart(
    reduceGenerationProgressOnStepStart(createInitialGenerationProgress(), {
      stepIndex: 4,
      stepCount: 6,
      label: 'Hydrology',
      stepId: 'hydrology',
    }),
    { substepIndex: 1 },
  )
  const next = reduceGenerationProgressOnSubstepComplete(progress, {
    substepIndex: 1,
    substepId: 'hydrologyRefine',
    skipped: true,
  })
  assert.strictEqual(next.completedHydrologySubstepIndex, 1)
  assert.deepStrictEqual(next.skippedHydrologySubstepIds, ['hydrologyRefine'])
})

test('reduceGenerationProgressOnStepComplete marks completed step index', () => {
  const next = reduceGenerationProgressOnStepComplete(createInitialGenerationProgress(), {
    stepIndex: 2,
    stepCount: 6,
    label: 'Erosion',
    stepId: 'erosion',
  })
  assert.strictEqual(next.completedStepIndex, 2)
  assert.strictEqual(next.percent, 50)
})

test('createGenerationRunController invalidates stale runs when a new run begins', () => {
  const controller = createGenerationRunController()
  const first = controller.beginRun()
  const second = controller.beginRun()
  assert.strictEqual(first.isStale(), true)
  assert.strictEqual(second.isStale(), false)
})

test('startDerivedGeographyGeneration skips map preview when step-complete has no world document', () => {
  const controller = createGenerationRunController()
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'erosion',
        stepIndex: 1,
        stepCount: 6,
        label: 'Erosion',
      })
      callbacks.onComplete?.()
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        documents.push(doc)
      },
    },
  })

  assert.strictEqual(documents.length, 0)
})

test('startDerivedGeographyGeneration forwards lifecycle callbacks for a successful run', () => {
  const controller = createGenerationRunController()
  const progressUpdates = []
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []
  let completed = false

  const fakeWorldDocument = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
  }

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepStart?.({
        stepId: 'baseline',
        stepIndex: 0,
        stepCount: 2,
        label: 'Baseline',
      })
      callbacks.onStepComplete?.({
        stepId: 'baseline',
        stepIndex: 0,
        stepCount: 2,
        label: 'Baseline',
        worldDocument: fakeWorldDocument,
      })
      callbacks.onComplete?.()
      return { cancel() {} }
    },
    handlers: {
      onProgress(progress) {
        progressUpdates.push(progress)
      },
      onWorldDocument(doc) {
        documents.push(doc)
      },
      onComplete() {
        completed = true
      },
    },
  })

  assert.strictEqual(progressUpdates.length, 3)
  assert.strictEqual(progressUpdates.at(-1)?.percent, 100)
  assert.strictEqual(documents.length, 1)
  assert.strictEqual(completed, true)
})

test('startDerivedGeographyGeneration ignores callbacks from stale runs', () => {
  const controller = createGenerationRunController()
  /** @type {import('./worldBuilderGenerationOrchestrator.js').DerivedGeographyWorkerCallbacks} */
  let capturedCallbacks = {}
  let progressCount = 0

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      capturedCallbacks = callbacks
      return { cancel() {} }
    },
    handlers: {
      onProgress() {
        progressCount += 1
      },
    },
  })

  controller.beginRun()
  capturedCallbacks.onStepStart?.({
    stepId: 'baseline',
    stepIndex: 0,
    stepCount: 2,
    label: 'Baseline',
  })

  assert.strictEqual(progressCount, 0)
})

test('startDerivedGeographyGeneration cancels the previous active worker job', () => {
  const controller = createGenerationRunController()
  let cancelCount = 0

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker() {
      return {
        cancel() {
          cancelCount += 1
        },
      }
    },
    handlers: {},
  })

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 2, prevailingWindDegrees: 180, options: {} },
    runDerivedGeographyInWorker() {
      return { cancel() {} }
    },
    handlers: {},
  })

  assert.strictEqual(cancelCount, 1)
})
