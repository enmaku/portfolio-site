import { COLONIZATION_BEGIN_STEP_COUNT } from './colonizationBeginSteps.js'

/**
 * @typedef {Object} BeginColonizationProgressState
 * @property {number} percent
 * @property {number} activeStepIndex
 * @property {number} completedStepIndex
 * @property {string} label
 */

/**
 * @returns {BeginColonizationProgressState}
 */
export function createInitialBeginColonizationProgress() {
  return {
    percent: 0,
    activeStepIndex: -1,
    completedStepIndex: -1,
    label: 'Begin colonization',
  }
}

/**
 * @param {number} stepIndex
 * @param {number} stepCount
 * @returns {number}
 */
export function beginColonizationProgressValue(stepIndex, stepCount) {
  if (stepCount <= 0) return 0
  return Math.round(((stepIndex + 1) / stepCount) * 100)
}

/**
 * @param {BeginColonizationProgressState} progress
 * @param {{ stepIndex: number, label: string }} payload
 * @returns {BeginColonizationProgressState}
 */
export function reduceBeginColonizationProgressOnStepStart(progress, payload) {
  return {
    ...progress,
    activeStepIndex: payload.stepIndex,
    label: payload.label,
  }
}

/**
 * @param {BeginColonizationProgressState} progress
 * @param {{ stepIndex: number }} payload
 * @returns {BeginColonizationProgressState}
 */
export function reduceBeginColonizationProgressOnStepComplete(progress, payload) {
  return {
    ...progress,
    percent: beginColonizationProgressValue(payload.stepIndex, COLONIZATION_BEGIN_STEP_COUNT),
    activeStepIndex: payload.stepIndex,
    completedStepIndex: payload.stepIndex,
  }
}

/**
 * @param {BeginColonizationProgressState} progress
 * @returns {BeginColonizationProgressState}
 */
export function reduceBeginColonizationProgressOnRunComplete(progress) {
  return {
    ...progress,
    percent: 100,
    activeStepIndex: -1,
  }
}
