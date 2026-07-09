import {
  COLONIZATION_SESSION_RESTORE_COLLAPSE_STEP_INDEX,
  COLONIZATION_SESSION_RESTORE_SESSION_STEP_INDEX,
  COLONIZATION_SESSION_RESTORE_STEP_COUNT,
} from './colonizationRehydrationSteps.js'
import { COLONIZATION_COLLAPSE_SUBSTEPS } from './colonizationEpochSteps.js'

/**
 * @typedef {Object} RehydrateColonizationProgressState
 * @property {number} percent
 * @property {number} activeStepIndex
 * @property {number} completedStepIndex
 * @property {string} label
 * @property {number} activeSessionSubstepIndex
 * @property {number} completedSessionSubstepIndex
 * @property {number} activeCollapseSubstepIndex
 * @property {number} completedCollapseSubstepIndex
 */

/**
 * @returns {RehydrateColonizationProgressState}
 */
export function createInitialRehydrateColonizationProgress() {
  return {
    percent: 0,
    activeStepIndex: -1,
    completedStepIndex: -1,
    label: 'Restoring session',
    activeSessionSubstepIndex: -1,
    completedSessionSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
  }
}

/**
 * @param {number} stepIndex
 * @param {number} [stepCount]
 * @returns {number}
 */
export function rehydrateColonizationProgressValue(
  stepIndex,
  stepCount = COLONIZATION_SESSION_RESTORE_STEP_COUNT,
) {
  if (stepCount <= 0) return 0
  return Math.round(((stepIndex + 1) / stepCount) * 100)
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @param {{ stepIndex: number, label: string }} payload
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnStepStart(progress, payload) {
  return {
    ...progress,
    activeStepIndex: payload.stepIndex,
    label: payload.label,
    activeSessionSubstepIndex:
      payload.stepIndex === COLONIZATION_SESSION_RESTORE_SESSION_STEP_INDEX
        ? -1
        : progress.activeSessionSubstepIndex,
    completedSessionSubstepIndex:
      payload.stepIndex === COLONIZATION_SESSION_RESTORE_SESSION_STEP_INDEX
        ? -1
        : progress.completedSessionSubstepIndex,
    activeCollapseSubstepIndex:
      payload.stepIndex === COLONIZATION_SESSION_RESTORE_COLLAPSE_STEP_INDEX
        ? -1
        : progress.activeCollapseSubstepIndex,
    completedCollapseSubstepIndex:
      payload.stepIndex === COLONIZATION_SESSION_RESTORE_COLLAPSE_STEP_INDEX
        ? -1
        : progress.completedCollapseSubstepIndex,
  }
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @param {{ stepIndex: number }} payload
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnStepComplete(progress, payload) {
  return {
    ...progress,
    percent: rehydrateColonizationProgressValue(payload.stepIndex),
    activeStepIndex: payload.stepIndex,
    completedStepIndex: payload.stepIndex,
    activeSessionSubstepIndex: -1,
    completedSessionSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
  }
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnSessionSubstepStart(progress, payload) {
  return {
    ...progress,
    activeSessionSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnSessionSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeSessionSubstepIndex: payload.substepIndex,
    completedSessionSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnCollapseSubstepStart(progress, payload) {
  const substep = COLONIZATION_COLLAPSE_SUBSTEPS[payload.substepIndex]
  return {
    ...progress,
    activeCollapseSubstepIndex: payload.substepIndex,
    label: progress.label.includes('·')
      ? `${progress.label.split(' · ')[0]} · Collapse · ${substep?.label ?? ''}`
      : `Collapse · ${substep?.label ?? ''}`,
  }
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnCollapseSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeCollapseSubstepIndex: payload.substepIndex,
    completedCollapseSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {RehydrateColonizationProgressState} progress
 * @returns {RehydrateColonizationProgressState}
 */
export function reduceRehydrateColonizationProgressOnRunComplete(progress) {
  return {
    ...progress,
    percent: 100,
    activeStepIndex: -1,
    activeSessionSubstepIndex: -1,
    activeCollapseSubstepIndex: -1,
  }
}
