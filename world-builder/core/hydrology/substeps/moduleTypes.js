/**
 * Hydrology substep module interface (#355).
 *
 * @typedef {import('../hydrologySubsteps.js').HydrologySubstepId} HydrologySubstepId
 * @typedef {import('../flowField.js').FlowFieldSession} FlowFieldSession
 * @typedef {import('../riverMaskLifecycle.js').RiverMaskPipeline} RiverMaskPipeline
 * @typedef {import('../hydrologyWorldTypes.js').HydrologyWorldBase} HydrologyWorldBase
 */

/**
 * @typedef {Object} HydrologySubstepShared
 * @property {FlowFieldSession} flowFieldSession
 * @property {RiverMaskPipeline} riverMaskPipeline
 * @property {(progress: number) => void} onProgress
 */

/**
 * @template {HydrologyWorldBase} TWorld
 * @template [TOutput=Object]
 * @typedef {Object} HydrologySubstepModule
 * @property {HydrologySubstepId} id
 * @property {string} label
 * @property {Object.<string, function(TWorld): *>} inputs
 * @property {readonly string[]} outputKeys
 * @property {function(Object, HydrologySubstepShared): TOutput} run
 * @property {function(TWorld): boolean} [shouldSkip]
 * @property {function(Object, HydrologySubstepShared): TOutput} [runSkipped]
 * @property {string} [skipTransition]
 */

/**
 * @template {HydrologyWorldBase} TWorld
 * @param {HydrologySubstepModule<TWorld>} module
 * @param {TWorld} world
 * @returns {Object}
 */
export function selectHydrologySubstepInput(module, world) {
  /** @type {Object} */
  const input = {}
  for (const [key, select] of Object.entries(module.inputs)) {
    input[key] = select(world)
  }
  return input
}
