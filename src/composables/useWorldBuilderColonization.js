import { computed, ref } from 'vue'
import { applyEpochStep } from '../../world-builder/core/colonization/applyEpochStep.js'
import { applyPopulationCollapse } from '../../world-builder/core/colonization/applyPopulationCollapse.js'
import { beginColonizationCommit } from '../../world-builder/core/colonization/beginColonizationCommit.js'
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
 *   } | null,
 *   getGeographyDocument?: () => import('../../world-builder/core/types.js').WorldDocument | null,
 *   onSliceChanged?: () => void,
 * }} options
 */
export function useWorldBuilderColonization(options) {
  const { settingsStore, requestConfirm, getViewport, getGeographyDocument, onSliceChanged } =
    options

  /** @type {import('vue').Ref<import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice>} */
  const slice = ref(loadInitialSlice())

  const colonizationPhase = computed(() => slice.value.colonizationPhase)
  const isTerrainAuthoringEnabled = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_TERRAIN,
  )
  const isTerrainLocked = computed(() => !isTerrainAuthoringEnabled.value)
  const showTerrainAuthoringControls = computed(() => isTerrainAuthoringEnabled.value)
  const showColonistSettingsPanel = computed(
    () =>
      slice.value.colonizationPhase === COLONIZATION_PHASE_SETUP ||
      slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )
  const canBeginColonization = computed(
    () =>
      slice.value.colonizationPhase === COLONIZATION_PHASE_SETUP &&
      slice.value.foundingLanding != null,
  )
  const showResetColonization = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )
  const timeControlsActive = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )
  const isColonistSettingsReadOnlyExceptEpochBatch = computed(
    () => slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING,
  )

  function loadInitialSlice() {
    return resolveColonizationSlice(settingsStore.colonizationSession)
  }

  function persistSlice() {
    settingsStore.setColonizationSession?.(slice.value)
    onSliceChanged?.()
  }

  function hydrateFromPersistedSettings() {
    slice.value = resolveColonizationSlice(settingsStore.colonizationSession)
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
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function pickFoundingLanding(x, y) {
    const accepted = setFoundingLanding(getGeographyDocument?.() ?? null, x, y)
    if (accepted) {
      syncLandingVisuals()
    }
    return accepted
  }

  /**
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   * @returns {import('../../world-builder/core/types.js').WorldDocument}
   */
  function applyToWorldDocument(doc) {
    const resolvedSlice = recomputePopulationCollapseRaster(slice.value, doc)
    if (resolvedSlice !== slice.value) {
      slice.value = resolvedSlice
    }
    return applyColonizationSliceToWorldDocument(doc, resolvedSlice)
  }

  /**
   * Derive collapse raster from settlements, claims, epoch, and geography (never loaded from storage).
   *
   * @param {import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} current
   * @param {import('../../world-builder/core/types.js').WorldDocument} doc
   * @returns {import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice}
   */
  function recomputePopulationCollapseRaster(current, doc) {
    if (current.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
      return current
    }
    const raster = current.populationCollapseRaster
    const expectedLength = doc.gridWidth * doc.gridHeight
    if (raster instanceof Float32Array && raster.length === expectedLength) {
      return current
    }
    return applyPopulationCollapse(current, doc).slice
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
    persistSlice()
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

  function beginColonization() {
    if (!canBeginColonization.value) {
      return false
    }
    const doc = getGeographyDocument?.()
    if (!doc) {
      return false
    }
    slice.value = beginColonizationCommit(slice.value, doc)
    persistSlice()
    syncLandingVisuals()
    return slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING
  }

  function epochStep() {
    if (!timeControlsActive.value) {
      return false
    }
    const doc = getGeographyDocument?.()
    if (!doc) {
      return false
    }
    slice.value = applyEpochStep(slice.value, doc)
    persistSlice()
    syncLandingVisuals()
    return true
  }

  /**
   * @returns {Promise<boolean>}
   */
  async function resetColonization() {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
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
    syncLandingVisuals()
    return true
  }

  /**
   * @param {keyof import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonistSettings} key
   * @param {unknown} value
   */
  function setColonistSetting(key, value) {
    if (
      slice.value.colonizationPhase !== COLONIZATION_PHASE_SETUP &&
      !(slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING && key === 'epochBatch')
    ) {
      return
    }
    slice.value = {
      ...slice.value,
      colonistSettings: {
        ...slice.value.colonistSettings,
        [key]: value,
      },
    }
    persistSlice()
    if (key === 'threeDayHaulDistance') {
      syncLandingVisuals()
    }
  }

  function resetColonistSettings() {
    if (slice.value.colonizationPhase === COLONIZATION_PHASE_RUNNING) {
      slice.value = {
        ...slice.value,
        colonistSettings: {
          ...slice.value.colonistSettings,
          epochBatch: createDefaultColonistSettings().epochBatch,
        },
      }
    } else if (slice.value.colonizationPhase === COLONIZATION_PHASE_SETUP) {
      slice.value = {
        ...slice.value,
        colonistSettings: createDefaultColonistSettings(),
      }
      syncLandingVisuals()
    } else {
      return
    }
    persistSlice()
  }

  return {
    slice,
    colonizationPhase,
    isTerrainAuthoringEnabled,
    isTerrainLocked,
    showTerrainAuthoringControls,
    showColonistSettingsPanel,
    foundingLanding: computed(() => slice.value.foundingLanding),
    colonistSettings: computed(() => slice.value.colonistSettings),
    canBeginColonization,
    showResetColonization,
    timeControlsActive,
    isColonistSettingsReadOnlyExceptEpochBatch,
    hydrateFromPersistedSettings,
    enterColonizationSetup,
    backToTerrain,
    beginColonization,
    epochStep,
    resetColonization,
    epoch: computed(() => slice.value.epoch),
    settlements: computed(() => slice.value.settlements),
    applyToWorldDocument,
    setFoundingLanding,
    pickFoundingLanding,
    haulShedPreviewCells,
    setColonistSetting,
    resetColonistSettings,
    syncLandingVisuals,
    createDefaultColonizationSlice,
  }
}
