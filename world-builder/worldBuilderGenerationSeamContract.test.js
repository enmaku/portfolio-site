import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { useWorldBuilderGeneration } from '../src/composables/useWorldBuilderGeneration.js'
import { useWorldBuilderOverlayState } from '../src/composables/useWorldBuilderOverlayState.js'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from './resourceOverlays.js'
import { createInitialGenerationProgress } from './worldBuilderGenerationOrchestrator.js'
import {
  generationProgressValue,
  shouldApplyStepPreviewToMap,
} from './worldBuilderGenerationPolicy.js'

/**
 * Generation seam: settings → orchestrator → world document, never touching the renderer.
 * The composable and policy module run end-to-end against injected worker seams with no
 * viewport, Pixi, or page presentation model in scope — proving generation owns preview
 * policy, cancellation, and phase transitions through public interfaces (ADR-0009).
 */

/** @type {import('./core/types.js').DerivedGeographyParams} */
const SAMPLE_PARAMS = { geographySeed: 1, prevailingWindDegrees: 90, options: {} }

/**
 * @returns {import('./core/types.js').WorldDocument}
 */
function previewDoc() {
  return {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
  }
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

test('generation policy decides previews and progress as a renderer-free pure function', () => {
  const doc = previewDoc()

  assert.strictEqual(generationProgressValue(5, 6), 100)
  assert.strictEqual(
    shouldApplyStepPreviewToMap({ delivery: 'step-complete', stepId: 'validation', worldDocument: doc }),
    true,
  )
  assert.strictEqual(
    shouldApplyStepPreviewToMap({ delivery: 'step-complete', stepId: 'erosion', worldDocument: doc }),
    false,
  )
})

test('generation composable runs to success and applies validation preview without a renderer', async () => {
  const scope = effectScope(true)
  try {
    const validationDoc = previewDoc()
    /** @type {import('./core/types.js').WorldDocument[]} */
    const appliedDocs = []
    /** @type {string[]} */
    const phases = []

    const ctx = scope.run(() =>
      useWorldBuilderGeneration({
        getDerivedGeographyParams: () => SAMPLE_PARAMS,
        applyWorldDocument: (doc) => {
          appliedDocs.push(doc)
        },
        runDerivedGeographyInWorker(_params, callbacks) {
          callbacks.onStepStart?.({ stepId: 'baseline', stepIndex: 0, stepCount: 6, label: 'Baseline' })
          callbacks.onStepComplete?.({
            stepId: 'erosion',
            stepIndex: 1,
            stepCount: 6,
            label: 'Erosion',
            worldDocument: previewDoc(),
          })
          callbacks.onStepComplete?.({
            stepId: 'validation',
            stepIndex: 5,
            stepCount: 6,
            label: 'Validation',
            worldDocument: validationDoc,
          })
          callbacks.onComplete?.()
          return { cancel() {} }
        },
      }),
    )

    phases.push(ctx.runPhase.value)
    ctx.regenerate()
    await nextTick()
    phases.push(ctx.runPhase.value)

    assert.deepStrictEqual(phases, ['idle', 'success'])
    assert.strictEqual(ctx.generationProgress.value.percent, 100)
    assert.strictEqual(ctx.showResourceOverlayBar.value, true)
    assert.strictEqual(ctx.showGenerationProgress.value, false)
    assert.deepStrictEqual(appliedDocs, [validationDoc])
  } finally {
    scope.stop()
  }
})

test('useWorldBuilderGeneration composable resets progress on cancel without page model helpers', async () => {
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

test('generation composable reaches exhausted terminal through applyWorldDocument without viewport', async () => {
  const scope = effectScope(true)
  try {
    const exhaustedDoc = previewDoc()
    /** @type {import('./core/types.js').WorldDocument[]} */
    const appliedDocs = []

    const ctx = scope.run(() =>
      useWorldBuilderGeneration({
        getDerivedGeographyParams: () => SAMPLE_PARAMS,
        applyWorldDocument: (doc) => {
          appliedDocs.push(doc)
        },
        runDerivedGeographyInWorker(_params, callbacks) {
          callbacks.onExhausted?.(exhaustedDoc)
          return { cancel() {} }
        },
      }),
    )

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'exhausted')
    assert.strictEqual(ctx.showValidationFailureIndicator.value, true)
    assert.strictEqual(ctx.showResourceOverlayBar.value, false)
    assert.deepStrictEqual(appliedDocs, [exhaustedDoc])
  } finally {
    scope.stop()
  }
})

test('generation composable forwards worker errors without viewport or map lifecycle', async () => {
  const scope = effectScope(true)
  try {
    /** @type {string[]} */
    const errors = []

    const ctx = scope.run(() =>
      useWorldBuilderGeneration({
        getDerivedGeographyParams: () => SAMPLE_PARAMS,
        applyWorldDocument: () => {},
        onRunError: (message) => {
          errors.push(message)
        },
        runDerivedGeographyInWorker(_params, callbacks) {
          callbacks.onError?.('worker seam failure')
          return { cancel() {} }
        },
      }),
    )

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'error')
    assert.deepStrictEqual(errors, ['worker seam failure'])
    assert.strictEqual(ctx.showGenerationProgress.value, false)
  } finally {
    scope.stop()
  }
})

/**
 * #370.5 — Copy into merge PR ## Test plan → ADR-0009 audit (#370)
 *
 * ## ADR-0009 seam audit findings (#370)
 *
 * - Package boundaries: core, worker, orchestrator, and `useWorldBuilderGeneration` have zero
 *   production imports from `world-builder/renderer` (AutoVerify shell rg gate).
 * - Renderer terrain seam: `buildLandTerrainRgba` tints from `displayBiomes`; simulation `biomes`
 *   changes are invisible when presentation biomes are unchanged (`rendererSeamContract.test.js`).
 * - Simulation vs presentation hydrology: river overlay reads presentation corridor masks only;
 *   diverging `simulationRiverMask` does not change overlay RGBA when presentation masks match.
 * - Generation seam: composable completes success, exhausted, cancel, and error paths through
 *   injected worker fakes and `applyWorldDocument` — no viewport factory, Pixi, or DOM host.
 * - Overlay owner seam: visibility and display settings mutate viewport only via
 *   `syncOverlayRenderCache` (`resourceOverlayStateSeamContract.test.js`).
 * - Seam tests use behavioral assertions only — no `readFileSync` source greps in runtime seam
 *   contract files (research asset tests exempt per ADR-0009 checklist §7.1).
 *
 * Deferred to sibling issues / merge PR #382 checklist: renderer non-mutation (#383), document
 * dirty refresh locality (#383), vector per-family overlay locality (#362–#363), page controller
 * lifecycle (#375), manual QA (#381).
 */
