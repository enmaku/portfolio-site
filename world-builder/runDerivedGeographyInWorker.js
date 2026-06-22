import { DERIVED_GEOGRAPHY_STEPS } from './core/derivedGeographyPipeline.js'
export { HYDROLOGY_SUBSTEPS } from './core/hydrology/hydrologySubsteps.js'

/**
 * @typedef {Object} HydrologySubstepEventPayload
 * @property {string} stepId
 * @property {string} substepId
 * @property {number} substepIndex
 * @property {number} substepCount
 * @property {string} label
 * @property {number=} progress
 * @property {boolean=} skipped
 */

/**
 * @typedef {Object} DerivedGeographyWorkerCallbacks
 * @property {(payload: { stepId: string, stepIndex: number, stepCount: number, label: string }) => void} [onStepStart]
 * @property {(payload: { stepId: string, stepIndex: number, stepCount: number, label: string, worldDocument: import('./core/types.js').WorldDocument }) => void} [onStepComplete]
 * @property {(payload: HydrologySubstepEventPayload) => void} [onSubstepStart]
 * @property {(payload: HydrologySubstepEventPayload) => void} [onSubstepProgress]
 * @property {(payload: HydrologySubstepEventPayload) => void} [onSubstepComplete]
 * @property {() => void} [onComplete]
 * @property {(message: string) => void} [onError]
 * @property {() => void} [onCancelled]
 */

/**
 * @param {import('./core/types.js').DerivedGeographyParams} params
 * @param {DerivedGeographyWorkerCallbacks} callbacks
 * @returns {{ cancel: () => void, worker: Worker | null }}
 */
export function runDerivedGeographyInWorker(params, callbacks) {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not available in this environment')
  }

  const worker = new Worker(
    new URL('./worker/derivedGeography.worker.js', import.meta.url),
    { type: 'module' },
  )

  worker.onmessage = (event) => {
    const message = event.data
    switch (message.type) {
      case 'step-start':
        callbacks.onStepStart?.(message)
        break
      case 'step-complete':
        callbacks.onStepComplete?.(message)
        break
      case 'substep-start':
        callbacks.onSubstepStart?.(message)
        break
      case 'substep-progress':
        callbacks.onSubstepProgress?.(message)
        break
      case 'substep-complete':
        callbacks.onSubstepComplete?.(message)
        break
      case 'complete':
        callbacks.onComplete?.()
        worker.terminate()
        break
      case 'cancelled':
        callbacks.onCancelled?.()
        worker.terminate()
        break
      case 'error':
        callbacks.onError?.(message.message)
        worker.terminate()
        break
      default:
        break
    }
  }

  worker.onerror = (event) => {
    callbacks.onError?.(event.message || 'Worker failed')
    worker.terminate()
  }

  worker.postMessage({ type: 'start', params })

  return {
    worker,
    cancel() {
      worker.postMessage({ type: 'cancel' })
    },
  }
}

export { DERIVED_GEOGRAPHY_STEPS }
