/**
 * @typedef {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState
 */

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {Float32Array | null}
 */
export function baselineDrainageFromState(state) {
  return state.baselineDoc?.fields.drainage ?? state.fields?.drainage ?? null
}
