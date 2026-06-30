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
 *     ensureInitialized: () => void,
 *     applySeed: (rawSeed: string | number) => void,
 *     setControl: (key: string, value: number | boolean) => void,
 *     resetToDefaults: () => void,
 *   },
 *   onGenerationError?: (message: string) => void,
 *   loadViewportFactory?: () => Promise<unknown>,
 *   createMapLifecycle?: typeof createGenerationMapLifecycle,
 *   runDerivedGeographyInWorker?: typeof defaultRunDerivedGeographyInWorker,
 * }} options
 */
export function useWorldBuilderPageController(options) {
  const {
    getMapHost,
    settingsStore,
    onGenerationError,
    loadViewportFactory = loadWorldBuilderViewportFactory,
    createMapLifecycle = createGenerationMapLifecycle,
    runDerivedGeographyInWorker = defaultRunDerivedGeographyInWorker,
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
    await mapLifecycle?.applyWorldDocument(doc)
  }

  const generation = useWorldBuilderGeneration({
    getDerivedGeographyParams,
    applyWorldDocument: applyWorldDocumentToMap,
    onBeforeRun: () => overlay.resetVisibility(),
    onRunCompleteSuccess: () => overlay.resetVisibility(),
    onRunError: (message) => onGenerationError?.(message),
    runDerivedGeographyInWorker,
  })

  const validationRows = computed(() =>
    createValidationRowsForDisplay(generation.worldDocument.value?.generationReport),
  )
  const stageSummary = computed(() =>
    createStageSummaryForDisplay(generation.worldDocument.value?.generationReport),
  )
  const hydrologyStats = computed(() =>
    createHydrologyStatsForDisplay(generation.worldDocument.value?.generationReport),
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
    createHydrologySubstepTimingsForDisplay(generation.worldDocument.value?.generationReport),
  )

  function regenerate() {
    generation.regenerate()
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
   * @param {string} key
   * @param {number | boolean} value
   */
  function onToggleChange(key, value) {
    settingsStore.setControl(key, value)
    regenerate()
  }

  /**
   * @param {string} key
   * @param {number | boolean} value
   */
  function onSliderInput(key, value) {
    settingsStore.setControl(key, value)
  }

  /**
   * @param {string} key
   * @param {number | boolean} value
   */
  function onSliderCommit(key, value) {
    settingsStore.setControl(key, value)
    regenerate()
  }

  /**
   * @param {{ mapFocus?: import('../../world-builder/core/types.js').MapFocus }} row
   */
  function focusValidationRow(row) {
    if (!row.mapFocus) return
    mapLifecycle?.getViewport()?.focusOn(row.mapFocus)
  }

  function commitSeed() {
    settingsStore.applySeed(seedInput.value)
    regenerate()
  }

  function randomizeSeed() {
    seedInput.value = String(createRandomGeographySeed())
    settingsStore.applySeed(seedInput.value)
    regenerate()
  }

  function resetDefaults() {
    settingsStore.resetToDefaults()
    overlay.applyPersistedDefaults()
    regenerate()
  }

  function resetOverlays() {
    overlay.resetVisibility()
  }

  async function start() {
    settingsStore.ensureInitialized()
    seedInput.value = String(settingsStore.geographySeed)
    overlay.hydrateFromPersistedSettings()

    createViewport = /** @type {typeof createViewport} */ (await loadViewportFactory())
    mapLifecycle = createMapLifecycle({
      getMapHost,
      getCreateViewport: () => createViewport,
      onViewportReady: () => overlay.syncToViewport(),
    })
    regenerate()
  }

  function destroy() {
    generation.dispose()
    mapLifecycle?.destroy()
    mapLifecycle = null
  }

  return {
    seedInput,
    runPhase: generation.runPhase,
    worldDocument: generation.worldDocument,
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
