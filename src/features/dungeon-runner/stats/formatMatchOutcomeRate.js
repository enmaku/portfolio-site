/** Sentinel when a rate cannot be computed (e.g. zero denominator). */
export const MATCH_OUTCOME_RATE_UNAVAILABLE = null

/**
 * @param {number} numerator
 * @param {number} denominator
 * @returns {string | typeof MATCH_OUTCOME_RATE_UNAVAILABLE}
 */
export function formatMatchOutcomeRate(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return MATCH_OUTCOME_RATE_UNAVAILABLE
  }
  const percent = Math.round((numerator / denominator) * 100)
  return `${percent}%`
}
