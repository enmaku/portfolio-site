import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../../world-builder/core/worldGenerationOptions.js'
import { useWorldBuilderPageController } from './useWorldBuilderPageController.js'

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

test('resetOverlays clears overlay visibility without regenerating', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    await nextTick()
    ctx.toggleResourceOverlayVisibility('timber', true)
    const runsBefore = worker.runCount()

    ctx.resetOverlays()

    assert.strictEqual(ctx.resourceOverlayVisibility.value.timber, false)
    assert.strictEqual(worker.runCount(), runsBefore)
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
