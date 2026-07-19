import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick } from 'vue'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { buildTerrainCacheFingerprint } from '../../world-builder/core/terrainCacheFingerprint.js'
import { coastalLandmassDocument, fakeWorldDocument } from './worldBuilderColonizationTestFixtures.js'
import {
  createMemoryColonizationCache,
  createMemoryTerrainCache,
  createPendingWorker,
  createFakeSettingsStore,
  createFakeViewport,
  mountController,
  waitUntil,
} from './useWorldBuilderPageControllerTestFixtures.js'

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
    'a completed run preserves overlay visibility',
    'superseding regenerate ignores stale terminal callbacks from prior run',
    'supersede ignores stale step-complete world document from prior run',
    'rapid regenerate does not duplicate world document apply from stale worker',
  ],
  onToggleChange: ['onToggleChange persists to settings and regenerates'],
  onSliderInput: ['onSliderInput persists to settings without regenerating'],
  onSliderCommit: ['committing a slider value persists to settings and regenerates'],
  commitSeed: [
    'committing a seed applies it to settings and regenerates',
    'commitSeed preserves overlay visibility across regeneration',
  ],
  randomizeSeed: [
    'randomizeSeed updates seed input, settings, and regenerates',
    'randomizeSeed preserves overlay visibility across regeneration',
  ],
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
  // Core enterColonizationSetup/backToTerrain/pickFoundingLanding/setColonistSetting/
  // resetColonistSettings/beginColonization/epochStep/resetColonization behavior is
  // covered in useWorldBuilderColonization.test.js — these entries list only the
  // wiring-level tests still exercised through the full page controller.
  enterColonizationSetup: [
    'enterColonizationSetup persists locked terrain and colonization session',
    'see useWorldBuilderColonization.test.js for behavior coverage',
  ],
  backToTerrain: [
    'enterColonizationSetup persists locked terrain and colonization session',
    'see useWorldBuilderColonization.test.js for behavior coverage',
  ],
  pickFoundingLanding: [
    'start restores colonization phase from session after landmass regen',
    'see useWorldBuilderColonization.test.js for behavior coverage',
  ],
  setColonistSetting: ['see useWorldBuilderColonization.test.js for behavior coverage'],
  resetColonistSettings: ['see useWorldBuilderColonization.test.js for behavior coverage'],
  beginColonization: [
    'start restores running colonization from colonization cache after beginColonization refresh',
    'see useWorldBuilderColonization.test.js for behavior coverage',
  ],
  epochStep: ['see useWorldBuilderColonization.test.js for behavior coverage'],
  resetColonization: ['see useWorldBuilderColonization.test.js for behavior coverage'],
}

test('start runs initial generation and applies the world document to the map', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, appliedDocs } = mountController(scope)

    await ctx.start()
    await nextTick()

    assert.strictEqual(ctx.generation.runPhase.value, 'success')
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
    assert.strictEqual(ctx.generation.runPhase.value, 'running')

    ctx.destroy()
    await nextTick()

    assert.strictEqual(ctx.generation.runPhase.value, 'cancelled')
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

    assert.strictEqual(ctx.generation.runPhase.value, 'running')
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

    assert.strictEqual(ctx.generation.runPhase.value, 'running')
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

    assert.strictEqual(ctx.generation.runPhase.value, 'running')
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

    assert.strictEqual(ctx.generation.runPhase.value, 'success')
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
    ctx.overlays.setResourceOverlayDisplaySetting('arableMinimumProductivity', 0.9)
    const runsBeforeReset = worker.runCount()

    ctx.resetDefaults()
    await nextTick()

    assert.strictEqual(settingsStore.resetToDefaultsCount, 1)
    assert.strictEqual(ctx.overlays.overlayDisplaySetting('arableMinimumProductivity'), 0.1)
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

test('a completed run preserves overlay visibility', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)

    await ctx.start()
    await nextTick()
    ctx.overlays.toggleResourceOverlayVisibility('salt', true)
    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.salt, true)

    ctx.regenerate()
    await nextTick()

    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.salt, true)
  } finally {
    scope.stop()
  }
})

test('commitSeed preserves overlay visibility across regeneration', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)

    await ctx.start()
    await nextTick()
    ctx.overlays.toggleResourceOverlayVisibility('timber', true)
    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.timber, true)

    ctx.seedInput.value = '424242'
    ctx.commitSeed()
    await nextTick()

    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.timber, true)
  } finally {
    scope.stop()
  }
})

test('randomizeSeed preserves overlay visibility across regeneration', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)

    await ctx.start()
    await nextTick()
    ctx.overlays.toggleResourceOverlayVisibility('arable', true)
    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.arable, true)

    ctx.randomizeSeed()
    await nextTick()

    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.arable, true)
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
    ctx.overlays.toggleResourceOverlayVisibility('timber', true)
    const runsBefore = worker.runCount()
    const syncsBeforeReset = viewport.overlaySyncs.length

    ctx.resetOverlays()

    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.timber, false)
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

    ctx.overlays.toggleResourceOverlayVisibility('salt', true)

    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.salt, true)
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

    ctx.overlays.setResourceOverlayDisplaySetting('arableMinimumProductivity', 0.22)

    assert.strictEqual(settingsStore.overlayDisplaySettings.arableMinimumProductivity, 0.22)
    assert.strictEqual(ctx.overlays.overlayDisplaySetting('arableMinimumProductivity'), 0.22)
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

    assert.strictEqual(ctx.generation.runPhase.value, 'error')
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

    assert.strictEqual(ctx.generation.runPhase.value, 'running')
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
    await ctx.colonization.enterColonizationSetup()
    ctx.regenerate()
    await nextTick()

    assert.strictEqual(worker.runCount(), runsAfterStart)
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

    assert.strictEqual(ctx.colonization.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(ctx.worldDocument.value?.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(ctx.colonization.isTerrainLocked.value, true)
    assert.strictEqual(appliedDocs.at(-1)?.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.ok(viewport.placementModes.includes(true))
    viewport.triggerCellPick({ x: 3, y: 3 })
    await nextTick()
    assert.deepStrictEqual(ctx.colonization.foundingLanding.value, { x: 3, y: 3 })
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
    assert.strictEqual(ctx.generation.runPhase.value, 'success')
    assert.strictEqual(ctx.colonization.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
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
    await ctx.colonization.enterColonizationSetup()
    await nextTick()

    assert.ok(terrainCache.getRecord())
    assert.strictEqual(terrainCache.getRecord()?.worldDocument.gridWidth, landmass.gridWidth)
    assert.strictEqual(
      colonizationCache.getRecord()?.session.colonizationPhase,
      COLONIZATION_PHASE_SETUP,
    )

    await ctx.colonization.backToTerrain()
    await nextTick()
    assert.strictEqual(terrainCache.getRecord(), null)
    assert.strictEqual(colonizationCache.getRecord(), null)
  } finally {
    scope.stop()
  }
})

test('terrain authoring hides and disables colonization overlays', async () => {
  const scope = effectScope(true)
  try {
    const landmass = coastalLandmassDocument()
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
    const colonizationOverlayIds = ['population', 'settlements', 'explorationFog', 'routes', 'wealth']

    await ctx.start()
    await nextTick()

    for (const overlayId of colonizationOverlayIds) {
      assert.ok(!ctx.statusBar.value.overlayDefs.some((definition) => definition.id === overlayId))
      ctx.overlays.toggleResourceOverlayVisibility(overlayId, true)
      assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value[overlayId], false)
    }

    await ctx.colonization.enterColonizationSetup()
    ctx.colonization.pickFoundingLanding(3, 3)
    await ctx.colonization.beginColonization()
    await nextTick()

    for (const overlayId of colonizationOverlayIds) {
      assert.ok(ctx.statusBar.value.overlayDefs.some((definition) => definition.id === overlayId))
    }
    assert.ok(!ctx.statusBar.value.overlayDefs.some((definition) => definition.id === 'settlementIds'))
    for (const overlayId of ['population', 'settlements', 'explorationFog', 'routes']) {
      assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value[overlayId], true)
    }
    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.wealth, false)
    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.settlementIds, undefined)

    await ctx.colonization.resetColonization()
    await nextTick()

    for (const overlayId of colonizationOverlayIds) {
      assert.ok(!ctx.statusBar.value.overlayDefs.some((definition) => definition.id === overlayId))
      assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value[overlayId], false)
    }
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

    assert.strictEqual(ctx.colonization.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(ctx.worldDocument.value?.historyLog?.length, 1)
    assert.strictEqual(ctx.worldDocument.value?.settlements?.length, 1)
    assert.strictEqual(ctx.worldDocument.value?.realmId, 'realm-test')
    assert.strictEqual(ctx.colonization.isTerrainLocked.value, true)
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
    await ctx.colonization.enterColonizationSetup()
    ctx.colonization.pickFoundingLanding(3, 3)
    await ctx.colonization.beginColonization()
    await nextTick()

    for (const overlayId of ['population', 'settlements', 'explorationFog', 'routes']) {
      assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value[overlayId], true)
    }
    assert.strictEqual(ctx.overlays.resourceOverlayVisibility.value.wealth, false)
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
    assert.strictEqual(refreshed.colonization.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(refreshed.colonization.colonizationEpoch.value, 0)
    assert.strictEqual(refreshed.worldDocument.value?.settlements?.length, 1)
    assert.strictEqual(refreshed.worldDocument.value?.historyLog?.length, 1)
    assert.strictEqual(refreshed.colonization.timeControlsActive.value, true)
    assert.ok(refreshed.worldDocument.value?.populationCollapseRaster instanceof Float32Array)
  } finally {
    scope.stop()
  }
})

test('every documented side-effect method is registered in the coverage matrix', () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountController(scope)
    const resolveMethod = (method) =>
      ctx[method] ?? ctx.colonization?.[method] ?? ctx.overlays?.[method] ?? ctx.generation?.[method]
    for (const method of Object.keys(SIDE_EFFECT_METHOD_COVERAGE)) {
      assert.equal(typeof resolveMethod(method), 'function', `missing controller method: ${method}`)
    }
    assert.ok(
      Object.keys(SIDE_EFFECT_METHOD_COVERAGE).length >= 12,
      'matrix should list every PAGE-CONTROLLER-INTERFACE side-effect method',
    )
  } finally {
    scope.stop()
  }
})
