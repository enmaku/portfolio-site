import {
  buildWorldDocumentFromPipelineState,
  cloneWorldDocument,
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runPipelineStep,
} from '../core/derivedGeographyPipeline.js'

/** @type {boolean} */
let cancelled = false

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

  try {
    let state = createInitialPipelineState(message.params)

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

      state = runPipelineStep(state, step.id)
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

    postMessage({ type: 'complete' })
  } catch (error) {
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
