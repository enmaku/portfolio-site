import { computed, ref, shallowRef } from 'vue'
import {
  DERIVED_GEOGRAPHY_STEPS,
  HYDROLOGY_SUBSTEPS,
  runDerivedGeographyInWorker as defaultRunDerivedGeographyInWorker,
} from '../../world-builder/runDerivedGeographyInWorker.js'
import {
  COLONIZATION_COLLAPSE_SUBSTEPS,
  COLONIZATION_EPOCH_FINALIZE_STEPS,
  COLONIZATION_EPOCH_MAP_SUBSTEPS,
  COLONIZATION_EPOCH_PHASES,
  COLONIZATION_NETWORK_SUBSTEPS,
} from '../../world-builder/core/colonization/colonizationEpochSteps.js'
import {
  reduceEpochStepProgressOnMapSubstepComplete,
  reduceEpochStepProgressOnMapSubstepStart,
} from '../../world-builder/core/colonization/colonizationEpochProgress.js'
import { COLONIZATION_BEGIN_STEPS } from '../../world-builder/core/colonization/colonizationBeginSteps.js'
import { COLONIZATION_SESSION_RESTORE_SESSION_SUBSTEPS, COLONIZATION_SESSION_RESTORE_STEPS } from '../../world-builder/core/colonization/colonizationRehydrationSteps.js'
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
    colonization.rehydrateDerivedOverlaysForWorldDocument(base)
    const merged = colonization.mergeSliceIntoWorldDocument(base)
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

  /**
   * @param {{
   *   getProgress: () => import('../../world-builder/core/colonization/colonizationEpochProgress.js').EpochStepProgressState,
   *   onProgress: (progress: import('../../world-builder/core/colonization/colonizationEpochProgress.js').EpochStepProgressState) => void,
   *   yieldToUi: () => Promise<void>,
   * }} handlers
   */
  async function finalizeEpochMapSync(handlers) {
    /**
     * @param {number} substepIndex
     * @param {() => void | Promise<void>} work
     */
    async function runMapSubstep(substepIndex, work) {
      let progress = reduceEpochStepProgressOnMapSubstepStart(handlers.getProgress(), {
        substepIndex,
      })
      handlers.onProgress(progress)
      await handlers.yieldToUi()
      await work()
      progress = reduceEpochStepProgressOnMapSubstepComplete(progress, { substepIndex })
      handlers.onProgress(progress)
      await handlers.yieldToUi()
    }

    await runMapSubstep(0, () => {
      settingsStore.setColonizationSession?.(colonization.slice.value)
    })

    const base = generation?.worldDocument.value
    if (!base) {
      colonizationWorldDocument.value = null
      return
    }

    await runMapSubstep(1, () => {
      colonization.rehydrateDerivedOverlaysForWorldDocument(base)
    })

    await runMapSubstep(2, () => {
      colonizationWorldDocument.value = colonization.mergeSliceIntoWorldDocument(base)
    })

    const doc = colonizationWorldDocument.value
    if (!doc || !mapLifecycle) {
      return
    }

    await runMapSubstep(3, () =>
      mapLifecycle.applyWorldDocument(doc, { changedLayers: ['population'] }),
    )
    await runMapSubstep(4, () =>
      mapLifecycle.applyWorldDocument(doc, { changedLayers: ['explorationFog'] }),
    )
    await runMapSubstep(5, () =>
      mapLifecycle.applyWorldDocument(doc, { changedLayers: ['routes'] }),
    )
    await runMapSubstep(6, async () => {
      syncColonizationRunningOverlays()
      await persistColonizationSessionIfNeeded()
    })
  }

  colonization = useWorldBuilderColonization({
    settingsStore,
    requestConfirm,
    getViewport: () => mapLifecycle?.getViewport() ?? null,
    getGeographyDocument: () => generation?.worldDocument.value ?? null,
    onSliceChanged: syncColonizationDocumentToMap,
    finalizeEpochMapSync,
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
   * @param {{ preserveRestorePhase?: boolean }} [applyOptions]
   */
  async function applyWorldDocumentToMap(doc, applyOptions = {}) {
    const merged = await colonization.applyToWorldDocumentAsync(doc, applyOptions)
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

  async function restoreColonizationSessionFromCaches(fingerprint, options = {}) {
    const runSubstep = options.runSubstep ?? (async (_substepIndex, work) => work())

    const fromStore = await runSubstep(0, () => settingsStore.colonizationSession)

    let fromColonizationCache = null
    await runSubstep(1, async () => {
      try {
        fromColonizationCache = await loadColonizationSession(fingerprint)
      } catch (error) {
        reportCacheError('Failed to load colonization session cache', error)
      }
    })

    const merged = await runSubstep(2, () =>
      mergeColonizationSessions(fromStore, fromColonizationCache),
    )

    await runSubstep(3, () => {
      settingsStore.setColonizationSession?.(merged)
      colonization.hydrateFromPersistedSettings()
    })

    return merged
  }

  generation = useWorldBuilderGeneration({
    getDerivedGeographyParams,
    applyWorldDocument: (doc, applyOptions) => applyWorldDocumentToMap(doc, applyOptions),
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
  const rehydrationProgress = colonization.rehydrationProgress
  const isEpochStepRunning = colonization.isEpochStepRunning
  const isBeginColonizationRunning = colonization.isBeginColonizationRunning
  const isRehydrationRunning = colonization.isRehydrationRunning
  const isSessionRestorePending = computed(() => {
    if (colonizationWorldDocument.value) {
      return false
    }
    if (generation.runPhase.value === 'running') {
      return false
    }
    const phase = colonization.colonizationPhase.value
    return phase === COLONIZATION_PHASE_SETUP || phase === COLONIZATION_PHASE_RUNNING
  })
  const showRehydrationProgressEffective = computed(
    () => colonization.showRehydrationProgress.value || isSessionRestorePending.value,
  )
  const colonizationBusyPhase = computed(() =>
    isEpochStepRunning.value ||
    isBeginColonizationRunning.value ||
    isRehydrationRunning.value ||
    isSessionRestorePending.value
      ? 'running'
      : 'idle',
  )
  const epochStepPhaseStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_EPOCH_PHASES,
      epochStepProgress.value.activePhaseIndex,
      epochStepProgress.value.completedPhaseIndex,
    ),
  )
  const epochStepNetworkSubstepStatuses = computed(() => {
    const itemCount = epochStepProgress.value.networkSubstepItemCount
    const itemIndex = epochStepProgress.value.networkSubstepItemIndex
    const activeItemProgress =
      itemCount > 0 && itemIndex > 0 ? { itemIndex, itemCount } : null
    return createHydrologySubstepStatuses(
      COLONIZATION_NETWORK_SUBSTEPS,
      epochStepProgress.value.activeNetworkSubstepIndex,
      epochStepProgress.value.completedNetworkSubstepIndex,
      new Set(),
      activeItemProgress,
    )
  })
  const epochStepCollapseSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_COLLAPSE_SUBSTEPS,
      epochStepProgress.value.activeCollapseSubstepIndex,
      epochStepProgress.value.completedCollapseSubstepIndex,
    ),
  )
  const epochStepFinalizeStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_EPOCH_FINALIZE_STEPS,
      epochStepProgress.value.activeFinalizeStepIndex,
      epochStepProgress.value.completedFinalizeStepIndex,
    ),
  )
  const epochStepMapSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_EPOCH_MAP_SUBSTEPS,
      epochStepProgress.value.activeMapSubstepIndex,
      epochStepProgress.value.completedMapSubstepIndex,
    ),
  )
  const beginColonizationStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_BEGIN_STEPS,
      beginColonizationProgress.value.activeStepIndex,
      beginColonizationProgress.value.completedStepIndex,
    ),
  )
  const rehydrationStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_SESSION_RESTORE_STEPS,
      rehydrationProgress.value.activeStepIndex,
      rehydrationProgress.value.completedStepIndex,
    ),
  )
  const rehydrationSessionSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_SESSION_RESTORE_SESSION_SUBSTEPS,
      rehydrationProgress.value.activeSessionSubstepIndex,
      rehydrationProgress.value.completedSessionSubstepIndex,
    ),
  )
  const rehydrationCollapseSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_COLLAPSE_SUBSTEPS,
      rehydrationProgress.value.activeCollapseSubstepIndex,
      rehydrationProgress.value.completedCollapseSubstepIndex,
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
    overlay.resetVisibility({ persist: true })
  }

  async function beginColonization() {
    const started = await colonization.beginColonization()
    if (started) {
      await persistColonizationSessionIfNeeded()
    }
    return started
  }

  async function epochStep() {
    const stepped = await colonization.epochStep()
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

    const willRestoreSession =
      colonization.colonizationPhase.value === COLONIZATION_PHASE_SETUP ||
      colonization.colonizationPhase.value === COLONIZATION_PHASE_RUNNING

    if (willRestoreSession) {
      colonization.beginSessionRestore()
      await colonization.yieldSessionRestoreToUi()
    }

    try {
      if (willRestoreSession) {
        await colonization.runSessionRestoreStep(0, async () => {
          createViewport = /** @type {typeof createViewport} */ (await loadViewportFactory())
        })
      } else {
        createViewport = /** @type {typeof createViewport} */ (await loadViewportFactory())
      }

      mapLifecycle = createMapLifecycle({
        getMapHost,
        getCreateViewport: () => createViewport,
        onViewportReady: () => {
          overlay.syncToViewport()
          colonization.syncLandingVisuals()
        },
      })

      const fingerprint = currentTerrainFingerprint()
      if (willRestoreSession) {
        await colonization.runSessionRestoreStep(1, async () => {
          await restoreColonizationSessionFromCaches(fingerprint, {
            runSubstep: (substepIndex, work) =>
              colonization.runSessionRestoreSubstep(substepIndex, work),
          })
        })
      } else {
        await restoreColonizationSessionFromCaches(fingerprint)
      }

      const phase = colonization.colonizationPhase.value
      if (phase === COLONIZATION_PHASE_SETUP || phase === COLONIZATION_PHASE_RUNNING) {
        try {
          const cached = willRestoreSession
            ? await colonization.runSessionRestoreStep(2, async () => loadLockedTerrain(fingerprint))
            : await loadLockedTerrain(fingerprint)
          if (cached) {
            await generation.applyCachedWorldDocument(cached.worldDocument, {
              skipPersist: true,
              preserveRestorePhase: willRestoreSession,
            })
            syncColonizationRunningOverlays()
            return
          }
        } catch (error) {
          reportCacheError('Failed to load locked terrain cache', error)
        }
      }

      if (willRestoreSession) {
        colonization.endSessionRestore()
      }
      regenerate({ force: true })
      syncColonizationRunningOverlays()
    } finally {
      if (willRestoreSession && colonization.isRehydrationRunning.value) {
        colonization.endSessionRestore()
      }
    }
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
    showRehydrationProgress: showRehydrationProgressEffective,
    isSessionRestorePending,
    epochStepProgress,
    beginColonizationProgress,
    rehydrationProgress,
    isEpochStepRunning,
    isBeginColonizationRunning,
    isRehydrationRunning,
    epochStepPhaseStatuses,
    epochStepNetworkSubstepStatuses,
    epochStepCollapseSubstepStatuses,
    epochStepFinalizeStepStatuses,
    epochStepMapSubstepStatuses,
    beginColonizationStepStatuses,
    rehydrationStepStatuses,
    rehydrationSessionSubstepStatuses,
    rehydrationCollapseSubstepStatuses,
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
