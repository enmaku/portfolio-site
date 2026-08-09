import { runLandmassPipeline } from '../core/derivedGeographyPipeline.js'
import { createDerivedGeographyWorkerPipelineCallbacks } from './createDerivedGeographyWorkerPipelineCallbacks.js'
import { toWorkerTerminalMessage } from './derivedGeographyWorkerProtocol.js'

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
    ...createDerivedGeographyWorkerPipelineCallbacks({
      postMessage,
      isCancelled: () => cancelled,
    }),
  })

  postMessage(toWorkerTerminalMessage(result))
}

self.addEventListener('message', (event) => {
  handleMessage(event)
})
