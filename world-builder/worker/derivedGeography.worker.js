import { runLandmassPipeline } from '../core/derivedGeographyPipeline.js'

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

  const result = await runLandmassPipeline(message.params, {
    shouldCancel: () => cancelled,
    yield: () => new Promise((resolve) => {
      setTimeout(resolve, 0)
    }),
    onStepStart(payload) {
      if (cancelled) return
      postMessage({
        type: 'step-start',
        ...payload,
      })
    },
    onStepComplete(payload) {
      if (cancelled) return
      postMessage({
        type: 'step-complete',
        ...payload,
      })
    },
    onSubstepStart(payload) {
      if (cancelled) return
      postMessage({
        type: 'substep-start',
        stepId: 'hydrology',
        ...payload,
      })
    },
    onSubstepProgress(payload) {
      if (cancelled) return
      postMessage({
        type: 'substep-progress',
        stepId: 'hydrology',
        ...payload,
      })
    },
    onSubstepComplete(payload) {
      if (cancelled) return
      postMessage({
        type: 'substep-complete',
        stepId: 'hydrology',
        ...payload,
      })
    },
  })

  if (result.status === 'cancelled') {
    postMessage({ type: 'cancelled' })
    return
  }

  if (result.status === 'error') {
    postMessage({
      type: 'error',
      message: result.errorMessage ?? 'Pipeline failed',
    })
    return
  }

  postMessage({ type: 'complete' })
}

self.addEventListener('message', (event) => {
  handleMessage(event)
})
