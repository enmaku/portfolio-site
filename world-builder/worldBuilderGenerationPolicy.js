/**
 * Generation preview and progress policy for derived-geography runs.
 * Map delivery follows {@link import('./worker/derivedGeographyWorkerProtocol.js')}:
 * previews apply from validation `step-complete` payloads and exhausted terminals only.
 */

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
 * @param {import('./core/types.js').WorldDocument | null | undefined} worldDocument
 * @returns {boolean}
 */
export function shouldApplyStepPreviewToMap(worldDocument) {
  return worldDocument != null
}
