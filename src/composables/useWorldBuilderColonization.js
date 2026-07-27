import { computed, ref, shallowRef } from 'vue'
import { yieldColonizationProgressToUi } from './colonizationUiYield.js'
import { createInitialBeginColonizationProgress } from '../../world-builder/core/colonization/beginColonizationProgress.js'
import {
  createInitialEpochStepProgress,
  reduceEpochStepProgressOnRunComplete,
} from '../../world-builder/core/colonization/colonizationEpochProgress.js'
import { runColonizationEpochStep } from '../../world-builder/core/colonization/runColonizationEpochStep.js'
import { finalizeColonizationMutation } from '../../world-builder/core/colonization/finalizeColonizationMutation.js'
import {
  needsColonizationDerivedOverlayRehydration,
  rehydrateColonizationDerivedOverlays,
  rehydrateColonizationDerivedOverlaysAsync,
} from '../../world-builder/core/colonization/rehydrateColonizationDerivedOverlays.js'
import {
  createInitialRehydrateColonizationProgress,
  reduceRehydrateColonizationProgressOnRunComplete,
  reduceRehydrateColonizationProgressOnSessionSubstepComplete,
  reduceRehydrateColonizationProgressOnSessionSubstepStart,
  reduceRehydrateColonizationProgressOnStepComplete,
  reduceRehydrateColonizationProgressOnStepStart,
} from '../../world-builder/core/colonization/rehydrateColonizationProgress.js'
import {
  COLONIZATION_SESSION_RESTORE_STEP_COUNT,
  COLONIZATION_SESSION_RESTORE_STEPS,
} from '../../world-builder/core/colonization/colonizationRehydrationSteps.js'
import { runBeginColonizationCommit } from '../../world-builder/core/colonization/runBeginColonizationCommit.js'
import { computeHaulShedReachPreview } from '../../world-builder/core/colonization/computeHaulShedReachPreview.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  createDefaultColonistSettings,
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import {
  applyColonizationSliceToWorldDocument,
  backToTerrain as backToTerrainTransition,
  enterColonizationSetup as enterColonizationSetupTransition,
} from '../../world-builder/core/colonization/colonizationPhaseTransitions.js'
import { snapFoundingLandingCell } from '../../world-builder/core/colonization/isValidFoundingLandingCell.js'
import { useWorldBuilderSettlementInspect } from './useWorldBuilderSettlementInspect.js'
import { useWorldBuilderColonizationProgressStatus } from './useWorldBuilderColonizationProgressStatus.js'

/**
 * Product colonization phase owner (terrain / setup / running). Distinct from generation runPhase.
 *
 * @param {{
 *   settingsStore: {
 *     colonizationSession?: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *     setColonizationSession?: (slice: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice) => void,
 *   },
 *   requestConfirm?: (options?: { title?: string, message?: string }) => boolean | Promise<boolean>,
 *   getViewport?: () => {
 *     setLandingPlacementMode?: (enabled: boolean) => void,
 *     setFoundingLandingMarker?: (marker: { x: number, y: number } | null) => void,
 *     setHaulShedPreviewCells?: (cells: Array<{ x: number, y: number }>) => void,
 *     onCellPick?: (handler: ((cell: { x: number, y: number }) => void) | null) => void,
 *     onSettlementHover?: (
 *       handler: ((payload: { settlementId: string, clientX: number, clientY: number } | null) => void) | null,
 *     ) => void,
 *   } | null,
 *   getGeographyDocument?: () => import('../../world-builder/core/types.js').WorldDocument | null,
 *   onSliceChanged?: () => void,
 *   colonizationMapPorts?: import('../../world-builder/core/colonization/finalizeColonizationMutation.js').ColonizationEpochMapPorts,
 *   onSessionPersistRequested?: () => void,
 *   getSessionRestorePending?: () => boolean,
 * }} options
 */
export function useWorldBuilderColonization(options) {
  const {
    settingsStore,
    requestConfirm,
    getViewport,
    getGeographyDocument,
    onSliceChanged,
    colonizationMapPorts,
    onSessionPersistRequested,
    getSessionRestorePending,
  } = options

  /** @type {import('vue').Ref<import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice>} */
  const slice = ref(loadInitialSlice())
  /** @type {import('vue').Ref<'idle' | 'running'>} */
  const epochStepPhase = ref('idle')
  /** @type {import('vue').Ref<'idle' | 'running'>} */
  const beginColonizationPhase = ref('idle')
  /** @type {import('vue').Ref<'idle' | 'running'>} */
  const rehydrationPhase = ref('idle')
  /** @type {import('vue').ShallowRef<import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonistSettings>} */
  const colonistSettingsSnapshot = shallowRef(createDefaultColonistSettings())
  /** @type {import('vue').Ref<import('../../world-builder/core/colonization/colonizationEpochProgress.js').EpochStepProgressState>} */
  const epochStepProgress = ref(createInitialEpochStepProgress())
  /** @type {import('vue').Ref<import('../../world-builder/core/colonization/beginColonizationProgress.js').BeginColonizationProgressState>} */
  const beginColonizationProgress = ref(createInitialBeginColonizationProgress())
  /** @type {import('vue').Ref<import('../../world-builder/core/colonization/rehydrateColonizationProgress.js').RehydrateColonizationProgressState>} */
  const rehydrationProgress = ref(createInitialRehydrateColonizationProgress())

  const {
    hoveredSettlementId,
    hoveredSettlementScreenPosition,
    focusedSettlementId,
    settlementTradeTooltip,
    clearSettlementHover,
    clearSettlementFocus,
    syncSettlementFocusMarker,
    setSettlementFocus,
    wireSettlementHover,
    wireSettlementFocusClear,
  } = useWorldBuilderSettlementInspect({
    getViewport,
    slice,
    getGeographyDocument,
  })

  const colonizationPhase = computed(() => slice.value.colonizationPhase)
  const isTerrainAuthoringEnabled = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_TERRAIN,
  )
  const isTerrainLocked = computed(() => !isTerrainAuthoringEnabled.value)
  const showTerrainAuthoringControls = computed(() => isTerrainAuthoringEnabled.value)
  const showColonistSettingsPanel = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_SETUP,
  )
  const showRealmEconomyPanel = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )
  const isBeginColonizationRunning = computed(() => beginColonizationPhase.value === 'running')
  const showBeginColonizationProgress = computed(
    () => beginColonizationPhase.value === 'running',
  )
  const canBeginColonization = computed(
    () =>
      slice.value.colonizationPhase === COLONIZATION_PHASE_SETUP &&
      slice.value.foundingLanding != null &&
      !isBeginColonizationRunning.value,
  )
  const showResetColonization = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )
  const timeControlsActive = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )
  const isEpochStepRunning = computed(() => epochStepPhase.value === 'running')
  const showEpochStepProgress = computed(() => epochStepPhase.value === 'running')
  const isRehydrationRunning = computed(() => rehydrationPhase.value === 'running')
  const showRehydrationProgress = computed(() => rehydrationPhase.value === 'running')
  const isColonistSettingsRunningPhase = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )

  function syncColonistSettingsSnapshot() {
    colonistSettingsSnapshot.value = { ...slice.value.colonistSettings }
  }

  function loadInitialSlice() {
    return resolveColonizationSlice(settingsStore.colonizationSession)
  }

  function persistSlice() {
    settingsStore.setColonizationSession?.(slice.value)
    onSliceChanged?.()
  }

  /** Session + debounced cache only — no map document sync. */
  function persistSessionOnly() {
    settingsStore.setColonizationSession?.(slice.value)
    onSessionPersistRequested?.()
  }

  function persistColonistSettingsOnly() {
    persistSessionOnly()
  }

  function hydrateFromPersistedSettings() {
    slice.value = resolveColonizationSlice(settingsStore.colonizationSession)
    if (slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING) {
      syncColonistSettingsSnapshot()
    }
  }

  /**
   * @param {boolean} hasLandmass
   * @param {{ requiresConfirm?: boolean }} [gate]
   * @returns {Promise<boolean>} whether phase entered setup
   */
  async function enterColonizationSetup(hasLandmass, gate = {}) {
    if (!hasLandmass) {
      return false
    }
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_TERRAIN) {
      return false
    }
    if (gate.requiresConfirm) {
      const confirmed = requestConfirm
        ? await requestConfirm({
            title: 'Colonize anyway?',
            message:
              'Colonization-relevant validation has errors. Proceed into colonization setup?',
          })
        : false
      if (!confirmed) {
        return false
      }
    }
    slice.value = enterColonizationSetupTransition(slice.value)
    persistSlice()
    syncLandingVisuals()
    return true
  }

  function backToTerrain() {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_SETUP) {
      return false
    }
    slice.value = backToTerrainTransition(slice.value)
    persistSlice()
    clearSettlementHover()
    clearSettlementFocus()
    syncLandingVisuals()
    return true
  }

  function syncLandingVisuals() {
    const viewport = getViewport?.()
    if (!viewport) {
      return
    }
    const phase = slice.value.colonizationPhase
    const placementEnabled = phase === COLONIZATION_PHASE_SETUP
    // Pin + haul-shed preview are setup-only; in running they sit on top of the
    // population overlay and hide the claimed-cell density.
    viewport.setLandingPlacementMode?.(placementEnabled)
    viewport.setFoundingLandingMarker?.(
      placementEnabled ? slice.value.foundingLanding : null,
    )
    viewport.setHaulShedPreviewCells?.(
      placementEnabled ? haulShedPreviewCells(getGeographyDocument?.() ?? null) : [],
    )
    if (placementEnabled) {
      viewport.onCellPick?.((cell) => {
        pickFoundingLanding(cell.x, cell.y)
      })
    } else {
      viewport.onCellPick?.(null)
    }
    wireSettlementFocusClear(viewport, { placementEnabled })
    syncSettlementFocusMarker()
    wireSettlementHover(viewport)
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function pickFoundingLanding(x, y) {
    return setFoundingLanding(getGeographyDocument?.() ?? null, x, y)
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   */
  function rehydrateDerivedOverlaysForWorldDocument(doc) {
    const resolvedSlice = rehydrateColonizationDerivedOverlays(slice.value, doc)
    if (resolvedSlice !== slice.value) {
      slice.value = resolvedSlice
    }
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   * @returns {import('../../world-builder/core/types.js').WorldDocument}
   */
  function mergeSliceIntoWorldDocument(doc) {
    return applyColonizationSliceToWorldDocument(doc, slice.value)
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   * @returns {import('../../world-builder/core/types.js').WorldDocument}
   */
  function applyToWorldDocument(doc) {
    rehydrateDerivedOverlaysForWorldDocument(doc)
    return mergeSliceIntoWorldDocument(doc)
  }

  function beginSessionRestore() {
    rehydrationPhase.value = 'running'
    rehydrationProgress.value = createInitialRehydrateColonizationProgress()
  }

  function endSessionRestore() {
    rehydrationPhase.value = 'idle'
    rehydrationProgress.value = createInitialRehydrateColonizationProgress()
  }

  function yieldSessionRestoreToUi() {
    return yieldColonizationProgressToUi()
  }

  /**
   * @template T
   * @param {number} stepIndex
   * @param {() => T | Promise<T>} work
   * @returns {Promise<T>}
   */
  async function runSessionRestoreStep(stepIndex, work) {
    const step = COLONIZATION_SESSION_RESTORE_STEPS[stepIndex]
    rehydrationProgress.value = reduceRehydrateColonizationProgressOnStepStart(
      rehydrationProgress.value,
      {
        stepIndex,
        label: step?.label ?? '',
      },
    )
    await yieldColonizationProgressToUi()
    const result = await work()
    rehydrationProgress.value = reduceRehydrateColonizationProgressOnStepComplete(
      rehydrationProgress.value,
      { stepIndex },
    )
    await yieldColonizationProgressToUi()
    return result
  }

  /**
   * @template T
   * @param {number} substepIndex
   * @param {() => T | Promise<T>} work
   * @returns {Promise<T>}
   */
  async function runSessionRestoreSubstep(substepIndex, work) {
    rehydrationProgress.value = reduceRehydrateColonizationProgressOnSessionSubstepStart(
      rehydrationProgress.value,
      { substepIndex },
    )
    await yieldColonizationProgressToUi()
    const result = await work()
    rehydrationProgress.value = reduceRehydrateColonizationProgressOnSessionSubstepComplete(
      rehydrationProgress.value,
      { substepIndex },
    )
    await yieldColonizationProgressToUi()
    return result
  }

  async function finalizeSessionRestoreProgress() {
    let progress = rehydrationProgress.value
    const lastStep = COLONIZATION_SESSION_RESTORE_STEP_COUNT - 1
    for (let stepIndex = progress.completedStepIndex + 1; stepIndex <= lastStep; stepIndex += 1) {
      progress = reduceRehydrateColonizationProgressOnStepComplete(progress, { stepIndex })
      rehydrationProgress.value = progress
      await yieldColonizationProgressToUi()
    }
    rehydrationProgress.value = reduceRehydrateColonizationProgressOnRunComplete(progress)
    await yieldColonizationProgressToUi()
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   * @param {{ preserveRestorePhase?: boolean }} [options]
   * @returns {Promise<import('../../world-builder/core/types.js').WorldDocument>}
   */
  async function applyToWorldDocumentAsync(doc, options = {}) {
    const preserveRestorePhase = options.preserveRestorePhase === true
    const restoring = rehydrationPhase.value === 'running'

    if (!needsColonizationDerivedOverlayRehydration(slice.value, doc)) {
      if (restoring) {
        await finalizeSessionRestoreProgress()
      }
      return applyToWorldDocument(doc)
    }

    if (!restoring) {
      rehydrationPhase.value = 'running'
      rehydrationProgress.value = createInitialRehydrateColonizationProgress()
    }

    try {
      const resolvedSlice = await rehydrateColonizationDerivedOverlaysAsync(slice.value, doc, {
        yieldToUi: yieldColonizationProgressToUi,
        initialProgress: restoring ? rehydrationProgress.value : undefined,
        skipInitialYield: restoring,
        handlers: {
          onProgress(progress) {
            rehydrationProgress.value = progress
          },
        },
      })
      slice.value = resolvedSlice
      return applyColonizationSliceToWorldDocument(doc, resolvedSlice)
    } finally {
      if (!preserveRestorePhase) {
        rehydrationPhase.value = 'idle'
        rehydrationProgress.value = createInitialRehydrateColonizationProgress()
      }
    }
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument | null | undefined} doc
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function setFoundingLanding(doc, x, y) {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_SETUP) {
      return false
    }
    const snapped = doc ? snapFoundingLandingCell(doc, x, y) : null
    if (!snapped) {
      return false
    }
    slice.value = {
      ...slice.value,
      foundingLanding: snapped,
    }
    persistSessionOnly()
    syncLandingVisuals()
    return true
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument | null | undefined} doc
   * @returns {Array<{ x: number, y: number }>}
   */
  function haulShedPreviewCells(doc) {
    const landing = slice.value.foundingLanding
    if (!landing || !doc) {
      return []
    }
    return computeHaulShedReachPreview({
      origin: landing,
      threeDayHaulDistance: slice.value.colonistSettings.threeDayHaulDistance,
      gridWidth: doc.gridWidth,
      gridHeight: doc.gridHeight,
      movementCost: doc.movementCost,
    })
  }

  async function beginColonization() {
    if (
      slice.value.colonizationPhase !== COLONIZATION_PHASE_SETUP ||
      !slice.value.foundingLanding ||
      isBeginColonizationRunning.value
    ) {
      return false
    }
    const doc = getGeographyDocument?.()
    if (!doc) {
      return false
    }

    beginColonizationPhase.value = 'running'
    beginColonizationProgress.value = createInitialBeginColonizationProgress()

    try {
      const result = await runBeginColonizationCommit(slice.value, doc, {
        yieldToUi: yieldColonizationProgressToUi,
        handlers: {
          onProgress(progress) {
            beginColonizationProgress.value = progress
          },
        },
      })
      if (!result.committed) {
        return false
      }
      slice.value = result.slice
      syncColonistSettingsSnapshot()

      await finalizeColonizationMutation({
        ports: colonizationMapPorts,
        fallbackPersist: persistSlice,
        reportFinalizeProgress: false,
      })

      syncLandingVisuals()
      return true
    } finally {
      beginColonizationPhase.value = 'idle'
      beginColonizationProgress.value = createInitialBeginColonizationProgress()
    }
  }

  function isColonizationProgressBlocking() {
    return isRehydrationRunning.value || (getSessionRestorePending?.() ?? false)
  }

  async function epochStep() {
    if (
      !timeControlsActive.value ||
      isEpochStepRunning.value ||
      isColonizationProgressBlocking()
    ) {
      return false
    }
    const doc = getGeographyDocument?.()
    if (!doc) {
      return false
    }

    epochStepPhase.value = 'running'
    epochStepProgress.value = createInitialEpochStepProgress()

    try {
      const result = await runColonizationEpochStep(slice.value, doc, {
        yieldToUi: yieldColonizationProgressToUi,
        handlers: {
          onProgress(progress) {
            epochStepProgress.value = progress
          },
        },
      })
      if (!result.ran) {
        return false
      }
      slice.value = result.slice
      clearSettlementFocus()

      await finalizeColonizationMutation({
        ports: colonizationMapPorts,
        fallbackPersist: () => {
          settingsStore.setColonizationSession?.(slice.value)
          onSliceChanged?.()
        },
        handlers: {
          getProgress: () => epochStepProgress.value,
          onProgress(next) {
            epochStepProgress.value = next
          },
          yieldToUi: yieldColonizationProgressToUi,
        },
      })

      epochStepProgress.value = reduceEpochStepProgressOnRunComplete(epochStepProgress.value)
      await yieldColonizationProgressToUi()

      syncLandingVisuals()
      return true
    } finally {
      epochStepPhase.value = 'idle'
      epochStepProgress.value = createInitialEpochStepProgress()
    }
  }

  /**
   * @returns {Promise<boolean>}
   */
  async function resetColonization() {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
      return false
    }
    if (isEpochStepRunning.value || isColonizationProgressBlocking()) {
      return false
    }
    const confirmed = requestConfirm
      ? await requestConfirm({
          title: 'Reset colonization?',
          message:
            'Abandon this run and return to terrain authoring? All colonization progress will be lost.',
        })
      : false
    if (!confirmed) {
      return false
    }
    slice.value = createDefaultColonizationSlice()
    persistSlice()
    clearSettlementHover()
    clearSettlementFocus()
    syncLandingVisuals()
    return true
  }

  /**
   * @param {keyof import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonistSettings} key
   * @param {unknown} value
   */
  function setColonistSetting(key, value) {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_SETUP) {
      return
    }
    slice.value = {
      ...slice.value,
      colonistSettings: {
        ...slice.value.colonistSettings,
        [key]: value,
      },
    }
    if (key === 'threeDayHaulDistance') {
      syncLandingVisuals()
    }
    persistColonistSettingsOnly()
  }

  function resetColonistSettings() {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_SETUP) {
      return
    }
    slice.value = {
      ...slice.value,
      colonistSettings: createDefaultColonistSettings(),
    }
    syncLandingVisuals()
    persistColonistSettingsOnly()
  }

  const {
    epochStepPhaseStatuses,
    epochStepNetworkSubstepStatuses,
    epochStepCollapseSubstepStatuses,
    epochStepFinalizeStepStatuses,
    epochStepMapSubstepStatuses,
    beginColonizationStepStatuses,
    rehydrationStepStatuses,
    rehydrationSessionSubstepStatuses,
    rehydrationVisitedSubstepStatuses,
    rehydrationCollapseSubstepStatuses,
    colonizationStatusSection,
  } = useWorldBuilderColonizationProgressStatus({
    epochStepProgress,
    beginColonizationProgress,
    rehydrationProgress,
    showBeginColonizationProgress,
    showEpochStepProgress,
    showRehydrationProgress,
    getSessionRestorePending,
  })

  return {
    slice,
    colonizationPhase,
    isTerrainAuthoringEnabled,
    isTerrainLocked,
    showTerrainAuthoringControls,
    showColonistSettingsPanel,
    showRealmEconomyPanel,
    foundingLanding: computed(() => slice.value.foundingLanding),
    colonistSettings: computed(() => slice.value.colonistSettings),
    colonistSettingsSnapshot,
    canBeginColonization,
    showResetColonization,
    timeControlsActive,
    isEpochStepRunning,
    isBeginColonizationRunning,
    showBeginColonizationProgress,
    beginColonizationProgress,
    showEpochStepProgress,
    epochStepProgress,
    epochStepPhaseStatuses,
    epochStepNetworkSubstepStatuses,
    epochStepCollapseSubstepStatuses,
    epochStepFinalizeStepStatuses,
    epochStepMapSubstepStatuses,
    beginColonizationStepStatuses,
    isRehydrationRunning,
    showRehydrationProgress,
    rehydrationProgress,
    rehydrationStepStatuses,
    rehydrationSessionSubstepStatuses,
    rehydrationVisitedSubstepStatuses,
    rehydrationCollapseSubstepStatuses,
    colonizationStatusSection,
    isColonistSettingsRunningPhase,
    hoveredSettlementId,
    hoveredSettlementScreenPosition,
    focusedSettlementId,
    settlementTradeTooltip,
    setSettlementFocus,
    clearSettlementFocus,
    hydrateFromPersistedSettings,
    enterColonizationSetup,
    backToTerrain,
    beginColonization,
    epochStep,
    resetColonization,
    epoch: computed(() => slice.value.epoch),
    settlements: computed(() => slice.value.settlements),
    applyToWorldDocument,
    applyToWorldDocumentAsync,
    rehydrateDerivedOverlaysForWorldDocument,
    mergeSliceIntoWorldDocument,
    beginSessionRestore,
    endSessionRestore,
    yieldSessionRestoreToUi,
    runSessionRestoreStep,
    runSessionRestoreSubstep,
    setFoundingLanding,
    pickFoundingLanding,
    haulShedPreviewCells,
    setColonistSetting,
    resetColonistSettings,
    syncLandingVisuals,
    createDefaultColonizationSlice,
  }
}
