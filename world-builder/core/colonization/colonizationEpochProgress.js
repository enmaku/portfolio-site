import {
  COLONIZATION_COLLAPSE_SUBSTEPS,
  COLONIZATION_EPOCH_FINALIZE_STEPS,
  COLONIZATION_EPOCH_FINALIZE_STEP_COUNT,
  COLONIZATION_EPOCH_MAP_SUBSTEPS,
  COLONIZATION_EPOCH_PHASE_COUNT,
  COLONIZATION_EPOCH_PHASES,
  COLONIZATION_NETWORK_SUBSTEPS,
} from './colonizationEpochSteps.js'

/**
 * @typedef {Object} EpochStepProgressState
 * @property {number} percent
 * @property {number} activeEpochIndex
 * @property {number} completedEpochIndex
 * @property {number} activePhaseIndex
 * @property {number} completedPhaseIndex
 * @property {string} label
 * @property {number} activeNetworkSubstepIndex
 * @property {number} completedNetworkSubstepIndex
 * @property {number} activeCollapseSubstepIndex
 * @property {number} completedCollapseSubstepIndex
 * @property {number} activeFinalizeStepIndex
 * @property {number} completedFinalizeStepIndex
 * @property {number} activeMapSubstepIndex
 * @property {number} completedMapSubstepIndex
 */

/**
 * @returns {EpochStepProgressState}
 */
export function createInitialEpochStepProgress() {
  return {
    percent: 0,
    activeEpochIndex: -1,
    completedEpochIndex: -1,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: '',
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {number} unitIndex zero-based completed-or-active unit across phases + finalize
 * @param {number} unitCount phaseCount + finalizeStepCount
 * @returns {number}
 */
export function epochStepProgressValue(unitIndex, unitCount) {
  if (unitCount <= 0) return 0
  return Math.round(((unitIndex + 1) / unitCount) * 100)
}

/**
 * @param {number} phaseIndex
 * @returns {number}
 */
export function epochStepUnitIndex(phaseIndex) {
  return phaseIndex
}

/**
 * @returns {number}
 */
export function epochStepUnitCount() {
  return COLONIZATION_EPOCH_PHASE_COUNT + COLONIZATION_EPOCH_FINALIZE_STEP_COUNT
}

/**
 * @param {number} finalizeStepIndex
 * @returns {number}
 */
export function epochStepFinalizeUnitIndex(finalizeStepIndex) {
  return COLONIZATION_EPOCH_PHASE_COUNT + finalizeStepIndex
}

/**
 * @param {number} simulationEpoch slice epoch before the step runs
 * @returns {string}
 */
export function epochStepEpochLabel(simulationEpoch) {
  return `Epoch ${simulationEpoch + 1}`
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ simulationEpoch: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnEpochStart(progress, payload) {
  return {
    ...progress,
    activeEpochIndex: 0,
    completedEpochIndex: progress.completedEpochIndex,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: epochStepEpochLabel(payload.simulationEpoch),
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ simulationEpoch: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnEpochComplete(progress, payload) {
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepUnitIndex(COLONIZATION_EPOCH_PHASE_COUNT - 1)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: 0,
    completedEpochIndex: 0,
    activePhaseIndex: -1,
    completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    label: epochStepEpochLabel(payload.simulationEpoch),
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ simulationEpoch: number, phaseIndex: number, phaseId: string }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPhaseStart(progress, payload) {
  const phase = COLONIZATION_EPOCH_PHASES[payload.phaseIndex]
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepUnitIndex(payload.phaseIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: 0,
    activePhaseIndex: payload.phaseIndex,
    label: `${epochStepEpochLabel(payload.simulationEpoch)} · ${phase?.label ?? payload.phaseId}`,
    activeNetworkSubstepIndex: payload.phaseId === 'network' ? -1 : progress.activeNetworkSubstepIndex,
    completedNetworkSubstepIndex:
      payload.phaseId === 'network' ? -1 : progress.completedNetworkSubstepIndex,
    activeCollapseSubstepIndex:
      payload.phaseId === 'collapse' ? -1 : progress.activeCollapseSubstepIndex,
    completedCollapseSubstepIndex:
      payload.phaseId === 'collapse' ? -1 : progress.completedCollapseSubstepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ phaseIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPhaseComplete(progress, payload) {
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepUnitIndex(payload.phaseIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: 0,
    activePhaseIndex: payload.phaseIndex,
    completedPhaseIndex: payload.phaseIndex,
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnNetworkSubstepStart(progress, payload) {
  const substep = COLONIZATION_NETWORK_SUBSTEPS[payload.substepIndex]
  return {
    ...progress,
    activeNetworkSubstepIndex: payload.substepIndex,
    label: progress.label.includes('·')
      ? `${progress.label.split(' · ')[0]} · Network · ${substep?.label ?? ''}`
      : progress.label,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnNetworkSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeNetworkSubstepIndex: payload.substepIndex,
    completedNetworkSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnCollapseSubstepStart(progress, payload) {
  const substep = COLONIZATION_COLLAPSE_SUBSTEPS[payload.substepIndex]
  return {
    ...progress,
    activeCollapseSubstepIndex: payload.substepIndex,
    label: progress.label.includes('·')
      ? `${progress.label.split(' · ')[0]} · Collapse · ${substep?.label ?? ''}`
      : progress.label,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnCollapseSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeCollapseSubstepIndex: payload.substepIndex,
    completedCollapseSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ stepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnFinalizeStepStart(progress, payload) {
  const step = COLONIZATION_EPOCH_FINALIZE_STEPS[payload.stepIndex]
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepFinalizeUnitIndex(payload.stepIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: progress.completedEpochIndex,
    activePhaseIndex: -1,
    completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    label: step?.label ?? '',
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    activeFinalizeStepIndex: payload.stepIndex,
    activeMapSubstepIndex: payload.stepIndex === 1 ? -1 : progress.activeMapSubstepIndex,
    completedMapSubstepIndex: payload.stepIndex === 1 ? -1 : progress.completedMapSubstepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ stepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnFinalizeStepComplete(progress, payload) {
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepFinalizeUnitIndex(payload.stepIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeFinalizeStepIndex: payload.stepIndex,
    completedFinalizeStepIndex: payload.stepIndex,
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnMapSubstepStart(progress, payload) {
  const substep = COLONIZATION_EPOCH_MAP_SUBSTEPS[payload.substepIndex]
  return {
    ...progress,
    activeMapSubstepIndex: payload.substepIndex,
    label: progress.label.startsWith('Map')
      ? `Map · ${substep?.label ?? ''}`
      : progress.label,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnMapSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeMapSubstepIndex: payload.substepIndex,
    completedMapSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnRunComplete(progress) {
  return {
    ...progress,
    percent: 100,
    activeEpochIndex: -1,
    activePhaseIndex: -1,
    activeNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    activeFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
  }
}

/**
 * Yield to the browser so progress UI can paint between synchronous sim phases.
 *
 * @returns {Promise<void>}
 */
export function yieldEpochStepProgressToUi() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}
