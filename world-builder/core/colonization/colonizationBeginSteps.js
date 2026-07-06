/** @typedef {'claims' | 'survival' | 'ruin' | 'dynasty' | 'logistics' | 'visited' | 'collapse' | 'commit'} ColonizationBeginStepId */

/** @type {ReadonlyArray<{ id: ColonizationBeginStepId, label: string }>} */
export const COLONIZATION_BEGIN_STEPS = Object.freeze([
  { id: 'claims', label: 'Claims' },
  { id: 'survival', label: 'Survival' },
  { id: 'ruin', label: 'Ruin' },
  { id: 'dynasty', label: 'Dynasty' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'visited', label: 'Visited' },
  { id: 'collapse', label: 'Collapse' },
  { id: 'commit', label: 'Commit' },
])

/** @type {number} */
export const COLONIZATION_BEGIN_STEP_COUNT = COLONIZATION_BEGIN_STEPS.length
