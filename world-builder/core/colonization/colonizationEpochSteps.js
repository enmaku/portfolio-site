/** @typedef {'network' | 'claims' | 'trade' | 'survival' | 'ruin' | 'collapse'} ColonizationEpochPhaseId */
/** @typedef {'dispatch' | 'advance' | 'frontier'} ColonizationNetworkSubstepId */
/** @typedef {'urban' | 'hinterland'} ColonizationCollapseSubstepId */

/** @type {ReadonlyArray<{ id: ColonizationEpochPhaseId, label: string }>} */
export const COLONIZATION_EPOCH_PHASES = Object.freeze([
  { id: 'network', label: 'Network' },
  { id: 'claims', label: 'Claims' },
  { id: 'trade', label: 'Trade' },
  { id: 'survival', label: 'Survival' },
  { id: 'ruin', label: 'Ruin' },
  { id: 'collapse', label: 'Collapse' },
])

/** @type {ReadonlyArray<{ id: ColonizationNetworkSubstepId, label: string }>} */
export const COLONIZATION_NETWORK_SUBSTEPS = Object.freeze([
  { id: 'frontier', label: 'Frontier' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'advance', label: 'Advance' },
])

/** @type {ReadonlyArray<{ id: ColonizationCollapseSubstepId, label: string }>} */
export const COLONIZATION_COLLAPSE_SUBSTEPS = Object.freeze([
  { id: 'urban', label: 'Urban' },
  { id: 'hinterland', label: 'Hinterland' },
])

/** @type {number} */
export const COLONIZATION_EPOCH_PHASE_COUNT = COLONIZATION_EPOCH_PHASES.length

/** @typedef {'map'} ColonizationEpochFinalizeStepId */

/** @type {ReadonlyArray<{ id: ColonizationEpochFinalizeStepId, label: string }>} */
export const COLONIZATION_EPOCH_FINALIZE_STEPS = Object.freeze([{ id: 'map', label: 'Map' }])

/** @type {number} */
export const COLONIZATION_EPOCH_FINALIZE_STEP_COUNT = COLONIZATION_EPOCH_FINALIZE_STEPS.length

/** @typedef {'session' | 'rehydrate' | 'merge' | 'population' | 'visited' | 'routes' | 'overlays'} ColonizationEpochMapSubstepId */

/** @type {ReadonlyArray<{ id: ColonizationEpochMapSubstepId, label: string }>} */
export const COLONIZATION_EPOCH_MAP_SUBSTEPS = Object.freeze([
  { id: 'session', label: 'Session' },
  { id: 'rehydrate', label: 'Rehydrate' },
  { id: 'merge', label: 'Merge' },
  { id: 'population', label: 'Population' },
  { id: 'visited', label: 'Visited' },
  { id: 'routes', label: 'Routes' },
  { id: 'overlays', label: 'Overlays' },
])
