/**
 * Absolute headcount bands for settlement tier keys (not display labels).
 * Population 0 is not a living tier seat.
 *
 * @type {ReadonlyArray<{ tier: string, min: number }>}
 */
export const SETTLEMENT_TIER_THRESHOLDS = Object.freeze([
  { tier: 'outpost', min: 1 },
  { tier: 'hamlet', min: 50 },
  { tier: 'village', min: 200 },
  { tier: 'town', min: 1000 },
  { tier: 'city', min: 5000 },
])

/**
 * @param {number} population
 * @returns {string | null}
 */
export function settlementTierFromPopulation(population) {
  if (!Number.isFinite(population) || population < 1) {
    return null
  }

  let tier = SETTLEMENT_TIER_THRESHOLDS[0].tier
  for (const band of SETTLEMENT_TIER_THRESHOLDS) {
    if (population >= band.min) {
      tier = band.tier
    }
  }
  return tier
}
