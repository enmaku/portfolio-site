import {
  COLONIZATION_COLLAPSE_SUBSTEPS,
  COLONIZATION_EPOCH_PHASE_COUNT,
  COLONIZATION_EPOCH_PHASES,
  COLONIZATION_NETWORK_SUBSTEPS,
} from './colonizationEpochSteps.js'

/**
 * @typedef {Object} EpochStepProgressState
 * @property {number} percent
 * @property {number} epochBatch
 * @property {number} activeEpochIndex
 * @property {number} completedEpochIndex
 * @property {number} activePhaseIndex
 * @property {number} completedPhaseIndex
 * @property {string} label
 * @property {number} activeNetworkSubstepIndex
 * @property {number} completedNetworkSubstepIndex
 * @property {number} activeCollapseSubstepIndex
 * @property {number} completedCollapseSubstepIndex
 */

/**
 * @param {number} epochBatch
 * @returns {EpochStepProgressState}
 */
export function createInitialEpochStepProgress(epochBatch = 1) {
  return {
    percent: 0,
    epochBatch: Math.max(1, Math.floor(epochBatch || 1)),
    activeEpochIndex: -1,
    completedEpochIndex: -1,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: '',
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
  }
}

/**
 * @param {number} unitIndex zero-based completed-or-active unit across batch × phases
 * @param {number} unitCount epochBatch × phaseCount
 * @returns {number}
 */
export function epochStepProgressValue(unitIndex, unitCount) {
  if (unitCount <= 0) return 0
  return Math.round(((unitIndex + 1) / unitCount) * 100)
}

/**
 * @param {number} epochIndex
 * @param {number} epochBatch
 * @param {number} phaseIndex
 * @returns {number}
 */
export function epochStepUnitIndex(epochIndex, epochBatch, phaseIndex) {
  return epochIndex * COLONIZATION_EPOCH_PHASE_COUNT + phaseIndex
}

/**
 * @param {number} epochBatch
 * @returns {number}
 */
export function epochStepUnitCount(epochBatch) {
  return Math.max(1, Math.floor(epochBatch || 1)) * COLONIZATION_EPOCH_PHASE_COUNT
}

/**
 * @param {number} epochIndex
 * @param {number} epochBatch
 * @returns {string}
 */
export function epochStepEpochLabel(epochIndex, epochBatch) {
  return `Epoch ${epochIndex + 1}/${epochBatch}`
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ epochIndex: number, epochBatch: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnEpochStart(progress, payload) {
  const epochBatch = payload.epochBatch
  return {
    ...progress,
    epochBatch,
    activeEpochIndex: payload.epochIndex,
    completedEpochIndex: progress.completedEpochIndex,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: epochStepEpochLabel(payload.epochIndex, epochBatch),
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ epochIndex: number, epochBatch: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnEpochComplete(progress, payload) {
  const unitCount = epochStepUnitCount(payload.epochBatch)
  const unitIndex = epochStepUnitIndex(payload.epochIndex, payload.epochBatch, COLONIZATION_EPOCH_PHASE_COUNT - 1)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: payload.epochIndex,
    completedEpochIndex: payload.epochIndex,
    activePhaseIndex: -1,
    completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    label: epochStepEpochLabel(payload.epochIndex, payload.epochBatch),
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ epochIndex: number, epochBatch: number, phaseIndex: number, phaseId: string }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPhaseStart(progress, payload) {
  const phase = COLONIZATION_EPOCH_PHASES[payload.phaseIndex]
  const unitCount = epochStepUnitCount(payload.epochBatch)
  const unitIndex = epochStepUnitIndex(payload.epochIndex, payload.epochBatch, payload.phaseIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: payload.epochIndex,
    activePhaseIndex: payload.phaseIndex,
    label: `${epochStepEpochLabel(payload.epochIndex, payload.epochBatch)} · ${phase?.label ?? payload.phaseId}`,
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
 * @param {{ epochIndex: number, epochBatch: number, phaseIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPhaseComplete(progress, payload) {
  const unitCount = epochStepUnitCount(payload.epochBatch)
  const unitIndex = epochStepUnitIndex(payload.epochIndex, payload.epochBatch, payload.phaseIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: payload.epochIndex,
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
