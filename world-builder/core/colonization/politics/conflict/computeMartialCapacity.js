/**
 * Pure martial capacity and stake defender advantage.
 * Domain: world-builder/CONTEXT.md — Martial capacity, Defender advantage.
 */

import {
  ARMAMENT_MODIFIER_CAP,
  BASE_METALS_LB_PER_PERSON_FOR_FULL_ARMAMENT,
  FEED_MODIFIER_CAP,
  FOOD_SURPLUS_LB_PER_PERSON_FOR_FULL_FEED,
  MARTIAL_PER_PERSON,
  MERCENARY_TOP_UP_CAP_FRACTION,
  WEALTH_CP_FOR_FULL_MERC_TOP_UP,
} from './conflictConstants.js'
import { getConflictTuning } from './conflictTuning.js'

/**
 * @param {{
 *   population: number,
 *   foodSurplusLb: number,
 *   baseMetalsAccess: number,
 *   spendableWealthCp: number,
 *   warExhaustionPenalty?: number,
 * }} params
 * @returns {number}
 */
export function computeMartialCapacity(params) {
  const population = Math.max(0, Number(params.population) || 0)
  if (population <= 0) return 0

  const base = population * MARTIAL_PER_PERSON
  const foodSurplusLb = Math.max(0, Number(params.foodSurplusLb) || 0)
  const baseMetalsAccess = Math.max(0, Number(params.baseMetalsAccess) || 0)
  const spendableWealthCp = Math.max(0, Number(params.spendableWealthCp) || 0)

  const feedRatio = foodSurplusLb / (population * FOOD_SURPLUS_LB_PER_PERSON_FOR_FULL_FEED)
  const feedMod = Math.min(FEED_MODIFIER_CAP, Math.max(0, feedRatio) * FEED_MODIFIER_CAP)

  const metalsRatio = baseMetalsAccess / (population * BASE_METALS_LB_PER_PERSON_FOR_FULL_ARMAMENT)
  const armamentMod = Math.min(
    ARMAMENT_MODIFIER_CAP,
    Math.max(0, metalsRatio) * ARMAMENT_MODIFIER_CAP,
  )

  const economyFactor = 1 + feedMod + armamentMod
  const maxEconomy = 1 + FEED_MODIFIER_CAP + ARMAMENT_MODIFIER_CAP
  const weakness = Math.max(0, (maxEconomy - economyFactor) / (maxEconomy - 1))

  const wealthFraction = Math.min(1, spendableWealthCp / WEALTH_CP_FOR_FULL_MERC_TOP_UP)
  const mercTopUp = base * MERCENARY_TOP_UP_CAP_FRACTION * wealthFraction * (0.5 + 0.5 * weakness)

  const penalty = Math.min(1, Math.max(0, Number(params.warExhaustionPenalty) || 0))
  return Math.max(0, (base * economyFactor + mercTopUp) * (1 - penalty))
}

/**
 * @param {{
 *   tier?: string | null,
 *   isFactionCapital?: boolean,
 * }} params
 * @returns {number}
 */
export function defenderAdvantageMultiplier(params) {
  const tuning = getConflictTuning()
  const byTier = {
    hamlet: tuning.defenderHamlet,
    village: tuning.defenderVillage,
    town: tuning.defenderTown,
    city: tuning.defenderCity,
  }
  const tier = params.tier
  const tierMult =
    tier && Object.prototype.hasOwnProperty.call(byTier, tier)
      ? byTier[/** @type {keyof typeof byTier} */ (tier)]
      : tuning.defenderDefault
  if (params.isFactionCapital) {
    return tierMult * tuning.defenderCapitalBump
  }
  return tierMult
}
