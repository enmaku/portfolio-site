import { isMapPreviewWorldDocumentDelivery } from './worker/derivedGeographyWorkerProtocol.js'

/**
 * Generation preview and progress policy for derived-geography runs.
 * Map delivery follows {@link import('./worker/derivedGeographyWorkerProtocol.js')}:
 * previews apply from validation `step-complete` payloads and exhausted terminals only.
 */

/** @typedef {Parameters<typeof isMapPreviewWorldDocumentDelivery>[0]['delivery']} WorldDocumentDeliveryKind */

/**
 * @param {number} stepIndex
 * @param {number} stepCount
 * @returns {number}
 */
export function generationProgressValue(stepIndex, stepCount) {
  if (stepCount <= 0) return 0
  return Math.round(((stepIndex + 1) / stepCount) * 100)
}

/**
 * Whether a worker world-document delivery should refresh the map preview.
 *
 * @param {{ delivery: WorldDocumentDeliveryKind, stepId?: string, worldDocument?: import('./core/types.js').WorldDocument | null | undefined }} payload
 * @returns {boolean}
 */
export function shouldApplyStepPreviewToMap(payload) {
  return isMapPreviewWorldDocumentDelivery(payload)
}
