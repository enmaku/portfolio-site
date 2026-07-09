/** @typedef {'map' | 'session' | 'terrain' | 'logistics' | 'claims' | 'visited' | 'collapse'} ColonizationSessionRestoreStepId */

/** @type {ReadonlyArray<{ id: ColonizationSessionRestoreStepId, label: string }>} */
export const COLONIZATION_SESSION_RESTORE_STEPS = Object.freeze([
  { id: 'map', label: 'Map' },
  { id: 'session', label: 'Session' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'claims', label: 'Claims' },
  { id: 'visited', label: 'Visited' },
  { id: 'collapse', label: 'Collapse' },
])

/** @type {number} */
export const COLONIZATION_SESSION_RESTORE_STEP_COUNT = COLONIZATION_SESSION_RESTORE_STEPS.length

/** First derived-overlay rehydration step index within the full restore sequence. */
export const COLONIZATION_SESSION_RESTORE_DERIVED_STEP_START = 3

/** @typedef {'logistics' | 'claims' | 'visited' | 'collapse'} ColonizationRehydrationStepId */

/** @type {ReadonlyArray<{ id: ColonizationRehydrationStepId, label: string }>} */
export const COLONIZATION_REHYDRATION_STEPS = COLONIZATION_SESSION_RESTORE_STEPS.slice(
  COLONIZATION_SESSION_RESTORE_DERIVED_STEP_START,
)

/** @type {number} */
export const COLONIZATION_REHYDRATION_STEP_COUNT = COLONIZATION_REHYDRATION_STEPS.length

/** @type {number} */
export const COLONIZATION_SESSION_RESTORE_COLLAPSE_STEP_INDEX =
  COLONIZATION_SESSION_RESTORE_STEP_COUNT - 1

/** @typedef {'store' | 'cache' | 'merge' | 'apply'} ColonizationSessionRestoreSessionSubstepId */

/** @type {number} */
export const COLONIZATION_SESSION_RESTORE_SESSION_STEP_INDEX = 1

/** @type {ReadonlyArray<{ id: ColonizationSessionRestoreSessionSubstepId, label: string }>} */
export const COLONIZATION_SESSION_RESTORE_SESSION_SUBSTEPS = Object.freeze([
  { id: 'store', label: 'Store' },
  { id: 'cache', label: 'Cache' },
  { id: 'merge', label: 'Merge' },
  { id: 'apply', label: 'Apply' },
])
