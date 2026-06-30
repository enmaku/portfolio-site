/** @typedef {import('../core/landmassPipelineTypes.js').DerivedGeographyStepId} DerivedGeographyStepId */

/**
 * @typedef {Object} DerivedGeographyWorkerStepStartMessage
 * @property {'step-start'} type
 * @property {DerivedGeographyStepId} stepId
 * @property {number} stepIndex
 * @property {number} stepCount
 * @property {string} label
 */

/**
 * Slim worker step-complete payload. Never includes {@link import('../core/landmassPipelineTypes.js').DerivedGeographyPipelineState}.
 *
 * @typedef {Object} DerivedGeographyWorkerStepCompleteMessage
 * @property {'step-complete'} type
 * @property {DerivedGeographyStepId} stepId
 * @property {number} stepIndex
 * @property {number} stepCount
 * @property {string} label
 * @property {import('../core/types.js').WorldDocument} [worldDocument]
 */

/**
 * @typedef {Object} DerivedGeographyWorkerSubstepPrepareMessage
 * @property {'substep-prepare'} type
 * @property {'hydrology'} stepId
 * @property {string} substepId
 * @property {number} substepIndex
 * @property {number} substepCount
 * @property {string} label
 * @property {Record<string, unknown>} input
 */

/**
 * @typedef {Object} DerivedGeographyWorkerCompleteMessage
 * @property {'complete'} type
 */

/**
 * @typedef {Object} DerivedGeographyWorkerExhaustedMessage
 * @property {'exhausted'} type
 * @property {import('../core/types.js').WorldDocument} worldDocument
 */

/**
 * @typedef {Object} DerivedGeographyWorkerCancelledMessage
 * @property {'cancelled'} type
 */

/**
 * @typedef {Object} DerivedGeographyWorkerErrorMessage
 * @property {'error'} type
 * @property {string} message
 */

/**
 * ## Worker world-document delivery contract
 *
 * - **Progress-only steps:** `step-start` and `step-complete` carry step metadata only.
 *   `step-complete` may include an optional cloned `worldDocument` when intermediate previews
 *   are enabled or on the validation stage; it never includes pipeline state bags.
 * - **Successful run:** the final accepted `worldDocument` is delivered on the validation
 *   `step-complete` message. The trailing `complete` message is metadata-only.
 * - **Exhausted validation retries:** the rejected candidate `worldDocument` is delivered on
 *   the `exhausted` message (not on `complete`).
 * - **Cancelled / error:** `cancelled` and `error` messages carry no world document.
 *
 * @typedef {DerivedGeographyWorkerStepStartMessage | DerivedGeographyWorkerStepCompleteMessage | DerivedGeographyWorkerSubstepPrepareMessage | DerivedGeographyWorkerCompleteMessage | DerivedGeographyWorkerExhaustedMessage | DerivedGeographyWorkerCancelledMessage | DerivedGeographyWorkerErrorMessage} DerivedGeographyWorkerOutboundMessage
 */

/**
 * @param {{ stepId: DerivedGeographyStepId, stepIndex: number, stepCount: number, label: string, state?: unknown, worldDocument?: import('../core/types.js').WorldDocument }} payload
 * @returns {DerivedGeographyWorkerStepCompleteMessage}
 */
export function toWorkerStepCompleteMessage(payload) {
  const { stepId, stepIndex, stepCount, label, worldDocument } = payload
  /** @type {DerivedGeographyWorkerStepCompleteMessage} */
  const message = {
    type: 'step-complete',
    stepId,
    stepIndex,
    stepCount,
    label,
  }
  if (worldDocument !== undefined) {
    message.worldDocument = worldDocument
  }
  return message
}

/**
 * @param {{ substepId: string, substepIndex: number, substepCount: number, label: string, input: Record<string, unknown> }} payload
 * @returns {DerivedGeographyWorkerSubstepPrepareMessage}
 */
export function toWorkerSubstepPrepareMessage(payload) {
  return {
    type: 'substep-prepare',
    stepId: 'hydrology',
    substepId: payload.substepId,
    substepIndex: payload.substepIndex,
    substepCount: payload.substepCount,
    label: payload.label,
    input: payload.input,
  }
}

/** @returns {DerivedGeographyWorkerCompleteMessage} */
export function toWorkerCompleteMessage() {
  return { type: 'complete' }
}

/**
 * Maps a landmass pipeline run result to the worker terminal message defined by the
 * world-document delivery contract. Success posts metadata-only `complete`; exhausted
 * posts the rejected candidate on `exhausted`.
 *
 * @param {Pick<import('../core/derivedGeographyPipeline.js').LandmassPipelineRunResult, 'status' | 'worldDocument' | 'errorMessage'>} result
 * @returns {DerivedGeographyWorkerCompleteMessage | DerivedGeographyWorkerExhaustedMessage | DerivedGeographyWorkerCancelledMessage | DerivedGeographyWorkerErrorMessage}
 */
export function toWorkerTerminalMessage(result) {
  if (result.status === 'cancelled') {
    return toWorkerCancelledMessage()
  }
  if (result.status === 'error') {
    return toWorkerErrorMessage(result.errorMessage ?? 'Pipeline failed')
  }
  if (result.status === 'exhausted' && result.worldDocument) {
    return toWorkerExhaustedMessage(result.worldDocument)
  }
  return toWorkerCompleteMessage()
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {DerivedGeographyWorkerExhaustedMessage}
 */
export function toWorkerExhaustedMessage(worldDocument) {
  return { type: 'exhausted', worldDocument }
}

/** @returns {DerivedGeographyWorkerCancelledMessage} */
export function toWorkerCancelledMessage() {
  return { type: 'cancelled' }
}

/**
 * @param {string} message
 * @returns {DerivedGeographyWorkerErrorMessage}
 */
export function toWorkerErrorMessage(message) {
  return { type: 'error', message }
}

/**
 * @param {unknown} message
 * @returns {boolean}
 */
export function isSlimWorkerStepCompleteMessage(message) {
  if (!message || typeof message !== 'object') {
    return false
  }
  const record = /** @type {Record<string, unknown>} */ (message)
  if (record.type !== 'step-complete') {
    return false
  }
  return !('state' in record)
}
