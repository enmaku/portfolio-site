/**
 * Mutable conflict-engine tuning for sims and production defaults.
 * Domain: world-builder/CONTEXT.md — Conflict engine, economic contest, Conquest.
 */

/** @typedef {{
 *   warThreshold: number,
 *   rivalBonus: number,
 *   mightIntensityCap: number,
 *   mightIntensityDivisor: number,
 *   unalignedBonus: number,
 *   foodCap: number,
 *   foodSurplusForCap: number,
 *   wealthCap: number,
 *   wealthCpForCap: number,
 *   tollCap: number,
 *   tollCpForCap: number,
 *   metalsCap: number,
 *   metalsLbForCap: number,
 *   defenderHamlet: number,
 *   defenderVillage: number,
 *   defenderTown: number,
 *   defenderCity: number,
 *   defenderCapitalBump: number,
 *   defenderDefault: number,
 *   maxConquestsPerEpoch: number,
 *   preferWinnableStakes: boolean,
 *   requireAttackerEdge: boolean,
 *   attackerEdgeMargin: number,
 *   unalignedEaseBoost: number,
 *   borderEaseBoost: number,
 *   nonBorderEaseMult: number,
 *   haulProximityWeight: number,
 *   requireBorderNeighbor: boolean,
 *   allowDistantUnalignedConquest: boolean,
 *   distantUnalignedHaulFraction: number,
 *   borderNeighborHaulFraction: number,
 *   maxStakeHaulReachFraction: number,
 *   rebellionDistantHaulFraction: number,
 * }} ConflictTuning */

/**
 * @type {ConflictTuning}
 */
export const DEFAULT_CONFLICT_TUNING = Object.freeze({
  warThreshold: 10,
  rivalBonus: 28,
  mightIntensityCap: 50,
  mightIntensityDivisor: 2,
  unalignedBonus: 55,
  foodCap: 30,
  foodSurplusForCap: 25,
  wealthCap: 20,
  wealthCpForCap: 20_000,
  tollCap: 40,
  tollCpForCap: 2_500,
  metalsCap: 30,
  metalsLbForCap: 600,
  defenderHamlet: 1.0,
  defenderVillage: 1.02,
  defenderTown: 1.06,
  defenderCity: 1.12,
  defenderCapitalBump: 1.05,
  defenderDefault: 1.02,
  maxConquestsPerEpoch: 3,
  preferWinnableStakes: true,
  requireAttackerEdge: true,
  attackerEdgeMargin: 1.0,
  unalignedEaseBoost: 1.9,
  borderEaseBoost: 8,
  nonBorderEaseMult: 0.08,
  haulProximityWeight: 6,
  requireBorderNeighbor: true,
  allowDistantUnalignedConquest: true,
  distantUnalignedHaulFraction: 0.75,
  borderNeighborHaulFraction: 0.6,
  maxStakeHaulReachFraction: 1,
  rebellionDistantHaulFraction: 0.85,
})

/** @type {ConflictTuning} */
let active = { ...DEFAULT_CONFLICT_TUNING }

/** @returns {ConflictTuning} */
export function getConflictTuning() {
  return active
}

/**
 * @param {Partial<ConflictTuning>} patch
 * @returns {ConflictTuning}
 */
export function setConflictTuning(patch) {
  active = { ...active, ...patch }
  return active
}

/** @returns {ConflictTuning} */
export function resetConflictTuning() {
  active = { ...DEFAULT_CONFLICT_TUNING }
  return active
}
