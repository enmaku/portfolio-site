import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { useWorldBuilderGeneration } from '../src/composables/useWorldBuilderGeneration.js'
import { useWorldBuilderOverlayState } from '../src/composables/useWorldBuilderOverlayState.js'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from './resourceOverlays.js'
import {
  createGenerationRunController,
  createInitialGenerationProgress,
  reduceGenerationProgressOnStepComplete,
  reduceGenerationProgressOnStepStart,
  startDerivedGeographyGeneration,
} from './worldBuilderGenerationOrchestrator.js'
import { shouldApplyStepPreviewToMap } from './worldBuilderGenerationPolicy.js'

/** @type {import('./core/types.js').DerivedGeographyParams} */
const SAMPLE_PARAMS = { geographySeed: 1, prevailingWindDegrees: 90, options: {} }

/** @type {import('./core/types.js').WorldDocument} */
const SAMPLE_DOC = {
  gridWidth: 4,
  gridHeight: 4,
  biomes: new Uint8Array(16),
  displayBiomes: new Uint8Array(16),
  fields: { elevation: new Float32Array(16) },
}

/**
 * @returns {{ syncOverlayRenderCache: (state: import('./resourceOverlayState.js').ResourceOverlayPageState) => void, syncedStates: import('./resourceOverlayState.js').ResourceOverlayPageState[] }}
 */
function createViewportSyncSeam() {
  /** @type {import('./resourceOverlayState.js').ResourceOverlayPageState[]} */
  const syncedStates = []
  return {
    syncedStates,
    syncOverlayRenderCache(state) {
      syncedStates.push(state)
    },
  }
}

function createMockOverlaySettingsStore() {
  return {
    overlayDisplaySettings: {
      arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
    },
    setOverlayDisplaySetting(key, value) {
      this.overlayDisplaySettings[key] = value
    },
  }
}

test('generation progress reducer advances phase transitions through public orchestrator helpers', () => {
  let progress = createInitialGenerationProgress()
  progress = reduceGenerationProgressOnStepStart(progress, {
    stepIndex: 2,
    stepCount: 6,
    label: 'Hydrology',
    stepId: 'hydrology',
  })
  assert.strictEqual(progress.activeStepIndex, 2)
  assert.strictEqual(progress.label, 'Hydrology')

  progress = reduceGenerationProgressOnStepComplete(progress, {
    stepIndex: 2,
    stepCount: 6,
    label: 'Hydrology',
    stepId: 'hydrology',
  })
  assert.strictEqual(progress.completedStepIndex, 2)
})

test('preview policy gates map delivery to validation and exhausted terminals only', () => {
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'step-complete',
      stepId: 'hydrology',
      worldDocument: SAMPLE_DOC,
    }),
    false,
  )
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'step-complete',
      stepId: 'validation',
      worldDocument: SAMPLE_DOC,
    }),
    true,
  )
})

test('startDerivedGeographyGeneration applies only policy-approved previews to the map seam', () => {
  const controller = createGenerationRunController()
  /** @type {import('./core/types.js').WorldDocument[]} */
  const documents = []

  startDerivedGeographyGeneration({
    controller,
    params: SAMPLE_PARAMS,
    runDerivedGeographyInWorker(_params, callbacks) {
      callbacks.onStepComplete?.({
        stepId: 'hydrology',
        stepIndex: 3,
        stepCount: 6,
        label: 'Hydrology',
        worldDocument: SAMPLE_DOC,
      })
      callbacks.onStepComplete?.({
        stepId: 'validation',
        stepIndex: 5,
        stepCount: 6,
        label: 'Validation',
        worldDocument: SAMPLE_DOC,
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
  assert.strictEqual(documents[0], SAMPLE_DOC)
})

test('useWorldBuilderGeneration composable resets progress on cancel without a viewport', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let callbacks = {}
    const ctx = scope.run(() =>
      useWorldBuilderGeneration({
        getDerivedGeographyParams: () => SAMPLE_PARAMS,
        applyWorldDocument: () => {},
        runDerivedGeographyInWorker(_params, workerCallbacks) {
          callbacks = workerCallbacks
          workerCallbacks.onStepStart?.({
            stepId: 'baseline',
            stepIndex: 2,
            stepCount: 6,
            label: 'Baseline',
          })
          return {
            cancel() {
              callbacks.onCancelled?.()
            },
          }
        },
      }),
    )

    ctx.regenerate()
    await nextTick()
    ctx.dispose()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'cancelled')
    assert.deepStrictEqual(ctx.generationProgress.value, createInitialGenerationProgress())
  } finally {
    scope.stop()
  }
})

test('generation run hooks reset overlay visibility before run and after success', async () => {
  const scope = effectScope(true)
  try {
    const viewport = createViewportSyncSeam()
    const settingsStore = createMockOverlaySettingsStore()
    /** @type {string[]} */
    const hookLog = []

    const overlayCtx = scope.run(() =>
      useWorldBuilderOverlayState({
        getViewport: () => viewport,
        settingsStore,
      }),
    )

    const generationCtx = scope.run(() =>
      useWorldBuilderGeneration({
        getDerivedGeographyParams: () => SAMPLE_PARAMS,
        applyWorldDocument: () => {},
        onBeforeRun: () => {
          hookLog.push('before')
          overlayCtx.resetVisibility()
        },
        onRunCompleteSuccess: () => {
          hookLog.push('success')
          overlayCtx.resetVisibility()
        },
        runDerivedGeographyInWorker(_params, callbacks) {
          callbacks.onComplete?.()
          return { cancel() {} }
        },
      }),
    )

    overlayCtx.toggleVisibility('timber', true)
    assert.strictEqual(overlayCtx.visibility.value.timber, true)

    generationCtx.regenerate()
    await nextTick()

    assert.deepStrictEqual(hookLog, ['before', 'success'])
    assert.strictEqual(overlayCtx.visibility.value.timber, false)
    assert.strictEqual(generationCtx.runPhase.value, 'success')
    assert.strictEqual(generationCtx.showResourceOverlayBar.value, true)
    assert.strictEqual(generationCtx.showGenerationProgress.value, false)
    assert.ok(viewport.syncedStates.length >= 2)
    assert.strictEqual(viewport.syncedStates.at(-1)?.visibility.timber, false)
  } finally {
    scope.stop()
  }
})
