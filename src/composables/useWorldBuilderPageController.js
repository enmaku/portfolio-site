import { computed, ref, shallowRef } from 'vue'
import {
  DERIVED_GEOGRAPHY_STEPS,
  HYDROLOGY_SUBSTEPS,
  runDerivedGeographyInWorker as defaultRunDerivedGeographyInWorker,
} from '../../world-builder/runDerivedGeographyInWorker.js'
import {
  COLONIZATION_COLLAPSE_SUBSTEPS,
  COLONIZATION_EPOCH_PHASES,
  COLONIZATION_NETWORK_SUBSTEPS,
} from '../../world-builder/core/colonization/colonizationEpochSteps.js'
import { COLONIZATION_BEGIN_STEPS } from '../../world-builder/core/colonization/colonizationBeginSteps.js'
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
  shouldShowResourceOverlayBar,
} from '../../world-builder/worldBuilderPageModel.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  mergeColonizationSessions,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import {
  colonizationAdvisoryRequiresConfirm,
  filterColonizationValidationRows,
  resolveColonizationGeographyGaps,
} from '../../world-builder/core/colonization/filterColonizationValidationRows.js'
import {
  buildColonizationSimStatus,
  buildFoundingChronicle,
  shouldShowSimStatusPanel,
  shouldShowValidationAdvisory,
} from '../../world-builder/core/colonization/buildColonizationSimStatus.js'
import { buildTerrainCacheFingerprint } from '../../world-builder/core/terrainCacheFingerprint.js'
import {
  clearLockedTerrain as defaultClearLockedTerrain,
  loadLockedTerrain as defaultLoadLockedTerrain,
  saveLockedTerrain as defaultSaveLockedTerrain,
} from '../utils/worldBuilderTerrainCache.js'
import {
  clearColonizationSession as defaultClearColonizationSession,
  loadColonizationSession as defaultLoadColonizationSession,
  saveColonizationSession as defaultSaveColonizationSession,
} from '../utils/worldBuilderColonizationCache.js'
import { useWorldBuilderColonization } from './useWorldBuilderColonization.js'
import { useWorldBuilderGeneration } from './useWorldBuilderGeneration.js'
import { useWorldBuilderOverlayState } from './useWorldBuilderOverlayState.js'
import { reportWorldBuilderError } from '../utils/worldBuilderErrorReporting.js'

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
 *   loadColonizationSession?: typeof defaultLoadColonizationSession,
 *   saveColonizationSession?: typeof defaultSaveColonizationSession,
 *   clearColonizationSession?: typeof defaultClearColonizationSession,
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
    loadColonizationSession = defaultLoadColonizationSession,
    saveColonizationSession = defaultSaveColonizationSession,
    clearColonizationSession = defaultClearColonizationSession,
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
  /** @type {ReturnType<typeof setTimeout> | null} */
  let colonizationSessionPersistTimer = null

  function scheduleColonizationSessionPersist() {
    if (colonizationSessionPersistTimer !== null) {
      clearTimeout(colonizationSessionPersistTimer)
    }
    colonizationSessionPersistTimer = setTimeout(() => {
      colonizationSessionPersistTimer = null
      void persistColonizationSessionIfNeeded()
    }, 400)
  }

  function syncColonizationRunningOverlays() {
    if (colonization.colonizationPhase.value === COLONIZATION_PHASE_RUNNING) {
      overlay.toggleVisibility('population', true)
    }
  }

  /** Merged geography + colonization; refreshed only on explicit map sync, not on every slice tick. */
  const colonizationWorldDocument = shallowRef(null)

  function refreshColonizationWorldDocument() {
    const base = generation?.worldDocument.value
    if (!base) {
      colonizationWorldDocument.value = null
      return null
    }
    const merged = colonization.applyToWorldDocument(base)
    colonizationWorldDocument.value = merged
    return merged
  }

  function syncColonizationDocumentToMap() {
    const doc = refreshColonizationWorldDocument()
    if (!doc || !mapLifecycle) {
      return
    }
    void mapLifecycle.applyWorldDocument(doc)
    syncColonizationRunningOverlays()
    void persistColonizationSessionIfNeeded()
  }

  colonization = useWorldBuilderColonization({
    settingsStore,
    requestConfirm,
    getViewport: () => mapLifecycle?.getViewport() ?? null,
    getGeographyDocument: () => generation?.worldDocument.value ?? null,
    onSliceChanged: syncColonizationDocumentToMap,
    onSessionPersistRequested: scheduleColonizationSessionPersist,
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
    const merged = colonization.applyToWorldDocument(doc)
    colonizationWorldDocument.value = merged
    await mapLifecycle?.applyWorldDocument(merged)
    colonization.syncLandingVisuals()
  }

  function currentTerrainFingerprint() {
    return buildTerrainCacheFingerprint({
      geographySeed: settingsStore.geographySeed ?? 0,
      prevailingWindDegrees: settingsStore.prevailingWindDegrees,
      generationOptions: settingsStore.generationOptions,
    })
  }

  function reportCacheError(context, error) {
    reportWorldBuilderError(context, error, onGenerationError)
  }

  async function persistColonizationSessionIfNeeded() {
    if (!colonization.isTerrainLocked.value) {
      return
    }
    try {
      await saveColonizationSession(currentTerrainFingerprint(), colonization.slice.value)
    } catch (error) {
      reportCacheError('Failed to save colonization session cache', error)
    }
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
    } catch (error) {
      reportCacheError('Failed to save locked terrain cache', error)
    }
    await persistColonizationSessionIfNeeded()
  }

  async function discardLockedTerrain() {
    try {
      await clearLockedTerrain()
      await clearColonizationSession()
    } catch (error) {
      reportCacheError('Failed to clear world builder terrain caches', error)
    }
  }

  async function restoreColonizationSessionFromCaches(fingerprint) {
    const fromStore = settingsStore.colonizationSession
    let fromColonizationCache = null
    try {
      fromColonizationCache = await loadColonizationSession(fingerprint)
    } catch (error) {
      reportCacheError('Failed to load colonization session cache', error)
    }
    const merged = mergeColonizationSessions(fromStore, fromColonizationCache)
    settingsStore.setColonizationSession?.(merged)
    colonization.hydrateFromPersistedSettings()
    return merged
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

  const geographyWorldDocument = computed(() => generation.worldDocument.value)
  const hasLandmass = computed(() => geographyWorldDocument.value != null)

  const validationRows = computed(() => {
    const runPhase = generation.runPhase.value
    if (runPhase !== 'success' && runPhase !== 'exhausted') {
      return []
    }
    const displayRows = createValidationRowsForDisplay(
      geographyWorldDocument.value?.generationReport,
    )
    return filterColonizationValidationRows(
      displayRows,
      resolveColonizationGeographyGaps(geographyWorldDocument.value),
    )
  })
  const visibleValidationRows = computed(() => {
    if (
      !shouldShowValidationAdvisory(
        colonization.colonizationPhase.value,
        colonization.epoch.value,
        validationRows.value.length,
      )
    ) {
      return []
    }
    return validationRows.value
  })
  const showSimStatusPanel = computed(() =>
    shouldShowSimStatusPanel(colonization.colonizationPhase.value, colonization.epoch.value),
  )
  const simStatus = computed(() => buildColonizationSimStatus(colonization.slice.value))
  const foundingChronicle = computed(() => buildFoundingChronicle(colonization.slice.value))
  const stageSummary = computed(() =>
    createStageSummaryForDisplay(geographyWorldDocument.value?.generationReport),
  )
  const hydrologyStats = computed(() =>
    createHydrologyStatsForDisplay(geographyWorldDocument.value?.generationReport),
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
    createHydrologySubstepTimingsForDisplay(geographyWorldDocument.value?.generationReport),
  )
  const showEpochStepProgress = colonization.showEpochStepProgress
  const showBeginColonizationProgress = colonization.showBeginColonizationProgress
  const epochStepProgress = colonization.epochStepProgress
  const beginColonizationProgress = colonization.beginColonizationProgress
  const isEpochStepRunning = colonization.isEpochStepRunning
  const isBeginColonizationRunning = colonization.isBeginColonizationRunning
  const colonizationBusyPhase = computed(() =>
    isEpochStepRunning.value || isBeginColonizationRunning.value ? 'running' : 'idle',
  )
  const epochStepPhaseStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_EPOCH_PHASES,
      epochStepProgress.value.activePhaseIndex,
      epochStepProgress.value.completedPhaseIndex,
    ),
  )
  const epochStepNetworkSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_NETWORK_SUBSTEPS,
      epochStepProgress.value.activeNetworkSubstepIndex,
      epochStepProgress.value.completedNetworkSubstepIndex,
    ),
  )
  const epochStepCollapseSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_COLLAPSE_SUBSTEPS,
      epochStepProgress.value.activeCollapseSubstepIndex,
      epochStepProgress.value.completedCollapseSubstepIndex,
    ),
  )
  const beginColonizationStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_BEGIN_STEPS,
      beginColonizationProgress.value.activeStepIndex,
      beginColonizationProgress.value.completedStepIndex,
    ),
  )
  const showResourceOverlayBarComputed = computed(() =>
    shouldShowResourceOverlayBar(generation.runPhase.value, colonizationBusyPhase.value),
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

  async function beginColonization() {
    const started = await colonization.beginColonization()
    if (started) {
      await persistColonizationSessionIfNeeded()
    }
    return started
  }

  async function epochStep() {
    const stepped = colonization.epochStep()
    if (stepped) {
      await persistColonizationSessionIfNeeded()
    }
    return stepped
  }

  async function start() {
    settingsStore.ensureInitialized()
    settingsStore.$hydrate?.()
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

    const fingerprint = currentTerrainFingerprint()
    await restoreColonizationSessionFromCaches(fingerprint)

    const phase = colonization.colonizationPhase.value
    if (phase === COLONIZATION_PHASE_SETUP || phase === COLONIZATION_PHASE_RUNNING) {
      try {
        const cached = await loadLockedTerrain(fingerprint)
        if (cached) {
          await generation.applyCachedWorldDocument(cached.worldDocument, { skipPersist: true })
          syncColonizationRunningOverlays()
          return
        }
      } catch (error) {
        reportCacheError('Failed to load locked terrain cache', error)
      }
    }

    regenerate({ force: true })
    syncColonizationRunningOverlays()
  }

  function destroy() {
    if (colonizationSessionPersistTimer !== null) {
      clearTimeout(colonizationSessionPersistTimer)
      colonizationSessionPersistTimer = null
    }
    generation.dispose()
    mapLifecycle?.destroy()
    mapLifecycle = null
  }

  return {
    seedInput,
    runPhase: generation.runPhase,
    worldDocument: colonizationWorldDocument,
    generationProgress: generation.generationProgress,
    showGenerationProgress: generation.showGenerationProgress,
    showResourceOverlayBar: showResourceOverlayBarComputed,
    showEpochStepProgress,
    showBeginColonizationProgress,
    epochStepProgress,
    beginColonizationProgress,
    isEpochStepRunning,
    isBeginColonizationRunning,
    epochStepPhaseStatuses,
    epochStepNetworkSubstepStatuses,
    epochStepCollapseSubstepStatuses,
    beginColonizationStepStatuses,
    showValidationFailureIndicator: generation.showValidationFailureIndicator,
    validationRows,
    visibleValidationRows,
    showSimStatusPanel,
    simStatus,
    foundingChronicle,
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
    colonistSettingsSnapshot: colonization.colonistSettingsSnapshot,
    pendingEpochBatch: colonization.pendingEpochBatch,
    setPendingEpochBatch: colonization.setPendingEpochBatch,
    isColonistSettingsRunningPhase: colonization.isColonistSettingsRunningPhase,
    hasLandmass,
    enterColonizationSetup,
    backToTerrain,
    beginColonization,
    epochStep: epochStep,
    resetColonization,
    canBeginColonization: colonization.canBeginColonization,
    showResetColonization: colonization.showResetColonization,
    timeControlsActive: colonization.timeControlsActive,
    colonizationEpoch: colonization.epoch,
    colonizationSettlements: colonization.settlements,
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
