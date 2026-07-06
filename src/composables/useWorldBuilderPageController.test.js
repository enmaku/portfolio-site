import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import { SEA_LEVEL } from '../../world-builder/core/biomeIds.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  createDefaultColonistSettings,
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { buildTerrainCacheFingerprint } from '../../world-builder/core/terrainCacheFingerprint.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../../world-builder/core/worldGenerationOptions.js'
import { useWorldBuilderPageController } from './useWorldBuilderPageController.js'

/**
 * @param {() => unknown} getValue
 * @param {string} label
 * @returns {Promise<void>}
 */
async function waitUntil(getValue, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (getValue()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()
  }
  throw new Error(`Timed out waiting for ${label}`)
}

/**
 * PAGE-CONTROLLER-INTERFACE.md § Returned actions — side-effect methods and their
 * covering test titles in this file (375.7 matrix).
 * @type {Record<string, string[]>}
 */
const SIDE_EFFECT_METHOD_COVERAGE = {
  start: [
    'start runs initial generation and applies the world document to the map',
    'start syncs overlay state when the viewport becomes ready',
    'start restores running colonization from colonization cache after beginColonization refresh',
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
  enterColonizationSetup: [
    'enterColonizationSetup moves to setup when a landmass exists',
    'enterColonizationSetup is a no-op without a landmass',
    'enterColonizationSetup requires confirm when advisory has fail rows',
    'enterColonizationSetup skips confirm when advisory is warn-only',
    'enterColonizationSetup persists locked terrain and colonization session',
  ],
  backToTerrain: [
    'backToTerrain returns to terrain and discards setup progress',
  ],
  pickFoundingLanding: [
    'pickFoundingLanding accepts a valid coastal cell and updates haul-shed preview',
    'pickFoundingLanding snaps a nearby click to the nearest valid landing',
    'pickFoundingLanding rejects an invalid cell',
  ],
  setColonistSetting: [
    'setColonistSetting updates three-day haul distance and rescales preview',
  ],
  resetColonistSettings: [
    'resetColonistSettings restores colonist setting defaults in setup',
  ],
  beginColonization: [
    'beginColonization commits founding settlement tip and locks terrain',
    'beginColonization is disabled without a founding landing',
    'start restores running colonization from colonization cache after beginColonization refresh',
  ],
  epochStep: [
    'epochStep advances epoch by epochBatch and updates settlements',
    'epochStep is inactive outside running phase',
  ],
  resetColonization: [
    'resetColonization clears tips and returns to terrain when confirmed',
    'resetColonization stays in running when confirm is declined',
  ],
}

function coastalLandmassDocument() {
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.2)
  for (let y = 2; y < 6; y += 1) {
    elevation[y * width + 2] = SEA_LEVEL - 0.2
  }
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[3 * width + 3] = 1
  return fakeWorldDocument({
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation,
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(2),
    arableRaster: new Float32Array(cellCount).fill(1),
    timberRaster: new Float32Array(cellCount).fill(1),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    generationReport: {
      validationRows: [],
      validationSignals: { movement: { largestSailComponentCellCount: 8 } },
      largestSailComponentCellCount: 8,
    },
  })
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
    colonizationSession: createDefaultColonizationSlice(),
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
    setColonizationSession(slice) {
      this.colonizationSession = resolveColonizationSlice(slice)
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
  const landingMarkers = []
  const haulShedPreviews = []
  const placementModes = []
  /** @type {((cell: { x: number, y: number }) => void) | null} */
  let cellPickHandler = null
  return {
    focusCalls,
    overlaySyncs,
    landingMarkers,
    haulShedPreviews,
    placementModes,
    triggerCellPick(cell) {
      cellPickHandler?.(cell)
    },
    handle: {
      focusOn(focus) {
        focusCalls.push(focus)
      },
      syncOverlayRenderCache(state) {
        overlaySyncs.push(state)
      },
      setLandingPlacementMode(enabled) {
        placementModes.push(enabled)
      },
      setFoundingLandingMarker(marker) {
        landingMarkers.push(marker)
      },
      setHaulShedPreviewCells(cells) {
        haulShedPreviews.push(cells)
      },
      onCellPick(handler) {
        cellPickHandler = handler
      },
      updateWorldDocument() {},
      fitToWorld() {},
      destroy() {},
    },
  }
}

function createMemoryTerrainCache() {
  /** @type {{ fingerprint: string, worldDocument: import('../../world-builder/core/types.js').WorldDocument } | null} */
  let record = null
  return {
    async saveLockedTerrain(payload) {
      record = {
        fingerprint: payload.fingerprint,
        worldDocument: payload.worldDocument,
      }
    },
    async loadLockedTerrain(fingerprint) {
      if (!record || record.fingerprint !== fingerprint) {
        return null
      }
      return {
        worldDocument: record.worldDocument,
      }
    },
    async clearLockedTerrain() {
      record = null
    },
    getRecord() {
      return record
    },
  }
}

function createMemoryColonizationCache() {
  /** @type {{ fingerprint: string, session: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice } | null} */
  let record = null
  return {
    async saveColonizationSession(fingerprint, session) {
      record = { fingerprint, session }
    },
    async loadColonizationSession(fingerprint) {
      if (!record || record.fingerprint !== fingerprint) {
        return null
      }
      return record.session
    },
    async clearColonizationSession() {
      record = null
    },
    getRecord() {
      return record
    },
  }
}

/**
 * @param {import('vue').EffectScope} scope
 */
function mountController(scope, overrides = {}) {
  const appliedDocs = []
  const errors = []
  const confirmCalls = []
  const viewport = overrides.viewport ?? createFakeViewport()
  const terrainCache = overrides.terrainCache ?? createMemoryTerrainCache()
  const colonizationCache = overrides.colonizationCache ?? createMemoryColonizationCache()
  let lifecycleDestroyed = false
  let workerRunCount = 0

  const settingsStore = overrides.settingsStore ?? createFakeSettingsStore()

  const ctx = scope.run(() =>
    useWorldBuilderPageController({
      getMapHost: () => ({}),
      settingsStore,
      onGenerationError: (message) => errors.push(message),
      requestConfirm:
        overrides.requestConfirm ??
        (async () => {
          confirmCalls.push(true)
          return true
        }),
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
      loadLockedTerrain: terrainCache.loadLockedTerrain,
      saveLockedTerrain: terrainCache.saveLockedTerrain,
      clearLockedTerrain: terrainCache.clearLockedTerrain,
      loadColonizationSession: colonizationCache.loadColonizationSession,
      saveColonizationSession: colonizationCache.saveColonizationSession,
      clearColonizationSession: colonizationCache.clearColonizationSession,
      runDerivedGeographyInWorker:
        overrides.runDerivedGeographyInWorker ??
        ((_params, callbacks) => {
          workerRunCount += 1
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
    confirmCalls,
    terrainCache,
    colonizationCache,
    workerRunCount: () => workerRunCount,
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
    assert.strictEqual(appliedDocs.at(-1)?.geographySeed, currentDoc.geographySeed)

    firstRunCallbacks.onStepComplete?.({
      stepId: 'validation',
      stepIndex: 5,
      stepCount: 6,
      label: 'Validation',
      worldDocument: staleDoc,
    })
    await nextTick()

    assert.strictEqual(appliedDocs.length, appliedAfterStart + 1)
    assert.strictEqual(appliedDocs.at(-1)?.geographySeed, currentDoc.geographySeed)
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

test('validationRows stay empty before generation completes', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    assert.deepStrictEqual(ctx.validationRows.value, [])

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.runPhase.value, 'running')
    assert.deepStrictEqual(ctx.validationRows.value, [])

    worker.lastCallbacks().onStepComplete?.({
      stepId: 'validation',
      stepIndex: 5,
      stepCount: 6,
      label: 'Validation',
      worldDocument: fakeWorldDocument({
        generationReport: {
          validationRows: [{ checkId: 'coastMouth', status: 'fail', summary: 'x' }],
          validationSignals: { movement: { largestSailComponentCellCount: 0 } },
        },
      }),
    })
    await nextTick()
    assert.deepStrictEqual(ctx.validationRows.value, [])

    worker.lastCallbacks().onComplete?.()
    await nextTick()
    assert.ok(ctx.validationRows.value.length > 0)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup moves to setup when a landmass exists', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, appliedDocs } = mountController(scope)

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
    assert.strictEqual(ctx.hasLandmass.value, true)
    assert.strictEqual(ctx.showTerrainAuthoringControls.value, true)

    const entered = await ctx.enterColonizationSetup()
    await nextTick()

    assert.strictEqual(entered, true)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(ctx.showTerrainAuthoringControls.value, false)
    assert.strictEqual(ctx.isTerrainLocked.value, true)
    assert.strictEqual(ctx.showColonistSettingsPanel.value, true)
    assert.strictEqual(ctx.worldDocument.value?.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(settingsStore.colonizationSession.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(appliedDocs.at(-1)?.colonizationPhase, COLONIZATION_PHASE_SETUP)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup is a no-op without a landmass', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onError?.('no landmass')
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.hasLandmass.value, false)
    assert.strictEqual(await ctx.enterColonizationSetup(), false)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup requires confirm when advisory has fail rows', async () => {
  const scope = effectScope(true)
  try {
    const confirmCalls = []
    const { ctx } = mountController(scope, {
      requestConfirm: async () => {
        confirmCalls.push(true)
        return false
      },
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: fakeWorldDocument({
            generationReport: {
              validationRows: [{ checkId: 'coastMouth', status: 'fail', summary: 'x' }],
              validationSignals: { movement: { largestSailComponentCellCount: 0 } },
            },
          }),
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()

    assert.ok(ctx.validationRows.value.some((row) => row.status === 'fail'))
    assert.strictEqual(await ctx.enterColonizationSetup(), false)
    assert.strictEqual(confirmCalls.length, 1)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup skips confirm when advisory is warn-only', async () => {
  const scope = effectScope(true)
  try {
    const confirmCalls = []
    const { ctx } = mountController(scope, {
      requestConfirm: async () => {
        confirmCalls.push(true)
        return false
      },
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: fakeWorldDocument({
            lakeMask: new Uint8Array([1, 0, 0, 0]),
            generationReport: {
              validationRows: [{ checkId: 'arableEnvelopeCoverage', status: 'warn', summary: 'x' }],
              validationSignals: { movement: { largestSailComponentCellCount: 8 } },
              largestSailComponentCellCount: 8,
            },
          }),
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()

    assert.ok(ctx.validationRows.value.every((row) => row.status !== 'fail'))
    assert.strictEqual(await ctx.enterColonizationSetup(), true)
    assert.strictEqual(confirmCalls.length, 0)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
  } finally {
    scope.stop()
  }
})

test('backToTerrain returns to terrain and discards setup progress', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore } = mountController(scope)

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)

    const discarded = await ctx.backToTerrain()
    await nextTick()

    assert.strictEqual(discarded, true)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
    assert.strictEqual(ctx.showTerrainAuthoringControls.value, true)
    assert.strictEqual(ctx.isTerrainLocked.value, false)
    assert.strictEqual(ctx.showColonistSettingsPanel.value, false)
    assert.deepStrictEqual(
      settingsStore.colonizationSession,
      createDefaultColonizationSlice(),
    )
    assert.strictEqual(ctx.worldDocument.value?.colonizationPhase, COLONIZATION_PHASE_TERRAIN)
  } finally {
    scope.stop()
  }
})

test('regenerate is blocked while colonization setup locks terrain', async () => {
  const scope = effectScope(true)
  try {
    const worker = createPendingWorker()
    const { ctx } = mountController(scope, {
      runDerivedGeographyInWorker: (params, callbacks) => worker.run(params, callbacks),
    })

    await ctx.start()
    worker.lastCallbacks().onStepComplete?.({
      stepId: 'validation',
      stepIndex: 5,
      stepCount: 6,
      label: 'Validation',
      worldDocument: fakeWorldDocument(),
    })
    worker.lastCallbacks().onComplete?.()
    await nextTick()

    const runsAfterStart = worker.runCount()
    await ctx.enterColonizationSetup()
    ctx.regenerate()
    await nextTick()

    assert.strictEqual(worker.runCount(), runsAfterStart)
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding accepts a valid coastal cell and updates haul-shed preview', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, viewport, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()

    assert.strictEqual(ctx.pickFoundingLanding(3, 3), true)
    assert.deepStrictEqual(ctx.foundingLanding.value, { x: 3, y: 3 })
    assert.deepStrictEqual(settingsStore.colonizationSession.foundingLanding, { x: 3, y: 3 })
    assert.ok(viewport.landingMarkers.some((marker) => marker?.x === 3 && marker?.y === 3))
    assert.ok(viewport.haulShedPreviews.at(-1)?.length > 0)
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding updates the pin without syncing the map document', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, appliedDocs } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    const appliedAfterSetup = appliedDocs.length

    assert.strictEqual(ctx.pickFoundingLanding(3, 3), true)
    assert.strictEqual(appliedDocs.length, appliedAfterSetup)
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding snaps a nearby click to the nearest valid landing', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()

    assert.strictEqual(ctx.pickFoundingLanding(4, 3), true)
    assert.deepStrictEqual(ctx.foundingLanding.value, { x: 3, y: 3 })
    assert.deepStrictEqual(settingsStore.colonizationSession.foundingLanding, { x: 3, y: 3 })
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding rejects an invalid cell', async () => {
  const scope = effectScope(true)
  try {
    const width = 32
    const height = 32
    const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.2)
    for (let y = 4; y <= 6; y += 1) {
      for (let x = 4; x <= 6; x += 1) {
        elevation[y * width + x] = SEA_LEVEL + 0.2
      }
    }
    const landmass = fakeWorldDocument({
      gridWidth: width,
      gridHeight: height,
      fields: { elevation },
      lakeMask: new Uint8Array(width * height),
      generationReport: {
        validationRows: [],
        validationSignals: { movement: { largestSailComponentCellCount: 8 } },
        largestSailComponentCellCount: 8,
      },
    })
    const { ctx } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()

    assert.strictEqual(ctx.pickFoundingLanding(24, 24), false)
    assert.strictEqual(ctx.foundingLanding.value, null)
  } finally {
    scope.stop()
  }
})

test('resetColonistSettings restores colonist setting defaults in setup', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    ctx.setColonistSetting('threeDayHaulDistance', 1)
    ctx.setColonistSetting('startingPopulation', 50)
    ctx.setColonistSetting('yieldModifier', 'marginal')
    ctx.setColonistSetting('epochBatch', 10)

    ctx.resetColonistSettings()
    await nextTick()

    assert.deepStrictEqual(ctx.colonistSettings.value, createDefaultColonistSettings())
    assert.deepStrictEqual(
      settingsStore.colonizationSession.colonistSettings,
      createDefaultColonistSettings(),
    )
  } finally {
    scope.stop()
  }
})

test('setColonistSetting updates three-day haul distance and rescales preview', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, viewport } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    ctx.pickFoundingLanding(3, 3)
    ctx.setColonistSetting('threeDayHaulDistance', 1)
    const smallPreview = viewport.haulShedPreviews.at(-1)?.length ?? 0

    ctx.setColonistSetting('threeDayHaulDistance', 4)
    const largePreview = viewport.haulShedPreviews.at(-1)?.length ?? 0

    assert.strictEqual(ctx.colonistSettings.value.threeDayHaulDistance, 4)
    assert.ok(largePreview > smallPreview)
  } finally {
    scope.stop()
  }
})

test('beginColonization commits founding settlement tip and locks terrain', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, settingsStore, appliedDocs, viewport } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    assert.strictEqual(ctx.canBeginColonization.value, false)
    ctx.pickFoundingLanding(3, 3)
    assert.strictEqual(ctx.canBeginColonization.value, true)

    assert.strictEqual(await ctx.beginColonization(), true)
    await nextTick()

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(ctx.resourceOverlayVisibility.value.population, true)
    assert.strictEqual(ctx.worldDocument.value?.settlements?.length, 1)
    assert.strictEqual(ctx.worldDocument.value?.historyLog?.[0]?.kind, 'founding')
    assert.ok(ctx.worldDocument.value?.realmId)
    assert.strictEqual(ctx.isTerrainLocked.value, true)
    assert.strictEqual(ctx.timeControlsActive.value, true)
    assert.strictEqual(ctx.showResetColonization.value, true)
    assert.strictEqual(settingsStore.colonizationSession.colonizationPhase, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(appliedDocs.at(-1)?.colonizationPhase, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(appliedDocs.at(-1)?.settlements?.length, 1)
    assert.ok(appliedDocs.at(-1)?.populationCollapseRaster instanceof Float32Array)
    assert.ok(appliedDocs.at(-1)?.populationCollapseRaster.some((value) => value > 0))
    assert.strictEqual(viewport.landingMarkers.at(-1), null)
    assert.deepStrictEqual(viewport.haulShedPreviews.at(-1), [])
  } finally {
    scope.stop()
  }
})

test('epochStep advances epoch by epochBatch and updates settlements', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, settingsStore } = mountController(scope, {
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    ctx.pickFoundingLanding(3, 3)
    ctx.setColonistSetting('epochBatch', 2)
    await ctx.beginColonization()
    const populationBefore = ctx.worldDocument.value?.settlements?.[0]?.population ?? 0

    assert.strictEqual(await ctx.epochStep(), true)
    await nextTick()

    assert.strictEqual(ctx.colonizationEpoch.value, 2)
    assert.strictEqual(settingsStore.colonizationSession.epoch, 2)
    assert.ok(ctx.worldDocument.value?.settlements?.[0]?.population >= populationBefore)
    assert.strictEqual(ctx.timeControlsActive.value, true)
  } finally {
    scope.stop()
  }
})

test('epochStep is inactive outside running phase', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)
    await ctx.start()
    await nextTick()
    assert.strictEqual(await ctx.epochStep(), false)
    assert.strictEqual(ctx.timeControlsActive.value, false)
  } finally {
    scope.stop()
  }
})

test('beginColonization is disabled without a founding landing', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()

    assert.strictEqual(await ctx.beginColonization(), false)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
  } finally {
    scope.stop()
  }
})

test('resetColonization clears tips and returns to terrain when confirmed', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const confirmOptions = []
    const { ctx, settingsStore } = mountController(scope, {
      requestConfirm: async (options) => {
        confirmOptions.push(options)
        return true
      },
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()

    assert.strictEqual(await ctx.resetColonization(), true)
    await nextTick()

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
    assert.strictEqual(ctx.isTerrainLocked.value, false)
    assert.deepStrictEqual(settingsStore.colonizationSession, createDefaultColonizationSlice())
    assert.ok(confirmOptions.some((options) => options?.title))
  } finally {
    scope.stop()
  }
})

test('resetColonization stays in running when confirm is declined', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const { ctx, settingsStore } = mountController(scope, {
      requestConfirm: async () => false,
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()

    assert.strictEqual(await ctx.resetColonization(), false)
    await nextTick()

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(settingsStore.colonizationSession.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  } finally {
    scope.stop()
  }
})

test('start restores colonization phase from session after landmass regen', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const persisted = createDefaultColonizationSlice()
    persisted.colonizationPhase = COLONIZATION_PHASE_SETUP
    const { ctx, appliedDocs, viewport } = mountController(scope, {
      settingsStore: createFakeSettingsStore({ colonizationSession: persisted }),
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(ctx.worldDocument.value?.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(ctx.isTerrainLocked.value, true)
    assert.strictEqual(appliedDocs.at(-1)?.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.ok(viewport.placementModes.includes(true))
    viewport.triggerCellPick({ x: 3, y: 3 })
    await nextTick()
    assert.deepStrictEqual(ctx.foundingLanding.value, { x: 3, y: 3 })
  } finally {
    scope.stop()
  }
})

test('start restores locked terrain from cache without running the worker', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const persisted = createDefaultColonizationSlice()
    persisted.colonizationPhase = COLONIZATION_PHASE_SETUP
    const settingsStore = createFakeSettingsStore({ colonizationSession: persisted })
    const terrainCache = createMemoryTerrainCache()
    await terrainCache.saveLockedTerrain({
      fingerprint: buildTerrainCacheFingerprint({
        geographySeed: settingsStore.geographySeed,
        prevailingWindDegrees: settingsStore.prevailingWindDegrees,
        generationOptions: settingsStore.generationOptions,
      }),
      worldDocument: landmass,
    })

    let workerRuns = 0
    const { ctx, appliedDocs } = mountController(scope, {
      settingsStore,
      terrainCache,
      runDerivedGeographyInWorker: () => {
        workerRuns += 1
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()

    assert.strictEqual(workerRuns, 0)
    assert.strictEqual(ctx.runPhase.value, 'success')
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(appliedDocs.at(-1)?.gridWidth, landmass.gridWidth)
    assert.strictEqual(ctx.worldDocument.value?.colonizationPhase, COLONIZATION_PHASE_SETUP)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup persists locked terrain and colonization session', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const terrainCache = createMemoryTerrainCache()
    const colonizationCache = createMemoryColonizationCache()
    const { ctx } = mountController(scope, {
      terrainCache,
      colonizationCache,
      runDerivedGeographyInWorker: (_params, callbacks) => {
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    await nextTick()

    assert.ok(terrainCache.getRecord())
    assert.strictEqual(terrainCache.getRecord()?.worldDocument.gridWidth, landmass.gridWidth)
    assert.strictEqual(
      colonizationCache.getRecord()?.session.colonizationPhase,
      COLONIZATION_PHASE_SETUP,
    )

    await ctx.backToTerrain()
    await nextTick()
    assert.strictEqual(terrainCache.getRecord(), null)
    assert.strictEqual(colonizationCache.getRecord(), null)
  } finally {
    scope.stop()
  }
})

test('start restores running colonization session after landmass regen', async () => {
  const scope = effectScope(true)
  try {
    const persisted = createDefaultColonizationSlice()
    persisted.colonizationPhase = COLONIZATION_PHASE_RUNNING
    persisted.foundingLanding = { x: 3, y: 3 }
    persisted.settlements = [{ id: 's1', x: 3, y: 3, population: 100 }]
    persisted.historyLog = [{ kind: 'founding', epoch: 0 }]
    persisted.realmId = 'realm-test'
    const { ctx } = mountController(scope, {
      settingsStore: createFakeSettingsStore({ colonizationSession: persisted }),
    })

    await ctx.start()
    await waitUntil(() => ctx.worldDocument.value != null, 'colonization world document')

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(ctx.worldDocument.value?.historyLog?.length, 1)
    assert.strictEqual(ctx.worldDocument.value?.settlements?.length, 1)
    assert.strictEqual(ctx.worldDocument.value?.realmId, 'realm-test')
    assert.strictEqual(ctx.isTerrainLocked.value, true)
  } finally {
    scope.stop()
  }
})

test('start restores running colonization from colonization cache after beginColonization refresh', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
    const terrainCache = createMemoryTerrainCache()
    const colonizationCache = createMemoryColonizationCache()
    const settingsStore = createFakeSettingsStore()
    let workerRuns = 0
    const { ctx } = mountController(scope, {
      settingsStore,
      terrainCache,
      colonizationCache,
      runDerivedGeographyInWorker: (_params, callbacks) => {
        workerRuns += 1
        callbacks.onStepComplete?.({
          stepId: 'validation',
          stepIndex: 5,
          stepCount: 6,
          label: 'Validation',
          worldDocument: landmass,
        })
        callbacks.onComplete?.()
        return { cancel() {} }
      },
    })

    await ctx.start()
    await nextTick()
    await ctx.enterColonizationSetup()
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()
    await nextTick()

    assert.strictEqual(
      colonizationCache.getRecord()?.session.colonizationPhase,
      COLONIZATION_PHASE_RUNNING,
    )

    // Simulate stale localStorage that never received the running commit.
    settingsStore.colonizationSession = createDefaultColonizationSlice()
    settingsStore.colonizationSession.colonizationPhase = COLONIZATION_PHASE_SETUP
    settingsStore.colonizationSession.foundingLanding = { x: 3, y: 3 }

    ctx.destroy()
    await nextTick()

    const { ctx: refreshed } = mountController(scope, {
      settingsStore,
      terrainCache,
      colonizationCache,
      runDerivedGeographyInWorker: () => {
        workerRuns += 1
        return { cancel() {} }
      },
    })

    await refreshed.start()
    await nextTick()

    assert.strictEqual(workerRuns, 1)
    assert.strictEqual(refreshed.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(refreshed.colonizationEpoch.value, 0)
    assert.strictEqual(refreshed.worldDocument.value?.settlements?.length, 1)
    assert.strictEqual(refreshed.worldDocument.value?.historyLog?.length, 1)
    assert.strictEqual(refreshed.timeControlsActive.value, true)
    assert.ok(refreshed.worldDocument.value?.populationCollapseRaster instanceof Float32Array)
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
