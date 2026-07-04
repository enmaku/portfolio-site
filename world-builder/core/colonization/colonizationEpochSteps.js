/** @typedef {'network' | 'claims' | 'survival' | 'ruin' | 'collapse'} ColonizationEpochPhaseId */
/** @typedef {'dispatch' | 'advance' | 'frontier'} ColonizationNetworkSubstepId */

/** @type {ReadonlyArray<{ id: ColonizationEpochPhaseId, label: string }>} */
export const COLONIZATION_EPOCH_PHASES = Object.freeze([
  { id: 'network', label: 'Network' },
  { id: 'claims', label: 'Claims' },
  { id: 'survival', label: 'Survival' },
  { id: 'ruin', label: 'Ruin' },
  { id: 'collapse', label: 'Collapse' },
])

/** @type {ReadonlyArray<{ id: ColonizationNetworkSubstepId, label: string }>} */
export const COLONIZATION_NETWORK_SUBSTEPS = Object.freeze([
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'advance', label: 'Advance' },
  { id: 'frontier', label: 'Frontier' },
])

/** @type {number} */
export const COLONIZATION_EPOCH_PHASE_COUNT = COLONIZATION_EPOCH_PHASES.length
