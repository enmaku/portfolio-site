/**
 * Mutable soft-power tuning for sims and production defaults.
 * Domain: world-builder/CONTEXT.md — Soft power; ADR 0019 anti-churn.
 */

/** @typedef {{
 *   majority: number,
 *   marginRatio: number,
 *   absFloorCp: number,
 *   paintStreakEpochs: number,
 *   joinHoldEpochs: number,
 *   clearAndRearmEpochs: number,
 *   refractoryEpochs: number,
 *   requireMultiMemberDominant: boolean,
 * }} SoftPowerTuning */

/**
 * Defaults: majority + 2× margin stay glossary-hard. Soft-power volume only
 * counts multi-member banners. Paint arms in 2 sustained epochs; join holds 2
 * more (commercial affiliation still slower than paint-only).
 *
 * @type {SoftPowerTuning}
 */
export const DEFAULT_SOFT_POWER_TUNING = Object.freeze({
  majority: 0.5,
  marginRatio: 2,
  absFloorCp: 0,
  paintStreakEpochs: 2,
  joinHoldEpochs: 2,
  clearAndRearmEpochs: 2,
  refractoryEpochs: 2,
  requireMultiMemberDominant: true,
})

/** @type {SoftPowerTuning} */
let active = { ...DEFAULT_SOFT_POWER_TUNING }

/** @returns {SoftPowerTuning} */
export function getSoftPowerTuning() {
  return active
}

/**
 * @param {Partial<SoftPowerTuning>} patch
 * @returns {SoftPowerTuning}
 */
export function setSoftPowerTuning(patch) {
  active = { ...active, ...patch }
  return active
}

/** @returns {SoftPowerTuning} */
export function resetSoftPowerTuning() {
  active = { ...DEFAULT_SOFT_POWER_TUNING }
  return active
}
