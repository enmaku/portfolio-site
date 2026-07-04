import { computed, ref } from 'vue'
import {
  DERIVED_GEOGRAPHY_STEPS,
  HYDROLOGY_SUBSTEPS,
  runDerivedGeographyInWorker as defaultRunDerivedGeographyInWorker,
} from '../../world-builder/runDerivedGeographyInWorker.js'
import { createGenerationMapLifecycle } from '../../world-builder/worldBuilderGenerationMapLifecycle.js'
import {
  DEFAULT_GEOGRAPHY_SEED,
  buildDerivedGeographyParams,
  createGenerationStepStatuses,
  createHydrologyStatsForDisplay,
  createHydrologySubstepStatuses,
  createHydrologySubstepTimingsForDisplay,
  createRandomGeographySeed,
  createStageSummaryForDisplay,
  createValidationRowsForDisplay,
  parseGeographySeedInput,
} from '../../world-builder/worldBuilderPageModel.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import {
  colonizationAdvisoryRequiresConfirm,
  filterColonizationValidationRows,
  resolveColonizationGeographyGaps,
} from '../../world-builder/core/colonization/filterColonizationValidationRows.js'
import { buildTerrainCacheFingerprint } from '../../world-builder/core/terrainCacheFingerprint.js'
import {
  clearLockedTerrain as defaultClearLockedTerrain,
  loadLockedTerrain as defaultLoadLockedTerrain,
  saveLockedTerrain as defaultSaveLockedTerrain,
} from '../utils/worldBuilderTerrainCache.js'
import { useWorldBuilderColonization } from './useWorldBuilderColonization.js'
import { useWorldBuilderGeneration } from './useWorldBuilderGeneration.js'
import { useWorldBuilderOverlayState } from './useWorldBuilderOverlayState.js'

/** Lazy-load the renderer viewport factory; deferred so Vue never owns renderer logic. */
async function loadWorldBuilderViewportFactory() {
  const module = await import('@world-builder/renderer/createWorldBuilderMapViewport.js')
  return module.createWorldBuilderMapViewport
}

/**
 * Single app seam for the World Builder page: owns generation settings, generation
 * lifecycle, map lifecycle, overlay owner projection, the validation display model,
 * and cleanup. The Vue page renders markup and calls this interface; renderer logic
 * stays in the renderer package (ADR-0009).
 *
 * @param {{
 *   getMapHost: () => HTMLElement | null | undefined,
 *   settingsStore: import('./useWorldBuilderOverlayState.js').WorldBuilderOverlaySettingsStore & {
 *     geographySeed: number | null,
 *     prevailingWindDegrees: number,
 *     generationOptions: import('../../world-builder/core/types.js').WorldGenerationOptions,
 *     colonizationSession?: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *     ensureInitialized: () => void,
 *     applySeed: (rawSeed: string | number) => void,
 *     setControl: (key: string, value: number | boolean) => void,
 *     setColonizationSession?: (slice: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice) => void,
 *     resetToDefaults: () => void,
 *   },
 *   onGenerationError?: (message: string) => void,
 *   requestConfirm?: (options?: { title?: string, message?: string }) => boolean | Promise<boolean>,
 *   loadViewportFactory?: () => Promise<unknown>,
 *   createMapLifecycle?: typeof createGenerationMapLifecycle,
 *   runDerivedGeographyInWorker?: typeof defaultRunDerivedGeographyInWorker,
 *   loadLockedTerrain?: typeof defaultLoadLockedTerrain,
 *   saveLockedTerrain?: typeof defaultSaveLockedTerrain,
 *   clearLockedTerrain?: typeof defaultClearLockedTerrain,
 * }} options
 */
export function useWorldBuilderPageController(options) {
  const {
    getMapHost,
    settingsStore,
    onGenerationError,
    requestConfirm,
    loadViewportFactory = loadWorldBuilderViewportFactory,
    createMapLifecycle = createGenerationMapLifecycle,
    runDerivedGeographyInWorker = defaultRunDerivedGeographyInWorker,
    loadLockedTerrain = defaultLoadLockedTerrain,
    saveLockedTerrain = defaultSaveLockedTerrain,
    clearLockedTerrain = defaultClearLockedTerrain,
  } = options

  const seedInput = ref(String(DEFAULT_GEOGRAPHY_SEED))

  /** @type {((host: HTMLElement, doc: import('../../world-builder/core/types.js').WorldDocument) => Promise<unknown>) | null} */
  let createViewport = null
  /** @type {ReturnType<typeof createGenerationMapLifecycle> | null} */
  let mapLifecycle = null

  const overlay = useWorldBuilderOverlayState({
    getViewport: () => mapLifecycle?.getViewport() ?? null,
    settingsStore,
  })
  /** @type {ReturnType<typeof useWorldBuilderGeneration> | null} */
  let generation = null
  /** @type {ReturnType<typeof useWorldBuilderColonization>} */
  let colonization

  function syncColonizationDocumentToMap() {
    const doc = generation?.worldDocument.value
    if (!doc || !mapLifecycle) {
      return
    }
    void mapLifecycle.applyWorldDocument(colonization.applyToWorldDocument(doc))
    colonization.syncLandingVisuals()
  }

  colonization = useWorldBuilderColonization({
    settingsStore,
    requestConfirm,
    getViewport: () => mapLifecycle?.getViewport() ?? null,
    getGeographyDocument: () => generation?.worldDocument.value ?? null,
    onSliceChanged: syncColonizationDocumentToMap,
  })

  function getDerivedGeographyParams() {
    const parsedSeed = parseGeographySeedInput(seedInput.value)
    if (parsedSeed === null) {
      return null
    }
    return buildDerivedGeographyParams(
      parsedSeed,
      settingsStore.prevailingWindDegrees,
      settingsStore.generationOptions,
    )
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   */
  async function applyWorldDocumentToMap(doc) {
    await mapLifecycle?.applyWorldDocument(colonization.applyToWorldDocument(doc))
    colonization.syncLandingVisuals()
  }

  function currentTerrainFingerprint() {
    return buildTerrainCacheFingerprint({
      geographySeed: settingsStore.geographySeed ?? 0,
      prevailingWindDegrees: settingsStore.prevailingWindDegrees,
      generationOptions: settingsStore.generationOptions,
    })
  }

  async function persistLockedTerrainIfNeeded() {
    if (!colonization.isTerrainLocked.value) {
      return
    }
    const doc = generation?.worldDocument.value
    if (!doc) {
      return
    }
    try {
      await saveLockedTerrain({
        fingerprint: currentTerrainFingerprint(),
        worldDocument: doc,
      })
    } catch {
      // Cache is best-effort; regen remains the fallback.
    }
  }

  async function discardLockedTerrain() {
    try {
      await clearLockedTerrain()
    } catch {
      // ignore
    }
  }

  generation = useWorldBuilderGeneration({
    getDerivedGeographyParams,
    applyWorldDocument: applyWorldDocumentToMap,
    onBeforeRun: () => overlay.resetVisibility(),
    onRunCompleteSuccess: () => {
      overlay.resetVisibility()
      colonization.syncLandingVisuals()
      void persistLockedTerrainIfNeeded()
    },
    onRunError: (message) => onGenerationError?.(message),
    runDerivedGeographyInWorker,
  })

  const worldDocument = computed(() => {
    const doc = generation.worldDocument.value
    if (!doc) {
      return null
    }
    return colonization.applyToWorldDocument(doc)
  })
  const hasLandmass = computed(() => worldDocument.value != null)

  const validationRows = computed(() => {
    const runPhase = generation.runPhase.value
    if (runPhase !== 'success' && runPhase !== 'exhausted') {
      return []
    }
    const displayRows = createValidationRowsForDisplay(worldDocument.value?.generationReport)
    return filterColonizationValidationRows(
      displayRows,
      resolveColonizationGeographyGaps(worldDocument.value),
    )
  })
  const stageSummary = computed(() =>
    createStageSummaryForDisplay(worldDocument.value?.generationReport),
  )
  const hydrologyStats = computed(() =>
    createHydrologyStatsForDisplay(worldDocument.value?.generationReport),
  )
  const generationStepStatuses = computed(() =>
    createGenerationStepStatuses(
      DERIVED_GEOGRAPHY_STEPS,
      generation.generationProgress.value.activeStepIndex,
      generation.generationProgress.value.completedStepIndex,
    ),
  )
  const hydrologySubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      HYDROLOGY_SUBSTEPS,
      generation.generationProgress.value.activeHydrologySubstepIndex,
      generation.generationProgress.value.completedHydrologySubstepIndex,
      new Set(generation.generationProgress.value.skippedHydrologySubstepIds),
    ),
  )
  const hydrologySubstepTimings = computed(() =>
    createHydrologySubstepTimingsForDisplay(worldDocument.value?.generationReport),
  )
  const generationOptions = computed(() => settingsStore.generationOptions)

  /**
   * @param {{ force?: boolean }} [options]
   */
  function regenerate(options = {}) {
    if (!options.force && colonization.isTerrainLocked.value) {
      return
    }
    if (!colonization.isTerrainLocked.value) {
      void discardLockedTerrain()
    }
    generation.regenerate()
  }

  async function enterColonizationSetup() {
    const requiresConfirm = colonizationAdvisoryRequiresConfirm(validationRows.value)
    const entered = await colonization.enterColonizationSetup(hasLandmass.value, {
      requiresConfirm,
    })
    if (entered) {
      await persistLockedTerrainIfNeeded()
    }
    return entered
  }

  async function backToTerrain() {
    const result = colonization.backToTerrain()
    if (result) {
      await discardLockedTerrain()
    }
    return result
  }

  async function resetColonization() {
    const result = await colonization.resetColonization()
    if (result) {
      await discardLockedTerrain()
    }
    return result
  }

  function beginColonization() {
    const started = colonization.beginColonization()
    if (started) {
      overlay.toggleVisibility('population', true)
    }
    return started
  }

  /**
   * @param {string} key
   * @returns {number | boolean | undefined}
   */
  function controlValue(key) {
    if (key === 'prevailingWindDegrees') {
      return settingsStore.prevailingWindDegrees
    }
    return settingsStore.generationOptions[key]
  }

  /**
   * @template T
   * @param {() => T} fn
   * @returns {T | undefined}
   */
  function withTerrainAuthoring(fn) {
    if (colonization.isTerrainLocked.value) {
      return
    }
    return fn()
  }

  /**
   * @param {string} key
   * @param {number | boolean} value
   */
  function onToggleChange(key, value) {
    withTerrainAuthoring(() => {
      settingsStore.setControl(key, value)
      regenerate()
    })
  }

  /**
   * @param {string} key
   * @param {number | boolean} value
   */
  function onSliderInput(key, value) {
    withTerrainAuthoring(() => {
      settingsStore.setControl(key, value)
    })
  }

  /**
   * @param {string} key
   * @param {number | boolean} value
   */
  function onSliderCommit(key, value) {
    withTerrainAuthoring(() => {
      settingsStore.setControl(key, value)
      regenerate()
    })
  }

  /**
   * @param {{ mapFocus?: import('../../world-builder/core/types.js').MapFocus }} row
   */
  function focusValidationRow(row) {
    if (!row.mapFocus) return
    mapLifecycle?.getViewport()?.focusOn(row.mapFocus)
  }

  function commitSeed() {
    withTerrainAuthoring(() => {
      settingsStore.applySeed(seedInput.value)
      regenerate()
    })
  }

  function randomizeSeed() {
    withTerrainAuthoring(() => {
      seedInput.value = String(createRandomGeographySeed())
      settingsStore.applySeed(seedInput.value)
      regenerate()
    })
  }

  function resetDefaults() {
    withTerrainAuthoring(() => {
      settingsStore.resetToDefaults()
      overlay.applyPersistedDefaults()
      regenerate()
    })
  }

  function resetOverlays() {
    overlay.resetVisibility()
  }

  async function start() {
    settingsStore.ensureInitialized()
    seedInput.value = String(settingsStore.geographySeed)
    overlay.hydrateFromPersistedSettings()
    colonization.hydrateFromPersistedSettings()

    createViewport = /** @type {typeof createViewport} */ (await loadViewportFactory())
    mapLifecycle = createMapLifecycle({
      getMapHost,
      getCreateViewport: () => createViewport,
      onViewportReady: () => {
        overlay.syncToViewport()
        colonization.syncLandingVisuals()
      },
    })

    const phase = colonization.colonizationPhase.value
    if (phase === COLONIZATION_PHASE_SETUP || phase === COLONIZATION_PHASE_RUNNING) {
      try {
        const cached = await loadLockedTerrain(currentTerrainFingerprint())
        if (cached) {
          await generation.applyCachedWorldDocument(cached)
          if (phase === COLONIZATION_PHASE_RUNNING) {
            overlay.toggleVisibility('population', true)
          }
          return
        }
      } catch {
        // Fall through to regen.
      }
    }

    regenerate({ force: true })
    if (colonization.colonizationPhase.value === COLONIZATION_PHASE_RUNNING) {
      overlay.toggleVisibility('population', true)
    }
  }

  function destroy() {
    generation.dispose()
    mapLifecycle?.destroy()
    mapLifecycle = null
  }

  return {
    seedInput,
    runPhase: generation.runPhase,
    worldDocument,
    generationProgress: generation.generationProgress,
    showGenerationProgress: generation.showGenerationProgress,
    showResourceOverlayBar: generation.showResourceOverlayBar,
    showValidationFailureIndicator: generation.showValidationFailureIndicator,
    validationRows,
    stageSummary,
    hydrologyStats,
    generationStepStatuses,
    hydrologySubstepStatuses,
    hydrologySubstepTimings,
    resourceOverlayVisibility: overlay.visibility,
    overlayDisplaySetting: overlay.overlayDisplaySetting,
    toggleResourceOverlayVisibility: overlay.toggleVisibility,
    setResourceOverlayDisplaySetting: overlay.setDisplaySetting,
    controlValue,
    generationOptions,
    colonizationPhase: colonization.colonizationPhase,
    isTerrainLocked: colonization.isTerrainLocked,
    showTerrainAuthoringControls: colonization.showTerrainAuthoringControls,
    showColonistSettingsPanel: colonization.showColonistSettingsPanel,
    foundingLanding: colonization.foundingLanding,
    colonistSettings: colonization.colonistSettings,
    hasLandmass,
    enterColonizationSetup,
    backToTerrain,
    beginColonization,
    epochStep: colonization.epochStep,
    resetColonization,
    canBeginColonization: colonization.canBeginColonization,
    showResetColonization: colonization.showResetColonization,
    timeControlsActive: colonization.timeControlsActive,
    colonizationEpoch: colonization.epoch,
    colonizationSettlements: colonization.settlements,
    isColonistSettingsReadOnlyExceptEpochBatch:
      colonization.isColonistSettingsReadOnlyExceptEpochBatch,
    pickFoundingLanding: colonization.pickFoundingLanding,
    setColonistSetting: colonization.setColonistSetting,
    resetColonistSettings: colonization.resetColonistSettings,
    onToggleChange,
    onSliderInput,
    onSliderCommit,
    focusValidationRow,
    commitSeed,
    randomizeSeed,
    resetDefaults,
    resetOverlays,
    regenerate,
    start,
    destroy,
  }
}
