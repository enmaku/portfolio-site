import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../../world-builder/core/worldGenerationOptions.js'
import { useWorldBuilderPageController } from './useWorldBuilderPageController.js'

/**
 * PAGE-CONTROLLER-INTERFACE.md § Returned actions — side-effect methods and their
 * covering test titles in this file (375.7 matrix).
 * @type {Record<string, string[]>}
 */
const SIDE_EFFECT_METHOD_COVERAGE = {
  start: [
    'start runs initial generation and applies the world document to the map',
    'start syncs overlay state when the viewport becomes ready',
  ],
  destroy: ['destroy cancels the active run and tears down the map lifecycle'],
  regenerate: [
    'regenerate starts a fresh generation run',
    'a completed run resets overlay visibility',
    'superseding regenerate ignores stale terminal callbacks from prior run',
    'supersede ignores stale step-complete world document from prior run',
    'rapid regenerate does not duplicate world document apply from stale worker',
  ],
  onToggleChange: ['onToggleChange persists to settings and regenerates'],
  onSliderInput: ['onSliderInput persists to settings without regenerating'],
  onSliderCommit: ['committing a slider value persists to settings and regenerates'],
  commitSeed: ['committing a seed applies it to settings and regenerates'],
  randomizeSeed: ['randomizeSeed updates seed input, settings, and regenerates'],
  resetDefaults: [
    'resetDefaults resets settings, restores overlay display settings, and regenerates',
  ],
  toggleResourceOverlayVisibility: [
    'toggleResourceOverlayVisibility syncs visibility to the viewport',
  ],
  setResourceOverlayDisplaySetting: [
    'setResourceOverlayDisplaySetting persists to settings and syncs viewport',
  ],
  resetOverlays: ['resetOverlays clears overlay visibility and syncs viewport'],
  focusValidationRow: [
    'focusValidationRow focuses the viewport only when the row has a map focus',
  ],
}

/**
 * @param {Object} [overrides]
 * @returns {import('../../world-builder/core/types.js').WorldDocument}
 */
function fakeWorldDocument(overrides = {}) {
  return {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
    ...overrides,
  }
}

function createFakeSettingsStore(initial = {}) {
  const store = {
    geographySeed: 7,
    prevailingWindDegrees: 90,
    generationOptions: { ...DEFAULT_WORLD_GENERATION_OPTIONS },
    overlayDisplaySettings: { arableMinimumProductivity: 0.1 },
    ensureInitializedCount: 0,
    resetToDefaultsCount: 0,
    ensureInitialized() {
      this.ensureInitializedCount += 1
    },
    applySeed(rawSeed) {
      const parsed = Number.parseInt(String(rawSeed), 10)
      if (Number.isFinite(parsed)) {
        this.geographySeed = parsed
      }
    },
    setControl(key, value) {
      if (key === 'prevailingWindDegrees') {
        this.prevailingWindDegrees = value
        return
      }
      this.generationOptions = { ...this.generationOptions, [key]: value }
    },
    setOverlayDisplaySetting(key, value) {
      this.overlayDisplaySettings = { ...this.overlayDisplaySettings, [key]: value }
    },
    resetToDefaults() {
      this.resetToDefaultsCount += 1
      this.overlayDisplaySettings = { arableMinimumProductivity: 0.1 }
    },
    ...initial,
  }
  return store
}

/**
 * Captures viewport interactions so tests can assert map wiring without a real renderer.
 */
function createFakeViewport() {
  const focusCalls = []
  const overlaySyncs = []
  return {
    focusCalls,
    overlaySyncs,
    handle: {
      focusOn(focus) {
        focusCalls.push(focus)
      },
      syncOverlayRenderCache(state) {
        overlaySyncs.push(state)
      },
      updateWorldDocument() {},
      fitToWorld() {},
      destroy() {},
    },
  }
}

/**
 * @param {import('vue').EffectScope} scope
 */
function mountController(scope, overrides = {}) {
  const appliedDocs = []
  const errors = []
  const viewport = overrides.viewport ?? createFakeViewport()
  let lifecycleDestroyed = false

  const settingsStore = overrides.settingsStore ?? createFakeSettingsStore()

  const ctx = scope.run(() =>
    useWorldBuilderPageController({
      getMapHost: () => ({}),
      settingsStore,
      onGenerationError: (message) => errors.push(message),
      loadViewportFactory: async () => async () => viewport.handle,
      createMapLifecycle: ({ onViewportReady }) => ({
        async applyWorldDocument(doc) {
          appliedDocs.push(doc)
          onViewportReady?.()
        },
        getViewport: () => viewport.handle,
        destroy() {
          lifecycleDestroyed = true
        },
      }),
      runDerivedGeographyInWorker:
        overrides.runDerivedGeographyInWorker ??
        ((_params, callbacks) => {
          callbacks.onStepComplete?.({
            stepId: 'validation',
            stepIndex: 5,
            stepCount: 6,
            label: 'Validation',
            worldDocument: fakeWorldDocument(),
          })
          callbacks.onComplete?.()
          return { cancel() {} }
        }),
    }),
  )

  return {
    ctx,
    settingsStore,
    viewport,
    appliedDocs,
    errors,
    isLifecycleDestroyed: () => lifecycleDestroyed,
  }
}

/** Worker stub that stays running until its captured callbacks are driven manually. */
function createPendingWorker() {
  let runCount = 0
  /** @type {import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
  let lastCallbacks = {}
  return {
    runCount: () => runCount,
    lastCallbacks: () => lastCallbacks,
    run(_params, callbacks) {
      runCount += 1
      lastCallbacks = callbacks
      callbacks.onStepStart?.({ stepId: 'baseline', stepIndex: 0, stepCount: 6, label: 'Baseline' })
      return {
        cancel() {
          callbacks.onCancelled?.()
        },
      }
    },
  }
}

test('start runs initial generation and applies the world document to the map', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, appliedDocs } = mountController(scope)

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'success')
    assert.ok(ctx.worldDocument.value)
    assert.strictEqual(appliedDocs.length, 1)
  } finally {
    scope.stop()
  }
})

test('destroy cancels the active run and tears down the map lifecycle', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, isLifecycleDestroyed } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    assert.strictEqual(ctx.runPhase.value, 'running')

    ctx.destroy()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'cancelled')
    assert.strictEqual(isLifecycleDestroyed(), true)
  } finally {
    scope.stop()
  }
})

test('regenerate starts a fresh generation run', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    const runsAfterStart = worker.runCount()

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(worker.runCount(), runsAfterStart + 1)
  } finally {
    scope.stop()
  }
})

test('superseding regenerate ignores stale terminal callbacks from prior run', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let firstRunCallbacks = {}

    const worker = createPendingWorker()
    const { ctx, appliedDocs } = mountController(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        if (Object.keys(firstRunCallbacks).length === 0) {
          firstRunCallbacks = callbacks
        }
        return worker.run(_params, callbacks)
      },
    })

    await ctx.start()
    await nextTick()
    ctx.regenerate()
    await nextTick()

    const appliedBeforeStale = appliedDocs.length
    firstRunCallbacks.onComplete?.()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(appliedDocs.length, appliedBeforeStale)
  } finally {
    scope.stop()
  }
})

test('supersede ignores stale step-complete world document from prior run', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let firstRunCallbacks = {}

    const { ctx, appliedDocs } = mountController(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        if (Object.keys(firstRunCallbacks).length === 0) {
          firstRunCallbacks = callbacks
          return { cancel() {} }
        }
        return { cancel() {} }
      },
    })

    ctx.regenerate()
    ctx.regenerate()
    await nextTick()

    firstRunCallbacks.onStepComplete?.({
      stepId: 'validation',
      stepIndex: 5,
      stepCount: 6,
      label: 'Validation',
      worldDocument: fakeWorldDocument({ geographySeed: 99999 }),
    })
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.strictEqual(appliedDocs.length, 0)
  } finally {
    scope.stop()
  }
})

test('rapid regenerate does not duplicate world document apply from stale worker', async () => {
  const scope = effectScope(true)
  try {
    /** @type {import('../../world-builder/runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} */
    let firstRunCallbacks = {}
    let runCount = 0

    const currentDoc = fakeWorldDocument({ geographySeed: 42 })
    const staleDoc = fakeWorldDocument({ geographySeed: 99999 })

    const { ctx, appliedDocs } = mountController(scope, {
      runDerivedGeographyInWorker(_params, callbacks) {
        runCount += 1
        if (runCount === 1) {
          callbacks.onStepComplete?.({
            stepId: 'validation',
            stepIndex: 5,
            stepCount: 6,
            label: 'Validation',
            worldDocument: fakeWorldDocument(),
          })
          callbacks.onComplete?.()
          return { cancel() {} }
        }
        if (runCount === 2) {
          firstRunCallbacks = callbacks
          return { cancel() {} }
        }
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
    })

    await ctx.start()
    await nextTick()
    const appliedAfterStart = appliedDocs.length

    ctx.regenerate()
    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'success')
    assert.strictEqual(appliedDocs.length, appliedAfterStart + 1)
    assert.strictEqual(appliedDocs.at(-1), currentDoc)

    firstRunCallbacks.onStepComplete?.({
      stepId: 'validation',
      stepIndex: 5,
      stepCount: 6,
      label: 'Validation',
      worldDocument: staleDoc,
    })
    await nextTick()

    assert.strictEqual(appliedDocs.length, appliedAfterStart + 1)
    assert.strictEqual(appliedDocs.at(-1), currentDoc)
  } finally {
    scope.stop()
  }
})

test('onToggleChange persists to settings and regenerates', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    const runsAfterStart = worker.runCount()

    ctx.onToggleChange('enableMeanderRefine', true)
    await nextTick()

    assert.strictEqual(settingsStore.generationOptions.enableMeanderRefine, true)
    assert.strictEqual(worker.runCount(), runsAfterStart + 1)
  } finally {
    scope.stop()
  }
})

test('onSliderInput persists to settings without regenerating', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    const runsAfterStart = worker.runCount()

    ctx.onSliderInput('seaLevel', 0.55)
    await nextTick()

    assert.strictEqual(settingsStore.generationOptions.seaLevel, 0.55)
    assert.strictEqual(worker.runCount(), runsAfterStart)
  } finally {
    scope.stop()
  }
})

test('committing a slider value persists to settings and regenerates', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    const runsAfterStart = worker.runCount()

    ctx.onSliderCommit('seaLevel', 0.42)
    await nextTick()

    assert.strictEqual(settingsStore.generationOptions.seaLevel, 0.42)
    assert.strictEqual(worker.runCount(), runsAfterStart + 1)
  } finally {
    scope.stop()
  }
})

test('randomizeSeed updates seed input, settings, and regenerates', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    const runsAfterStart = worker.runCount()
    const originalRandom = Math.random
    Math.random = () => 0.25

    try {
      ctx.randomizeSeed()
      await nextTick()
    } finally {
      Math.random = originalRandom
    }

    const expectedSeed = (0.25 * 4294967296) | 0
    assert.strictEqual(ctx.seedInput.value, String(expectedSeed))
    assert.strictEqual(settingsStore.geographySeed, expectedSeed)
    assert.strictEqual(worker.runCount(), runsAfterStart + 1)
  } finally {
    scope.stop()
  }
})

test('committing a seed applies it to settings and regenerates', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    const runsAfterStart = worker.runCount()

    ctx.seedInput.value = '12345'
    ctx.commitSeed()
    await nextTick()

    assert.strictEqual(settingsStore.geographySeed, 12345)
    assert.strictEqual(worker.runCount(), runsAfterStart + 1)
  } finally {
    scope.stop()
  }
})

test('resetDefaults resets settings, restores overlay display settings, and regenerates', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const settingsStore = createFakeSettingsStore()
    const { ctx } = mountController(scope, {
      settingsStore,
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    ctx.setResourceOverlayDisplaySetting('arableMinimumProductivity', 0.9)
    const runsBeforeReset = worker.runCount()

    ctx.resetDefaults()
    await nextTick()

    assert.strictEqual(settingsStore.resetToDefaultsCount, 1)
    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.1)
    assert.strictEqual(worker.runCount(), runsBeforeReset + 1)
  } finally {
    scope.stop()
  }
})

test('focusValidationRow focuses the viewport only when the row has a map focus', async () => {
  const scope = effectScope(true)
  try {
    const viewport = createFakeViewport()
    const { ctx } = mountController(scope, { viewport })

    await ctx.start()
    await nextTick()

    ctx.focusValidationRow({})
    assert.strictEqual(viewport.focusCalls.length, 0)

    const mapFocus = { x: 3, y: 4 }
    ctx.focusValidationRow({ mapFocus })
    assert.strictEqual(viewport.focusCalls.length, 1)
    assert.strictEqual(viewport.focusCalls[0], mapFocus)
  } finally {
    scope.stop()
  }
})

test('a completed run resets overlay visibility', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)

    await ctx.start()
    await nextTick()
    ctx.toggleResourceOverlayVisibility('salt', true)
    assert.strictEqual(ctx.resourceOverlayVisibility.value.salt, true)

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.resourceOverlayVisibility.value.salt, false)
  } finally {
    scope.stop()
  }
})

test('resetOverlays clears overlay visibility and syncs viewport', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx, viewport } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    ctx.toggleResourceOverlayVisibility('timber', true)
    const runsBefore = worker.runCount()
    const syncsBeforeReset = viewport.overlaySyncs.length

    ctx.resetOverlays()

    assert.strictEqual(ctx.resourceOverlayVisibility.value.timber, false)
    assert.strictEqual(worker.runCount(), runsBefore)
    assert.ok(viewport.overlaySyncs.length > syncsBeforeReset)
    assert.strictEqual(viewport.overlaySyncs.at(-1).visibility.timber, false)
  } finally {
    scope.stop()
  }
})

test('start syncs overlay state when the viewport becomes ready', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport } = mountController(scope)

    await ctx.start()
    await nextTick()

    assert.ok(viewport.overlaySyncs.length > 0)
    assert.strictEqual(
      viewport.overlaySyncs.at(-1).displaySettings.arableMinimumProductivity,
      0.1,
    )
  } finally {
    scope.stop()
  }
})

test('toggleResourceOverlayVisibility syncs visibility to the viewport', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport } = mountController(scope)

    await ctx.start()
    await nextTick()
    const syncsBefore = viewport.overlaySyncs.length

    ctx.toggleResourceOverlayVisibility('salt', true)

    assert.strictEqual(ctx.resourceOverlayVisibility.value.salt, true)
    assert.ok(viewport.overlaySyncs.length > syncsBefore)
    assert.strictEqual(viewport.overlaySyncs.at(-1).visibility.salt, true)
  } finally {
    scope.stop()
  }
})

test('setResourceOverlayDisplaySetting persists to settings and syncs viewport', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, viewport } = mountController(scope)

    await ctx.start()
    await nextTick()
    const syncsBefore = viewport.overlaySyncs.length

    ctx.setResourceOverlayDisplaySetting('arableMinimumProductivity', 0.22)

    assert.strictEqual(settingsStore.overlayDisplaySettings.arableMinimumProductivity, 0.22)
    assert.strictEqual(ctx.overlayDisplaySetting('arableMinimumProductivity'), 0.22)
    assert.ok(viewport.overlaySyncs.length > syncsBefore)
    assert.strictEqual(
      viewport.overlaySyncs.at(-1).displaySettings.arableMinimumProductivity,
      0.22,
    )
  } finally {
    scope.stop()
  }
})

test('generation errors are forwarded to the error handler', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, errors } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onError?.('worker failed')
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'error')
    assert.deepStrictEqual(errors, ['worker failed'])
  } finally {
    scope.stop()
  }
})

test('every documented side-effect method is registered in the coverage matrix', () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)
    for (const method of Object.keys(SIDE_EFFECT_METHOD_COVERAGE)) {
      assert.equal(typeof ctx[method], 'function', `missing controller method: ${method}`)
    }
    assert.ok(
      Object.keys(SIDE_EFFECT_METHOD_COVERAGE).length >= 12,
      'matrix should list every PAGE-CONTROLLER-INTERFACE side-effect method',
    )
  } finally {
    scope.stop()
  }
})
