/** Nested landmass phase catalogs for progress chrome (baseline / erosion). */

/** @typedef {{ id: string, label: string }} NestedLandmassPhase */

/** @type {ReadonlyArray<NestedLandmassPhase>} */
export const BASELINE_NESTED_PHASES = Object.freeze([
  { id: 'baselineElevation', label: 'Elevation' },
  { id: 'baselineRainfall', label: 'Rainfall' },
  { id: 'baselineClimateRest', label: 'Climate and biomes' },
])

/** @type {ReadonlyArray<NestedLandmassPhase>} */
export const EROSION_NESTED_PHASES = Object.freeze([
  { id: 'erosionCarve', label: 'Carve terrain' },
  { id: 'erosionClimate', label: 'Climate refresh' },
])

/**
 * @param {string} parentStepId
 * @returns {ReadonlyArray<NestedLandmassPhase> | null}
 */
export function nestedPhasesForParentStep(parentStepId) {
  if (parentStepId === 'physicalTerrainBaseline') return BASELINE_NESTED_PHASES
  if (parentStepId === 'erosion') return EROSION_NESTED_PHASES
  return null
}
