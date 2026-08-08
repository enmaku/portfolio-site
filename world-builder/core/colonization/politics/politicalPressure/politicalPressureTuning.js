/**
 * Political-pressure tuning — Sweep B locked production defaults.
 * Domain: world-builder/CONTEXT.md — Political pressure; ADR 0022.
 */

/** @typedef {{
 *   enabled: boolean,
 *   combine: 'weightedSum',
 *   aggregation: 'sum',
 *   corridorMode: 'additive',
 *   resistance: 'marginShare',
 *   transform: 'raw',
 *   streakEpochs: number,
 *   clearAndRearmEpochs: number,
 *   refractoryEpochs: number,
 *   majority: number,
 *   marginRatio: number,
 *   weightBorder: number,
 *   weightCorridor: number,
 *   weightPopulation: number,
 *   weightWealth: number,
 *   weightMartial: number,
 *   weightTrade: number,
 * }} PoliticalPressureTuning */

/** @type {PoliticalPressureTuning} */
export const DEFAULT_POLITICAL_PRESSURE_TUNING = Object.freeze({
  enabled: true,
  combine: 'weightedSum',
  aggregation: 'sum',
  corridorMode: 'additive',
  resistance: 'marginShare',
  transform: 'raw',
  streakEpochs: 3,
  clearAndRearmEpochs: 2,
  refractoryEpochs: 2,
  majority: 0.5,
  marginRatio: 2.5,
  weightBorder: 0.5,
  weightCorridor: 0.5,
  weightPopulation: 1,
  weightWealth: 1,
  weightMartial: 1,
  weightTrade: 0.75,
})

/** @type {PoliticalPressureTuning} */
let active = { ...DEFAULT_POLITICAL_PRESSURE_TUNING }

/** @returns {PoliticalPressureTuning} */
export function getPoliticalPressureTuning() {
  return active
}

/**
 * @param {Partial<PoliticalPressureTuning>} patch
 * @returns {PoliticalPressureTuning}
 */
export function setPoliticalPressureTuning(patch) {
  active = { ...active, ...patch }
  return active
}

/** @returns {PoliticalPressureTuning} */
export function resetPoliticalPressureTuning() {
  active = { ...DEFAULT_POLITICAL_PRESSURE_TUNING }
  return active
}
