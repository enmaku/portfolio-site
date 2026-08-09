import { DERIVED_GEOGRAPHY_STEPS } from './core/derivedGeographyPipeline.js'
export { HYDROLOGY_SUBSTEPS } from './core/hydrology/hydrologySubsteps.js'

/**
 * @typedef {import('./worker/derivedGeographyWorkerProtocol.js').DerivedGeographyWorkerSubstepPrepareMessage} DerivedGeographyWorkerSubstepPrepareMessage
 * @typedef {import('./worker/derivedGeographyWorkerProtocol.js').DerivedGeographyWorkerStepCompleteMessage} DerivedGeographyWorkerStepCompleteMessage
 */

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
 * @property {(payload: DerivedGeographyWorkerStepCompleteMessage) => void} [onStepComplete]
 * @property {(payload: HydrologySubstepEventPayload) => void} [onSubstepStart]
 * @property {(payload: HydrologySubstepEventPayload) => void} [onSubstepProgress]
 * @property {(payload: HydrologySubstepEventPayload) => void} [onSubstepComplete]
 * @property {(payload: Omit<DerivedGeographyWorkerSubstepPrepareMessage, 'type'>) => void} [onSubstepPrepare]
 * @property {() => void} [onComplete]
 * @property {(worldDocument: import('./core/types.js').WorldDocument) => void} [onExhausted]
 * @property {(message: string) => void} [onError]
 * @property {() => void} [onCancelled]
 */

/**
 * Bridges the derived-geography worker protocol to main-thread callbacks.
 *
 * World-document delivery matches {@link import('./worker/derivedGeographyWorkerProtocol.js')}:
 * success previews/final doc on validation `step-complete`, exhausted doc on `exhausted`,
 * and metadata-only `complete` / `cancelled` / `error` terminals.
 *
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

  let settled = false

  /** @returns {boolean} */
  function settleWorker() {
    if (settled) {
      return false
    }
    settled = true
    worker.onmessage = null
    worker.onerror = null
    return true
  }

  function handleCancelled() {
    if (!settleWorker()) {
      return
    }
    callbacks.onCancelled?.()
    worker.terminate()
  }

  worker.onmessage = (event) => {
    if (settled) {
      return
    }
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
      case 'substep-prepare':
        callbacks.onSubstepPrepare?.(message)
        break
      case 'complete':
        if (!settleWorker()) {
          return
        }
        callbacks.onComplete?.()
        worker.terminate()
        break
      case 'exhausted':
        if (!settleWorker()) {
          return
        }
        if (message.worldDocument) {
          callbacks.onExhausted?.(message.worldDocument)
        }
        worker.terminate()
        break
      case 'cancelled':
        handleCancelled()
        break
      case 'error':
        if (!settleWorker()) {
          return
        }
        callbacks.onError?.(message.message)
        worker.terminate()
        break
      default:
        break
    }
  }

  worker.onerror = (event) => {
    if (!settleWorker()) {
      return
    }
    callbacks.onError?.(event.message || 'Worker failed')
    worker.terminate()
  }

  worker.postMessage({ type: 'start', params })

  return {
    worker,
    cancel() {
      worker.postMessage({ type: 'cancel' })
      handleCancelled()
    },
  }
}

export { DERIVED_GEOGRAPHY_STEPS }
