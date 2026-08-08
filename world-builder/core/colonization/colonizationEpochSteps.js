/** @typedef {'network' | 'claims' | 'trade' | 'tax' | 'survival' | 'ruin' | 'collapse' | 'politics'} ColonizationEpochPhaseId */
/** @typedef {'dispatch' | 'advance' | 'frontier'} ColonizationNetworkSubstepId */
/** @typedef {'prepare' | 'urban' | 'hinterland'} ColonizationCollapseSubstepId */
/** @typedef {'production' | 'localPrices' | 'survival' | 'comfort' | 'prosperity' | 'offMap'} ColonizationTradeSubstepId */
/** @typedef {'latch' | 'membership' | 'pressure' | 'conflict' | 'absorption' | 'palette'} ColonizationPoliticsSubstepId */

/** @type {ReadonlyArray<{ id: ColonizationEpochPhaseId, label: string }>} */
export const COLONIZATION_EPOCH_PHASES = Object.freeze([
  { id: 'network', label: 'Network' },
  { id: 'claims', label: 'Claims' },
  { id: 'trade', label: 'Trade' },
  { id: 'tax', label: 'Tax' },
  { id: 'survival', label: 'Survival' },
  { id: 'ruin', label: 'Ruin' },
  { id: 'collapse', label: 'Collapse' },
  { id: 'politics', label: 'Politics' },
])

/** @type {ReadonlyArray<{ id: ColonizationNetworkSubstepId, label: string }>} */
export const COLONIZATION_NETWORK_SUBSTEPS = Object.freeze([
  { id: 'frontier', label: 'Frontier' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'advance', label: 'Advance' },
])

/** @type {ReadonlyArray<{ id: ColonizationCollapseSubstepId, label: string }>} */
export const COLONIZATION_COLLAPSE_SUBSTEPS = Object.freeze([
  { id: 'prepare', label: 'Prepare' },
  { id: 'urban', label: 'Urban' },
  { id: 'hinterland', label: 'Hinterland' },
])

/** @type {ReadonlyArray<{ id: ColonizationTradeSubstepId, label: string }>} */
export const COLONIZATION_TRADE_SUBSTEPS = Object.freeze([
  { id: 'production', label: 'Production' },
  { id: 'localPrices', label: 'Local prices' },
  { id: 'survival', label: 'Survival' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'prosperity', label: 'Prosperity' },
  { id: 'offMap', label: 'Off-map' },
])

/** @type {ReadonlyArray<{ id: ColonizationPoliticsSubstepId, label: string }>} */
export const COLONIZATION_POLITICS_SUBSTEPS = Object.freeze([
  { id: 'latch', label: 'Latch' },
  { id: 'membership', label: 'Membership' },
  { id: 'pressure', label: 'Pressure' },
  { id: 'conflict', label: 'Conflict' },
  { id: 'absorption', label: 'Absorption' },
  { id: 'palette', label: 'Palette' },
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
