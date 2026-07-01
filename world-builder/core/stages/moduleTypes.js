/**
 * Landmass pipeline stage module interface (#359).
 *
 * @typedef {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState
 * @typedef {import('../landmassPipelineTypes.js').LandmassPipelineStepId} LandmassPipelineStepId
 * @typedef {import('../landmassPipelineTypes.js').PipelineStepOptions} PipelineStepOptions
 */

/**
 * @typedef {Object} LandmassStageModule
 * @property {LandmassPipelineStepId} id
 * @property {string} label
 * @property {Record<string, (state: DerivedGeographyPipelineState) => unknown>} inputs
 * @property {readonly string[]} outputKeys
 * @property {(input: Record<string, unknown>, options?: PipelineStepOptions) => Record<string, unknown>} run
 * @property {(state: DerivedGeographyPipelineState) => boolean} [shouldSkip]
 * @property {(input: Record<string, unknown>) => Record<string, unknown>} [runSkipped]
 */

/**
 * @param {LandmassStageModule} module
 * @param {DerivedGeographyPipelineState} state
 * @returns {Record<string, unknown>}
 */
export function selectLandmassStageInput(module, state) {
  /** @type {Record<string, unknown>} */
  const input = {}
  for (const [key, selector] of Object.entries(module.inputs)) {
    input[key] = selector(state)
  }
  return input
}
