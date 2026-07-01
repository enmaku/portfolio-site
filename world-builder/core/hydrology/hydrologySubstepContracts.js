/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepId} HydrologySubstepId */

/**
 * Substep contracts are a read-only descriptor derived from the substep modules in
 * {@link import('./substeps/index.js')}, which own the authoritative narrow
 * input/output contracts. River mask stages use
 * {@link import('./riverMaskLifecycle.js').riverMaskContractKey}:
 * sketch → incised → settled → presentation (refine or skipRefine) → painted.
 */

import { HYDROLOGY_SUBSTEP_MODULES } from './substeps/index.js'

/**
 * @typedef {Object} HydrologySubstepContract
 * @property {HydrologySubstepId} id
 * @property {string} label
 * @property {readonly string[]} inputKeys
 * @property {readonly string[]} outputKeys
 */

/** @type {readonly HydrologySubstepId[]} */
export const HYDROLOGY_SUBSTEP_IDS = HYDROLOGY_SUBSTEP_MODULES.map(
  (module) => /** @type {HydrologySubstepId} */ (module.id),
)

/** @type {Record<HydrologySubstepId, HydrologySubstepContract>} */
export const HYDROLOGY_SUBSTEP_CONTRACTS = Object.fromEntries(
  HYDROLOGY_SUBSTEP_MODULES.map((module) => [
    module.id,
    {
      id: /** @type {HydrologySubstepId} */ (module.id),
      label: module.label,
      inputKeys: Object.keys(module.inputs),
      outputKeys: [...module.outputKeys],
    },
  ]),
)
