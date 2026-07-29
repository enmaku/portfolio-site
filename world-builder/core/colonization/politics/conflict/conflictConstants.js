/**
 * Tunables for martial capacity, projection, war exhaustion, and major-war cadence.
 * Domain: world-builder/CONTEXT.md — Conflict engine, Martial capacity, Projected might.
 */

/** Base martial strength per living person before modifiers. */
export const MARTIAL_PER_PERSON = 1

/** Food-surplus lb per person that yields a +1.0 feed modifier. */
export const FOOD_SURPLUS_LB_PER_PERSON_FOR_FULL_FEED = 365

/** Cap on feed modifier contribution (fraction of base). */
export const FEED_MODIFIER_CAP = 0.5

/** Base-metals lb per person that yields a +1.0 armament modifier. */
export const BASE_METALS_LB_PER_PERSON_FOR_FULL_ARMAMENT = 10

/** Cap on armament modifier contribution (fraction of base). */
export const ARMAMENT_MODIFIER_CAP = 0.5

/**
 * Max mercenary top-up as a fraction of population-scaled base.
 * Wealth may offset weak feed/armament and add at most this much.
 */
export const MERCENARY_TOP_UP_CAP_FRACTION = 0.25

/** Spendable wealth (cp) that funds a full mercenary top-up of the cap. */
export const WEALTH_CP_FOR_FULL_MERC_TOP_UP = 100_000

/** Defender advantage multipliers by settlement tier. */
export const DEFENDER_ADVANTAGE_BY_TIER = Object.freeze({
  hamlet: 1.05,
  village: 1.1,
  town: 1.2,
  city: 1.35,
})

/** Extra defender multiplier when the stake is a faction capital. */
export const DEFENDER_CAPITAL_BUMP = 1.15

/** Default tier multiplier when tier is unknown. */
export const DEFENDER_ADVANTAGE_DEFAULT = 1.1

/** Soft-cutoff: projection fades to zero between this fraction and 1.0 of strategic reach. */
export const PROJECTION_SOFT_CUTOFF_START_FRACTION = 0.75

/** Path cost weight: haulDistanceFraction × directional friction accumulates toward cutoff. */
export const PROJECTION_FRICTION_COST_SCALE = 1

/** Fraction of contributing population lost across both sides for a fought resolution. */
export const WAR_DEATH_FRACTION_OF_CONTRIBUTION = 0.05

/** Extra death fraction applied to the contested settlement. */
export const WAR_STAKE_DEATH_PREMIUM_FRACTION = 0.03

/** Temporary martial capacity penalty applied after a fought war. */
export const WAR_EXHAUSTION_PENALTY = 0.35

/** Epochs until a war-exhaustion martial penalty decays to zero without re-fighting. */
export const WAR_EXHAUSTION_DECAY_EPOCHS = 3

/** Minimum post-war epochs before a belligerent trade block may clear as peace. */
export const BELLIGERENT_PEACE_MIN_POST_WAR_EPOCHS = 1

/** Modest wealth burn (fraction of positive spendable wealth) on fought war contributors. */
export const WAR_WEALTH_BURN_FRACTION = 0.02

/** Economic contest intensity required to escalate into a major-war conquest. */
export const ECONOMIC_CONTEST_WAR_THRESHOLD = 50

/** Epochs of recent-conquest resentment that can arm rebellion. */
export const RECENT_CONQUEST_RESENTMENT_EPOCHS = 5

/** Absolute faction-tax drain (cp paid) that can arm rebellion pressure. */
export const REBELLION_TAX_DRAIN_CP_THRESHOLD = 100
