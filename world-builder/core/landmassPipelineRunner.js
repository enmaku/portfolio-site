import { buildWorldDocumentFromPipelineState } from './buildWorldDocumentFromPipelineState.js'
import { cloneWorldDocument } from './cloneWorldDocument.js'
import {
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runPipelineStep,
  shouldAttachLandmassStepPreview,
} from './derivedGeographyPipeline.js'
import {
  LandmassPipelineCancelledError,
  isLandmassPipelineCancelledError,
} from './landmassPipelineTypes.js'
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyStepId} DerivedGeographyStepId */
/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState */
/** @typedef {import('./landmassPipelineTypes.js').PipelineStepOptions} PipelineStepOptions */
/** @typedef {import('./derivedGeographyPipeline.js').LandmassPipelineRunResult} LandmassPipelineRunResult */
/** @typedef {import('./derivedGeographyPipeline.js').LandmassPipelineRunCallbacks} LandmassPipelineRunCallbacks */

/**
 * @typedef {Object} LandmassPipelineExecutionHooks
 * @property {() => boolean | Promise<boolean>} shouldCancel
 * @property {() => void | Promise<void>} [afterStep]
 */

/**
 * @param {unknown} value
 * @returns {value is Promise<unknown>}
 */
export function isThenable(value) {
  return value != null && typeof /** @type {{ then?: unknown }} */ (value).then === 'function'
}

/**
 * @template T
 * @param {T | Promise<T>} value
 * @param {(resolved: T) => U} continuation
 * @param {(error: unknown) => V} [onError]
 * @returns {U | V | Promise<U | V>}
 * @template U
 * @template V
 */
function continuePipeline(value, continuation, onError) {
  if (isThenable(value)) {
    const next = value.then(continuation)
    return onError ? next.catch(onError) : next
  }
  try {
    return continuation(value)
  } catch (error) {
    if (onError) {
      return onError(error)
    }
    throw error
  }
}

/**
 * @param {number} geographySeed
 */
function normalizeGeographySeed(geographySeed) {
  const normalizedSeed = geographySeed | 0
  return normalizedSeed >= 0 ? normalizedSeed : normalizedSeed + 4294967296
}

/**
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @returns {PipelineStepOptions | undefined}
 */
function createHydrologyStepOptions(callbacks) {
  return {
    onSubstepStart: callbacks.onSubstepStart,
    onSubstepProgress: callbacks.onSubstepProgress,
    onSubstepComplete: callbacks.onSubstepComplete,
    onSubstepPrepare: callbacks.onSubstepPrepare,
    shouldCancel: () => Boolean(callbacks.shouldCancel?.()),
  }
}

/**
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @returns {LandmassPipelineExecutionHooks}
 */
export function createSyncLandmassPipelineHooks(callbacks) {
  return {
    shouldCancel: () => Boolean(callbacks.shouldCancel?.()),
    afterStep: () => {},
  }
}

/**
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @returns {LandmassPipelineExecutionHooks}
 */
export function createCooperativeLandmassPipelineHooks(callbacks) {
  return {
    shouldCancel: async () => Boolean(await callbacks.shouldCancel?.()),
    afterStep: async () => {
      await callbacks.yield?.()
    },
  }
}

/**
 * Shared step runner for sync (`runLandmassPipelineRun`) and worker (`runLandmassPipeline`).
 * @param {DerivedGeographyPipelineState} state
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @param {import('./types.js').WorldGenerationOptions} options
 * @param {LandmassPipelineExecutionHooks} hooks
 * @returns {DerivedGeographyPipelineState | Promise<DerivedGeographyPipelineState>}
 */
function runLandmassPipelineStepsShared(state, callbacks, options, hooks) {
  const stepCount = DERIVED_GEOGRAPHY_STEPS.length

  /**
   * @param {number} stepIndex
   * @param {DerivedGeographyPipelineState} currentState
   */
  const runFromStep = (stepIndex, currentState) => {
    if (stepIndex >= stepCount) {
      return currentState
    }

    return continuePipeline(
      hooks.shouldCancel(),
      (isCancelled) => {
        if (isCancelled) {
          throw new LandmassPipelineCancelledError(currentState)
        }

        const step = DERIVED_GEOGRAPHY_STEPS[stepIndex]
        callbacks.onStepStart?.({
          stepId: step.id,
          stepIndex,
          stepCount,
          label: step.label,
        })

        let nextState
        const stepOptions =
          step.id === 'hydrology' ? createHydrologyStepOptions(callbacks) : undefined
        nextState = runPipelineStep(currentState, step.id, stepOptions)

        return continuePipeline(hooks.shouldCancel(), (isCancelledAfterStep) => {
          if (isCancelledAfterStep) {
            throw new LandmassPipelineCancelledError(nextState)
          }

          const worldDocument = shouldAttachLandmassStepPreview(step.id, options)
            ? cloneWorldDocument(buildWorldDocumentFromPipelineState(nextState))
            : undefined

          callbacks.onStepComplete?.({
            stepId: step.id,
            stepIndex,
            stepCount,
            label: step.label,
            state: nextState,
            worldDocument,
          })

          return continuePipeline(hooks.afterStep?.() ?? undefined, () =>
            runFromStep(stepIndex + 1, nextState),
          )
        })
      },
    )
  }

  return runFromStep(0, state)
}

/**
 * @param {DerivedGeographyPipelineState | null} state
 * @param {unknown} error
 * @param {LandmassPipelineExecutionHooks} hooks
 * @returns {LandmassPipelineRunResult | Promise<LandmassPipelineRunResult>}
 */
function finalizeLandmassPipelineRun(state, error, hooks) {
  if (isLandmassPipelineCancelledError(error)) {
    return {
      status: 'cancelled',
      state: error.state,
      worldDocument: null,
      errorMessage: null,
    }
  }

  return continuePipeline(hooks.shouldCancel(), (isCancelled) => {
    if (isCancelled) {
      return { status: 'cancelled', state, worldDocument: null, errorMessage: null }
    }
    return {
      status: 'error',
      state,
      worldDocument: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  })
}

/**
 * Shared validation-retry runner for sync (`runLandmassPipelineRun`) and worker (`runLandmassPipeline`).
 * @param {import('./types.js').DerivedGeographyParams} params
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @param {LandmassPipelineExecutionHooks} hooks
 * @returns {LandmassPipelineRunResult | Promise<LandmassPipelineRunResult>}
 */
export function runLandmassPipelineWithRetryShared(params, callbacks, hooks) {
  const options = resolveWorldGenerationOptions(params.options)
  const maxValidationRetries = options.maxValidationRetries
  const baseSeed = params.geographySeed | 0

  /** @type {DerivedGeographyPipelineState | null} */
  let state = null

  /**
   * @param {number} attempt
   */
  const runAttempt = (attempt) => {
    if (attempt > maxValidationRetries) {
      const worldDocument = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
      const exhausted = Boolean(state?.generationReport?.shouldReject)
      return {
        status: exhausted ? 'exhausted' : 'success',
        state,
        worldDocument,
        errorMessage: null,
      }
    }

    return continuePipeline(
      hooks.shouldCancel(),
      (isCancelled) => {
        if (isCancelled) {
          return { status: 'cancelled', state, worldDocument: null, errorMessage: null }
        }

        const attemptParams = {
          ...params,
          geographySeed: normalizeGeographySeed(baseSeed + attempt),
          options,
        }
        state = createInitialPipelineState(attemptParams)
        return continuePipeline(
          runLandmassPipelineStepsShared(state, callbacks, options, hooks),
          (completedState) => {
            state = completedState
            if (!state.generationReport?.shouldReject) {
              const worldDocument = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
              return {
                status: 'success',
                state,
                worldDocument,
                errorMessage: null,
              }
            }
            return runAttempt(attempt + 1)
          },
          (error) => finalizeLandmassPipelineRun(state, error, hooks),
        )
      },
      (error) => finalizeLandmassPipelineRun(state, error, hooks),
    )
  }

  return runAttempt(0)
}
