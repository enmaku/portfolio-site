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
import { createGenerationMapLifecycle } from './worldBuilderGenerationMapLifecycle.js'
import { shouldApplyStepPreviewToMap } from './worldBuilderGenerationPolicy.js'
import {
  isGenerationRunSuccess,
  shouldShowResourceOverlayBar,
  shouldShowValidationFailureIndicator,
} from './worldBuilderPageModel.js'

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
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
      })
      callbacks.onStepComplete?.({
        type: 'step-complete',
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
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
  assert.strictEqual(documents[0], fakeWorldDocument)
  assert.strictEqual(completed, true)
})

test('startDerivedGeographyGeneration updates progress from slim step-complete payloads', () => {
  const controller = createGenerationRunController()
  const progressUpdates = []

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        type: 'step-complete',
        stepId: 'erosion',
        stepIndex: 1,
        stepCount: 6,
        label: 'Erosion',
      })
      callbacks.onComplete?.()
      return { cancel() {} }
    },
    handlers: {
      onProgress(progress) {
        progressUpdates.push(progress)
      },
    },
  })

  assert.strictEqual(progressUpdates.length, 2)
  assert.strictEqual(progressUpdates[0].completedStepIndex, 1)
  assert.strictEqual(progressUpdates[0].percent, 33)
})

test('startDerivedGeographyGeneration forwards exhausted lifecycle without treating as clean success', () => {
  const controller = createGenerationRunController()
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []
  let completed = false
  let exhausted = false

  const fakeWorldDocument = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
    generationReport: {
      shouldReject: true,
      erosionStepCount: 0,
      navigableRiverEdgeCount: 0,
      coastalNodeCount: 0,
      validationRows: [],
      rejectionReasons: ['coastMouth: fixture'],
      structuredRejectionReasons: [],
      rejectionSamplingEnforced: true,
    },
  }

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
        worldDocument: fakeWorldDocument,
      })
      callbacks.onExhausted?.(fakeWorldDocument)
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        documents.push(doc)
      },
      onComplete() {
        completed = true
      },
      onExhausted() {
        exhausted = true
      },
    },
  })

  assert.strictEqual(exhausted, true)
  assert.strictEqual(completed, false)
  assert.strictEqual(documents.length, 2)
  assert.strictEqual(isGenerationRunSuccess('exhausted'), false)
  assert.strictEqual(shouldShowValidationFailureIndicator('exhausted'), true)
  assert.strictEqual(shouldShowResourceOverlayBar('exhausted'), false)
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

test('startDerivedGeographyGeneration rejects ineligible step-complete previews for non-validation steps', () => {
  const controller = createGenerationRunController()
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []

  const previewDoc = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
  }

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'erosion',
        stepIndex: 1,
        stepCount: 6,
        label: 'Erosion',
        worldDocument: previewDoc,
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

test('startDerivedGeographyGeneration does not push world document on metadata-only terminals', () => {
  const controller = createGenerationRunController()
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []

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
      callbacks.onComplete?.()
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        documents.push(doc)
      },
    },
  })
  assert.strictEqual(documents.length, 0, 'complete terminal must not deliver world document')

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onCancelled?.()
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        documents.push(doc)
      },
    },
  })
  assert.strictEqual(documents.length, 0, 'cancelled terminal must not deliver world document')

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onError?.('worker failed')
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        documents.push(doc)
      },
    },
  })
  assert.strictEqual(documents.length, 0, 'error terminal must not deliver world document')

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
        worldDocument: fakeWorldDocument,
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
  assert.strictEqual(
    documents.length,
    1,
    'complete terminal must not add a second delivery after validation step-complete',
  )
  assert.strictEqual(documents[0], fakeWorldDocument)
})

test('startDerivedGeographyGeneration applies preview policy from generation policy module', () => {
  const controller = createGenerationRunController()
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []

  const previewEligible = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
  }

  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'step-complete',
      stepId: 'validation',
      worldDocument: previewEligible,
    }),
    true,
  )
  assert.strictEqual(
    shouldApplyStepPreviewToMap({ delivery: 'step-complete', stepId: 'erosion', worldDocument: previewEligible }),
    false,
  )

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
        worldDocument: previewEligible,
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

  assert.strictEqual(documents.length, 1)
  assert.strictEqual(documents[0], previewEligible)
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

test('startDerivedGeographyGeneration cancelActive invokes onCancelled once', () => {
  const controller = createGenerationRunController()
  let cancelled = 0

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      return {
        cancel() {
          callbacks.onCancelled?.()
        },
      }
    },
    handlers: {
      onCancelled() {
        cancelled += 1
      },
    },
  })

  controller.cancelActive()

  assert.strictEqual(cancelled, 1)
})

test('startDerivedGeographyGeneration ignores stale validation step-complete after rapid supersede', () => {
  const controller = createGenerationRunController()
  /** @type {import('./worldBuilderGenerationOrchestrator.js').DerivedGeographyWorkerCallbacks} */
  let firstRunCallbacks = {}
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []

  const staleDoc = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
  }
  const currentDoc = {
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16),
    fields: { elevation: new Float32Array(16) },
  }

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      firstRunCallbacks = callbacks
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        documents.push(doc)
      },
    },
  })

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 2, prevailingWindDegrees: 180, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
        worldDocument: currentDoc,
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

  assert.strictEqual(documents.length, 1)
  assert.strictEqual(documents[0], currentDoc)

  firstRunCallbacks.onStepComplete?.({
    stepId: 'validation',
    stepIndex: 5,
    stepCount: 6,
    label: 'Validation',
    worldDocument: staleDoc,
  })

  assert.strictEqual(
    documents.length,
    1,
    'stale validation step-complete must not duplicate world document apply',
  )
})

test('startDerivedGeographyGeneration ignores stale onCancelled after supersede via beginRun', () => {
  const controller = createGenerationRunController()
  let firstRunCancelled = 0
  /** @type {import('./worldBuilderGenerationOrchestrator.js').DerivedGeographyWorkerCallbacks} */
  let firstRunCallbacks = {}

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      firstRunCallbacks = callbacks
      return {
        cancel() {
          callbacks.onCancelled?.()
        },
      }
    },
    handlers: {
      onCancelled() {
        firstRunCancelled += 1
      },
    },
  })

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 2, prevailingWindDegrees: 180, options: {} },
    runDerivedGeographyInWorker() {
      return { cancel() {} }
    },
    handlers: {
      onCancelled() {
        throw new Error('second run should not cancel before finishing')
      },
    },
  })

  assert.strictEqual(firstRunCancelled, 0)

  firstRunCallbacks.onCancelled?.()
  assert.strictEqual(firstRunCancelled, 0)
})

test('burst step-complete previews join single-flight map lifecycle without duplicate creates', async () => {
  const controller = createGenerationRunController()
  let createCount = 0
  let updateCount = 0
  let fitToWorldCount = 0

  const lifecycle = createGenerationMapLifecycle({
    getMapHost: () => ({}),
    getCreateViewport: () => async () => {
      createCount += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      return {
        updateWorldDocument() {
          updateCount += 1
        },
        fitToWorld() {
          fitToWorldCount += 1
        },
        destroy() {},
      }
    },
  })

  /** @type {Promise<void>[]} */
  const mapUpdates = []

  /** @type {import('./core/types.js').WorldDocument} */
  const ineligiblePreview = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
  }
  /** @type {import('./core/types.js').WorldDocument} */
  const validationPreview = {
    gridWidth: 6,
    gridHeight: 6,
    biomes: new Uint8Array(36),
    fields: { elevation: new Float32Array(36) },
  }

  startDerivedGeographyGeneration({
    controller,
    params: { geographySeed: 1, prevailingWindDegrees: 90, options: {} },
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'physicalTerrainBaseline',
        stepIndex: 0,
        stepCount: 3,
        label: 'Baseline',
        worldDocument: ineligiblePreview,
      })
      callbacks.onStepComplete?.({
        stepId: 'erosion',
        stepIndex: 1,
        stepCount: 3,
        label: 'Erosion',
        worldDocument: ineligiblePreview,
      })
      callbacks.onStepComplete?.({
        stepId: 'validation',
        stepIndex: 2,
        stepCount: 3,
        label: 'Validation',
        worldDocument: validationPreview,
      })
      callbacks.onComplete?.()
      return { cancel() {} }
    },
    handlers: {
      onWorldDocument(doc) {
        mapUpdates.push(lifecycle.applyWorldDocument(doc))
      },
    },
  })

  await Promise.all(mapUpdates)

  assert.strictEqual(createCount, 1)
  assert.strictEqual(updateCount, 0)
  assert.strictEqual(fitToWorldCount, 0)
  assert.strictEqual(lifecycle.getViewport() != null, true)
})
