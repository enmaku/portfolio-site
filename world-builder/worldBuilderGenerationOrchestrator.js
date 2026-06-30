import { generationProgressValue, shouldApplyStepPreviewToMap } from './worldBuilderPageModel.js'

/**
 * @typedef {import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} DerivedGeographyWorkerCallbacks
 * @typedef {import('./core/types.js').DerivedGeographyParams} DerivedGeographyParams
 */

/**
 * @typedef {Object} GenerationProgressState
 * @property {number} percent
 * @property {number} activeStepIndex
 * @property {number} completedStepIndex
 * @property {string} label
 * @property {number} activeHydrologySubstepIndex
 * @property {number} completedHydrologySubstepIndex
 * @property {string[]} skippedHydrologySubstepIds
 */

/**
 * @typedef {Object} GenerationRun
 * @property {number} runId
 * @property {() => boolean} isStale
 */

/**
 * @returns {GenerationProgressState}
 */
export function createInitialGenerationProgress() {
  return {
    percent: 0,
    activeStepIndex: -1,
    completedStepIndex: -1,
    label: '',
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex: -1,
    skippedHydrologySubstepIds: [],
  }
}

/**
 * @returns {{
 *   beginRun: () => GenerationRun,
 *   setActiveJob: (job: { cancel: () => void } | null) => void,
 *   cancelActive: () => void,
 *   clearActive: () => void,
 *   invalidateRuns: () => void,
 * }}
 */
export function createGenerationRunController() {
  let runId = 0
  /** @type {{ cancel: () => void } | null} */
  let activeJob = null

  return {
    beginRun() {
      runId += 1
      const currentRunId = runId
      activeJob?.cancel()
      activeJob = null
      return {
        runId: currentRunId,
        isStale: () => currentRunId !== runId,
      }
    },
    setActiveJob(job) {
      activeJob = job
    },
    cancelActive() {
      activeJob?.cancel()
      activeJob = null
    },
    clearActive() {
      activeJob = null
    },
    invalidateRuns() {
      runId += 1
    },
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ stepIndex: number, stepCount: number, label: string, stepId: string }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnStepStart(progress, payload) {
  return {
    percent: generationProgressValue(payload.stepIndex, payload.stepCount),
    activeStepIndex: payload.stepIndex,
    completedStepIndex: progress.completedStepIndex,
    label: payload.label,
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex:
      payload.stepId === 'hydrology' ? -1 : progress.completedHydrologySubstepIndex,
    skippedHydrologySubstepIds:
      payload.stepId === 'hydrology' ? [] : progress.skippedHydrologySubstepIds,
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnSubstepStart(progress, payload) {
  return {
    ...progress,
    activeHydrologySubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ substepIndex: number, substepId: string, skipped?: boolean }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeHydrologySubstepIndex: payload.substepIndex,
    completedHydrologySubstepIndex: payload.substepIndex,
    skippedHydrologySubstepIds: payload.skipped
      ? [...progress.skippedHydrologySubstepIds, payload.substepId]
      : progress.skippedHydrologySubstepIds,
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ stepIndex: number, stepCount: number, label: string, stepId: string }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnStepComplete(progress, payload) {
  return {
    percent: generationProgressValue(payload.stepIndex, payload.stepCount),
    activeStepIndex: payload.stepIndex,
    completedStepIndex: payload.stepIndex,
    label: payload.label,
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex:
      payload.stepId === 'hydrology' ? -1 : progress.completedHydrologySubstepIndex,
    skippedHydrologySubstepIds:
      payload.stepId === 'hydrology' ? [] : progress.skippedHydrologySubstepIds,
  }
}

/**
 * @param {Object} options
 * @param {ReturnType<typeof createGenerationRunController>} options.controller
 * @param {DerivedGeographyParams} options.params
 * @param {(params: DerivedGeographyParams, callbacks: DerivedGeographyWorkerCallbacks) => { cancel: () => void }} options.runDerivedGeographyInWorker
 * @param {{
 *   onRunStarted?: (payload: { runId: number, progress: GenerationProgressState }) => void,
 *   onProgress?: (progress: GenerationProgressState) => void,
 *   onWorldDocument?: (worldDocument: import('./core/types.js').WorldDocument) => void,
 *   onComplete?: () => void,
 *   onCancelled?: () => void,
 *   onError?: (message: string) => void,
 * }} [options.handlers]
 * @returns {{ runId: number, cancel: () => void }}
 */
export function startDerivedGeographyGeneration({
  controller,
  params,
  runDerivedGeographyInWorker,
  handlers = {},
}) {
  const { runId, isStale } = controller.beginRun()
  let progress = createInitialGenerationProgress()
  handlers.onRunStarted?.({ runId, progress })

  const job = runDerivedGeographyInWorker(params, {
    onStepStart(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnStepStart(progress, payload)
      handlers.onProgress?.(progress)
    },
    onSubstepStart(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnSubstepStart(progress, payload)
      handlers.onProgress?.(progress)
    },
    onSubstepComplete(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnSubstepComplete(progress, payload)
      handlers.onProgress?.(progress)
    },
    onStepComplete(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnStepComplete(progress, payload)
      handlers.onProgress?.(progress)
      if (shouldApplyStepPreviewToMap(payload.worldDocument)) {
        handlers.onWorldDocument?.(payload.worldDocument)
      }
    },
    onComplete() {
      if (isStale()) return
      controller.clearActive()
      progress = {
        ...progress,
        percent: 100,
        activeStepIndex: -1,
      }
      handlers.onProgress?.(progress)
      handlers.onComplete?.()
    },
    onCancelled() {
      if (isStale()) return
      controller.clearActive()
      handlers.onCancelled?.()
    },
    onError(message) {
      if (isStale()) return
      controller.clearActive()
      handlers.onError?.(message)
    },
  })

  controller.setActiveJob(job)

  return {
    runId,
    cancel: () => job.cancel(),
  }
}
