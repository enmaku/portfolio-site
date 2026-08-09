import {
  toWorkerStepCompleteMessage,
  toWorkerSubstepPrepareMessage,
} from './derivedGeographyWorkerProtocol.js'

/**
 * @param {{
 *   postMessage: (message: unknown) => void,
 *   isCancelled: () => boolean,
 * }} options
 * @returns {import('../core/derivedGeographyPipeline.js').LandmassPipelineRunCallbacks}
 */
export function createDerivedGeographyWorkerPipelineCallbacks({ postMessage, isCancelled }) {
  return {
    shouldCancel: isCancelled,
    yield: () => new Promise((resolve) => {
      setTimeout(resolve, 0)
    }),
    onStepStart(payload) {
      if (isCancelled()) return
      postMessage({
        type: 'step-start',
        ...payload,
      })
    },
    onStepComplete(payload) {
      if (isCancelled()) return
      postMessage(toWorkerStepCompleteMessage(payload))
    },
    onSubstepStart(payload) {
      if (isCancelled()) return
      postMessage({
        type: 'substep-start',
        stepId: 'hydrology',
        ...payload,
      })
    },
    onSubstepProgress(payload) {
      if (isCancelled()) return
      postMessage({
        type: 'substep-progress',
        stepId: 'hydrology',
        ...payload,
      })
    },
    onSubstepComplete(payload) {
      if (isCancelled()) return
      postMessage({
        type: 'substep-complete',
        stepId: 'hydrology',
        ...payload,
      })
    },
    onSubstepPrepare(payload) {
      if (isCancelled()) return
      postMessage(toWorkerSubstepPrepareMessage(payload))
    },
  }
}
