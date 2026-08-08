import { nextTick } from 'vue'
import {
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../../world-builder/core/worldGenerationOptions.js'
import { useWorldBuilderPageController } from './useWorldBuilderPageController.js'
import { fakeWorldDocument } from './worldBuilderColonizationTestFixtures.js'

/**
 * @param {() => unknown} getValue
 * @param {string} label
 * @returns {Promise<void>}
 */
export async function waitUntil(getValue, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (getValue()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()
  }
  throw new Error(`Timed out waiting for ${label}`)
}

export function createFakeSettingsStore(initial = {}) {
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
export function createFakeViewport() {
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
      onSettlementHover() {},
      onPoliticalMarkerHover() {},
      updateWorldDocument() {},
      fitToWorld() {},
      destroy() {},
    },
  }
}

export function createMemoryTerrainCache() {
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

export function createMemoryColonizationCache() {
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
export function mountController(scope, overrides = {}) {
  const appliedDocs = []
  /** @type {import('../../world-builder/renderer/mapLayerRefresh.js').MapLayerId[][]} */
  const appliedChangedLayers = []
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
        async applyWorldDocument(doc, options = {}) {
          appliedDocs.push(doc)
          if (options.changedLayers) {
            appliedChangedLayers.push([...options.changedLayers])
          }
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
    appliedChangedLayers,
    errors,
    confirmCalls,
    terrainCache,
    colonizationCache,
    workerRunCount: () => workerRunCount,
    isLifecycleDestroyed: () => lifecycleDestroyed,
  }
}

/** Worker stub that stays running until its captured callbacks are driven manually. */
export function createPendingWorker() {
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
