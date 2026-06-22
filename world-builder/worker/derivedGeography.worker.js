import {
  buildWorldDocumentFromPipelineState,
  cloneWorldDocument,
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runPipelineStep,
} from '../core/derivedGeographyPipeline.js'
import { resolveWorldGenerationOptions } from '../core/worldGenerationOptions.js'

/** @type {boolean} */
let cancelled = false

/**
 * @param {number} geographySeed
 */
function normalizeGeographySeed(geographySeed) {
  const normalizedSeed = geographySeed | 0
  return normalizedSeed >= 0 ? normalizedSeed : normalizedSeed + 4294967296
}

/**
 * @param {MessageEvent<{ type: string, params?: import('../core/types.js').DerivedGeographyParams }>} event
 */
async function handleMessage(event) {
  const message = event.data
  if (message.type === 'cancel') {
    cancelled = true
    return
  }

  if (message.type !== 'start' || !message.params) {
    return
  }

  cancelled = false
  const stepCount = DERIVED_GEOGRAPHY_STEPS.length
  const options = resolveWorldGenerationOptions(message.params.options)
  const maxValidationRetries = options.maxValidationRetries
  const baseSeed = message.params.geographySeed | 0

  try {
    for (let attempt = 0; attempt <= maxValidationRetries; attempt += 1) {
      if (cancelled) {
        postMessage({ type: 'cancelled' })
        return
      }

      const attemptParams = {
        ...message.params,
        geographySeed: normalizeGeographySeed(baseSeed + attempt),
        options,
      }
      let state = createInitialPipelineState(attemptParams)

      for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
        if (cancelled) {
          postMessage({ type: 'cancelled' })
          return
        }

        const step = DERIVED_GEOGRAPHY_STEPS[stepIndex]
        postMessage({
          type: 'step-start',
          stepId: step.id,
          stepIndex,
          stepCount,
          label: step.label,
        })

        const stepOptions = step.id === 'hydrology'
          ? {
              shouldCancel: () => cancelled,
              onSubstepStart(payload) {
                if (cancelled) return
                postMessage({
                  type: 'substep-start',
                  stepId: step.id,
                  ...payload,
                })
              },
              onSubstepProgress(payload) {
                if (cancelled) return
                postMessage({
                  type: 'substep-progress',
                  stepId: step.id,
                  ...payload,
                })
              },
              onSubstepComplete(payload) {
                if (cancelled) return
                postMessage({
                  type: 'substep-complete',
                  stepId: step.id,
                  ...payload,
                })
              },
            }
          : undefined

        state = runPipelineStep(state, step.id, stepOptions)

        if (cancelled) {
          postMessage({ type: 'cancelled' })
          return
        }

        const worldDocument = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))

        postMessage({
          type: 'step-complete',
          stepId: step.id,
          stepIndex,
          stepCount,
          label: step.label,
          worldDocument,
        })

        await yieldToEventLoop()
      }

      if (!state.generationReport?.shouldReject) {
        break
      }
    }

    postMessage({ type: 'complete' })
  } catch (error) {
    if (cancelled) {
      postMessage({ type: 'cancelled' })
      return
    }
    postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function yieldToEventLoop() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

self.addEventListener('message', (event) => {
  handleMessage(event)
})
