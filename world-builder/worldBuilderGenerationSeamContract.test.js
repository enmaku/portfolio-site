import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { effectScope, nextTick } from 'vue'
import { useWorldBuilderGeneration } from '../src/composables/useWorldBuilderGeneration.js'
import { useWorldBuilderOverlayState } from '../src/composables/useWorldBuilderOverlayState.js'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from './resourceOverlays.js'
import { createInitialGenerationProgress } from './worldBuilderGenerationOrchestrator.js'

const worldBuilderDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const orchestratorPath = join(worldBuilderDir, 'worldBuilderGenerationOrchestrator.js')
const policyPath = join(worldBuilderDir, 'worldBuilderGenerationPolicy.js')
const generationComposablePath = join(repoRoot, 'src/composables/useWorldBuilderGeneration.js')

const forbiddenGenerationComposableImports = [
  'createWorldBuilderMapViewport',
  'createGenerationMapLifecycle',
  'worldBuilderMapViewportModel',
  'worldBuilderGenerationMapLifecycle',
  'buildLandTerrainRgba',
  'buildArableOverlayCanvas',
]

/** @type {import('./core/types.js').DerivedGeographyParams} */
const SAMPLE_PARAMS = { geographySeed: 1, prevailingWindDegrees: 90, options: {} }

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

test('generation orchestrator does not import page presentation model', () => {
  const source = readFileSync(orchestratorPath, 'utf8')
  assert.ok(
    !source.includes('worldBuilderPageModel'),
    'orchestrator must own generation policy via worldBuilderGenerationPolicy, not page model',
  )
  assert.ok(source.includes('worldBuilderGenerationPolicy'))
})

test('generation policy module stays free of page presentation imports', () => {
  const source = readFileSync(policyPath, 'utf8')
  assert.ok(!source.includes('worldBuilderPageModel'))
  assert.ok(!source.includes('quasar'))
  assert.ok(!source.includes('.vue'))
})

test('useWorldBuilderGeneration composable does not import renderer viewport factories', () => {
  const source = readFileSync(generationComposablePath, 'utf8')
  for (const symbol of forbiddenGenerationComposableImports) {
    assert.ok(
      !source.includes(symbol),
      `generation composable must not import ${symbol}`,
    )
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
