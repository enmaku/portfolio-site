import { computed, ref, shallowRef } from 'vue'
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
  shouldShowResourceOverlayBar,
  areColonizationTimeControlsDisabled,
} from '../../world-builder/worldBuilderPageModel.js'
import { createResourceOverlayDefinitions } from '../../world-builder/resourceOverlays.js'
import {
  buildGenerationStatusSection,
  buildOverlaysStatusSection,
  buildWorldBuilderStatusBar,
} from '../../world-builder/buildWorldBuilderStatusBar.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  mergeColonizationSessions,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import {
  colonizationAdvisoryRequiresConfirm,
  filterColonizationValidationRows,
  resolveColonizationGeographyGaps,
} from '../../world-builder/core/colonization/filterColonizationValidationRows.js'
import {
  buildColonizationSimStatus,
  shouldShowSimStatusPanel,
  shouldShowValidationAdvisory,
} from '../../world-builder/core/colonization/buildColonizationSimStatus.js'
import { buildRealmEconomyStatus } from '../../world-builder/core/colonization/buildRealmEconomyStatus.js'
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
import { useWorldBuilderCampaignKitExport } from './useWorldBuilderCampaignKitExport.js'
import { useWorldBuilderGeneration } from './useWorldBuilderGeneration.js'
import { useWorldBuilderOverlayState } from './useWorldBuilderOverlayState.js'
import { reportWorldBuilderError } from '../utils/worldBuilderErrorReporting.js'

const COLONIZATION_OVERLAY_IDS = new Set([
  'population',
  'settlements',
  'explorationFog',
  'routes',
  'wealth',
])

/** Auto-enabled once when `running` begins; wealth stays off until the user opts in. */
const COLONIZATION_OVERLAYS_AUTO_ENABLED_ON_RUNNING = new Set([
  'population',
  'settlements',
  'explorationFog',
  'routes',
])

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
  let colonizationRunningOverlaysEnabled = false

  function scheduleColonizationSessionPersist() {
    if (colonizationSessionPersistTimer !== null) {
      clearTimeout(colonizationSessionPersistTimer)
    }
    colonizationSessionPersistTimer = setTimeout(() => {
      colonizationSessionPersistTimer = null
      void persistColonizationSessionIfNeeded()
    }, 400)
  }

  function syncColonizationOverlayVisibility() {
    const phase = colonization.colonizationPhase.value
    if (phase === COLONIZATION_PHASE_TERRAIN) {
      for (const overlayId of COLONIZATION_OVERLAY_IDS) {
        if (overlay.visibility.value[overlayId]) {
          overlay.toggleVisibility(overlayId, false)
        }
      }
      colonizationRunningOverlaysEnabled = false
      return
    }
    if (phase !== COLONIZATION_PHASE_RUNNING) {
      colonizationRunningOverlaysEnabled = false
      return
    }
    if (colonizationRunningOverlaysEnabled) {
      return
    }
    for (const overlayId of COLONIZATION_OVERLAYS_AUTO_ENABLED_ON_RUNNING) {
      overlay.toggleVisibility(overlayId, true)
    }
    colonizationRunningOverlaysEnabled = true
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
    syncColonizationOverlayVisibility()
    void persistColonizationSessionIfNeeded()
  }

  colonization = useWorldBuilderColonization({
    settingsStore,
    requestConfirm,
    getViewport: () => mapLifecycle?.getViewport() ?? null,
    getGeographyDocument: () => generation?.worldDocument.value ?? null,
    onSliceChanged: syncColonizationDocumentToMap,
    colonizationMapPorts: {
      persistSession: () => {
        settingsStore.setColonizationSession?.(colonization.slice.value)
      },
      getBaseDocument: () => generation?.worldDocument.value ?? null,
      rehydrate: () => {
        const base = generation?.worldDocument.value
        if (base) {
          colonization.rehydrateDerivedOverlaysForWorldDocument(base)
        }
      },
      mergeDocument: () => {
        const base = generation?.worldDocument.value
        if (!base) {
          colonizationWorldDocument.value = null
          return null
        }
        const merged = colonization.mergeSliceIntoWorldDocument(base)
        colonizationWorldDocument.value = merged
        return merged
      },
      applyLayer: (doc, layerId) => {
        void mapLifecycle?.applyWorldDocument(doc, { changedLayers: [layerId] })
      },
      onComplete: async () => {
        syncColonizationOverlayVisibility()
        await persistColonizationSessionIfNeeded()
      },
    },
    onSessionPersistRequested: scheduleColonizationSessionPersist,
    getSessionRestorePending: () => isSessionRestorePending.value,
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
    syncColonizationOverlayVisibility()
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
    onRunCompleteSuccess: () => {
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
    shouldShowSimStatusPanel(colonization.colonizationPhase.value),
  )
  const simStatus = computed(() =>
    buildColonizationSimStatus(
      colonization.slice.value,
      colonizationWorldDocument.value ?? geographyWorldDocument.value,
    ),
  )
  const realmEconomy = computed(() =>
    buildRealmEconomyStatus(
      colonization.slice.value,
      colonizationWorldDocument.value ?? geographyWorldDocument.value,
    ),
  )
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

  const campaignKit = useWorldBuilderCampaignKitExport({
    getViewport: () => mapLifecycle?.getViewport() ?? null,
    getOverlayDisplaySettings: () => ({
      arableMinimumProductivity: overlay.overlayDisplaySetting('arableMinimumProductivity'),
    }),
    syncOverlayToViewport: () => overlay.syncToViewport(),
    getSlice: () => colonization.slice.value,
    getWorldDocument: () => colonizationWorldDocument.value ?? geographyWorldDocument.value,
    canExport: () => colonization.timeControlsActive.value === true,
    isOtherWorkBusy: () =>
      colonization.isEpochStepRunning.value ||
      colonization.isBeginColonizationRunning.value ||
      colonization.isRehydrationRunning.value ||
      isSessionRestorePending.value,
  })

  const colonizationBusyPhase = computed(() =>
    isEpochStepRunning.value ||
    isBeginColonizationRunning.value ||
    isRehydrationRunning.value ||
    isSessionRestorePending.value ||
    campaignKit.isCampaignKitExportRunning.value
      ? 'running'
      : 'idle',
  )
  const colonizationTimeControlsDisabled = computed(() =>
    areColonizationTimeControlsDisabled({
      epochStepRunning: isEpochStepRunning.value,
      rehydrationRunning: isRehydrationRunning.value,
      sessionRestorePending: isSessionRestorePending.value,
      campaignKitExportRunning: campaignKit.isCampaignKitExportRunning.value,
    }),
  )
  const showResourceOverlayBarComputed = computed(() =>
    shouldShowResourceOverlayBar(generation.runPhase.value, colonizationBusyPhase.value),
  )
  const resourceOverlayDefinitions = createResourceOverlayDefinitions()
  const visibleResourceOverlayDefinitions = computed(() =>
    colonization.colonizationPhase.value === COLONIZATION_PHASE_TERRAIN
      ? resourceOverlayDefinitions.filter(
          (definition) => !COLONIZATION_OVERLAY_IDS.has(definition.id),
        )
      : resourceOverlayDefinitions,
  )
  const statusBar = computed(() => {
    const generationSection = generation.showGenerationProgress.value
      ? buildGenerationStatusSection({
          percent: generation.generationProgress.value.percent,
          steps: generationStepStatuses.value,
          hydrologySubsteps: hydrologySubstepStatuses.value,
        })
      : null
    const overlaysSection = showResourceOverlayBarComputed.value
      ? buildOverlaysStatusSection({ definitions: visibleResourceOverlayDefinitions.value })
      : null
    return buildWorldBuilderStatusBar({
      generation: generationSection,
      colonization: colonization.colonizationStatusSection.value,
      campaignKit: campaignKit.statusSection.value,
      overlays: overlaysSection,
    })
  })
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

  function toggleResourceOverlayVisibility(overlayId, visible) {
    if (
      colonization.colonizationPhase.value === COLONIZATION_PHASE_TERRAIN &&
      COLONIZATION_OVERLAY_IDS.has(overlayId)
    ) {
      overlay.toggleVisibility(overlayId, false)
      return
    }
    overlay.toggleVisibility(overlayId, visible)
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
            syncColonizationOverlayVisibility()
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
      syncColonizationOverlayVisibility()
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
    worldDocument: colonizationWorldDocument,
    statusBar,
    generation: {
      runPhase: generation.runPhase,
      generationProgress: generation.generationProgress,
      showValidationFailureIndicator: generation.showValidationFailureIndicator,
    },
    overlays: {
      resourceOverlayVisibility: overlay.visibility,
      overlayDisplaySetting: overlay.overlayDisplaySetting,
      toggleResourceOverlayVisibility,
      setResourceOverlayDisplaySetting: overlay.setDisplaySetting,
    },
    colonization: {
      colonizationPhase: colonization.colonizationPhase,
      isTerrainLocked: colonization.isTerrainLocked,
      showTerrainAuthoringControls: colonization.showTerrainAuthoringControls,
      showColonistSettingsPanel: colonization.showColonistSettingsPanel,
      showRealmEconomyPanel: colonization.showRealmEconomyPanel,
      foundingLanding: colonization.foundingLanding,
      colonistSettings: colonization.colonistSettings,
      colonistSettingsSnapshot: colonization.colonistSettingsSnapshot,
      isColonistSettingsRunningPhase: colonization.isColonistSettingsRunningPhase,
      canBeginColonization: colonization.canBeginColonization,
      showResetColonization: colonization.showResetColonization,
      timeControlsActive: colonization.timeControlsActive,
      colonizationEpoch: colonization.epoch,
      colonizationSettlements: colonization.settlements,
      isEpochStepRunning,
      isBeginColonizationRunning,
      isRehydrationRunning,
      isSessionRestorePending,
      colonizationTimeControlsDisabled,
      isCampaignKitExportRunning: campaignKit.isCampaignKitExportRunning,
      exportCampaignKit: campaignKit.exportCampaignKit,
      enterColonizationSetup,
      backToTerrain,
      beginColonization: colonization.beginColonization,
      epochStep: colonization.epochStep,
      resetColonization,
      pickFoundingLanding: colonization.pickFoundingLanding,
      setColonistSetting: colonization.setColonistSetting,
      resetColonistSettings: colonization.resetColonistSettings,
      hoveredSettlementId: colonization.hoveredSettlementId,
      hoveredSettlementScreenPosition: colonization.hoveredSettlementScreenPosition,
      settlementTradeTooltip: colonization.settlementTradeTooltip,
      setSettlementFocus: colonization.setSettlementFocus,
    },
    validationRows,
    visibleValidationRows,
    showSimStatusPanel,
    simStatus,
    realmEconomy,
    stageSummary,
    hydrologyStats,
    hydrologySubstepTimings,
    controlValue,
    generationOptions,
    hasLandmass,
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
