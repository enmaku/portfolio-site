import { generationProgressValue, shouldApplyStepPreviewToMap } from './worldBuilderGenerationPolicy.js'

/**
 * @typedef {import('./runDerivedGeographyInWorker.js').DerivedGeographyWorkerCallbacks} DerivedGeographyWorkerCallbacks
 * @typedef {import('./core/types.js').DerivedGeographyParams} DerivedGeographyParams
 */

/**
 * @typedef {Object} GenerationItemProgress
 * @property {number} itemIndex
 * @property {number} itemCount
 * @property {string} [phase]
 * @property {number} [phasePercent]
 */

/**
 * @typedef {Object} GenerationProgressState
 * @property {number} percent
 * @property {number} activeStepIndex
 * @property {number} completedStepIndex
 * @property {string} label
 * @property {string | null} activeNestedParentStepId
 * @property {number} activeHydrologySubstepIndex
 * @property {number} completedHydrologySubstepIndex
 * @property {string[]} skippedHydrologySubstepIds
 * @property {GenerationItemProgress | null} activeItemProgress
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
    activeNestedParentStepId: null,
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex: -1,
    skippedHydrologySubstepIds: [],
    activeItemProgress: null,
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
    activeNestedParentStepId: null,
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex: -1,
    skippedHydrologySubstepIds:
      payload.stepId === 'hydrology' ? [] : progress.skippedHydrologySubstepIds,
    activeItemProgress: null,
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ substepIndex: number, parentStepId?: string, stepId?: string }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnSubstepStart(progress, payload) {
  const parentStepId = payload.parentStepId ?? payload.stepId ?? progress.activeNestedParentStepId
  return {
    ...progress,
    activeNestedParentStepId: parentStepId ?? null,
    activeHydrologySubstepIndex: payload.substepIndex,
    activeItemProgress: null,
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ substepIndex: number, progress?: number, parentStepId?: string, stepId?: string }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnSubstepProgress(progress, payload) {
  const fraction = Number(payload.progress)
  const phasePercent = Number.isFinite(fraction)
    ? Math.max(0, Math.min(100, Math.round(fraction * 100)))
    : 0
  const parentStepId = payload.parentStepId ?? payload.stepId ?? progress.activeNestedParentStepId
  return {
    ...progress,
    activeNestedParentStepId: parentStepId ?? progress.activeNestedParentStepId,
    activeHydrologySubstepIndex: payload.substepIndex,
    activeItemProgress:
      phasePercent > 0
        ? {
            itemIndex: Math.max(1, phasePercent),
            itemCount: 100,
            phasePercent,
          }
        : null,
  }
}

/**
 * @param {GenerationProgressState} progress
 * @param {{ substepIndex: number, substepId: string, skipped?: boolean, parentStepId?: string, stepId?: string }} payload
 * @returns {GenerationProgressState}
 */
export function reduceGenerationProgressOnSubstepComplete(progress, payload) {
  const parentStepId = payload.parentStepId ?? payload.stepId ?? progress.activeNestedParentStepId
  const skippedIds =
    payload.skipped && parentStepId === 'hydrology'
      ? [...progress.skippedHydrologySubstepIds, payload.substepId]
      : progress.skippedHydrologySubstepIds
  return {
    ...progress,
    activeNestedParentStepId: parentStepId ?? null,
    activeHydrologySubstepIndex: payload.substepIndex,
    completedHydrologySubstepIndex: payload.substepIndex,
    skippedHydrologySubstepIds: skippedIds,
    activeItemProgress: null,
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
    activeNestedParentStepId: null,
    activeHydrologySubstepIndex: -1,
    completedHydrologySubstepIndex: -1,
    skippedHydrologySubstepIds:
      payload.stepId === 'hydrology' ? [] : progress.skippedHydrologySubstepIds,
    activeItemProgress: null,
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
 *   onExhausted?: () => void,
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
    onSubstepProgress(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnSubstepProgress(progress, payload)
      handlers.onProgress?.(progress)
      if (
        shouldApplyStepPreviewToMap({
          delivery: 'substep-progress',
          stepId: payload.parentStepId ?? payload.stepId ?? 'physicalTerrainBaseline',
          substepId: payload.substepId,
          worldDocument: payload.worldDocument,
        })
      ) {
        handlers.onWorldDocument?.(payload.worldDocument)
      }
    },
    onSubstepComplete(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnSubstepComplete(progress, payload)
      handlers.onProgress?.(progress)
      if (
        shouldApplyStepPreviewToMap({
          delivery: 'substep-complete',
          stepId: payload.parentStepId ?? payload.stepId ?? 'hydrology',
          substepId: payload.substepId,
          worldDocument: payload.worldDocument,
        })
      ) {
        handlers.onWorldDocument?.(payload.worldDocument)
      }
    },
    onStepComplete(payload) {
      if (isStale()) return
      progress = reduceGenerationProgressOnStepComplete(progress, payload)
      handlers.onProgress?.(progress)
      if (
        shouldApplyStepPreviewToMap({
          delivery: 'step-complete',
          stepId: payload.stepId,
          worldDocument: payload.worldDocument,
        })
      ) {
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
    onExhausted(worldDocument) {
      if (isStale()) return
      controller.clearActive()
      progress = {
        ...progress,
        percent: 100,
        activeStepIndex: -1,
      }
      handlers.onProgress?.(progress)
      if (shouldApplyStepPreviewToMap({ delivery: 'exhausted', worldDocument })) {
        handlers.onWorldDocument?.(worldDocument)
      }
      handlers.onExhausted?.()
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
    cancel() {
      job.cancel()
    },
  }
}
