/**
 * Credit limit and projected annual income (shared with wealth overlay).
 * Domain: world-builder/CONTEXT.md — credit limit, wealth overlay.
 */

/**
 * Projected annual income used for credit limit and wealth normalization.
 *
 * @param {{
 *   priorRealizedNetExportTollIncomeCp?: number,
 *   exportableSurplusAfterSurvivalReservationCp?: number,
 * }} params
 * @returns {number}
 */
export function projectedAnnualIncomeCp(params) {
  const prior = Math.max(0, params.priorRealizedNetExportTollIncomeCp ?? 0)
  const surplus = Math.max(0, params.exportableSurplusAfterSurvivalReservationCp ?? 0)
  return Math.max(prior, surplus)
}

/**
 * @param {{
 *   priorRealizedNetExportTollIncomeCp?: number,
 *   exportableSurplusAfterSurvivalReservationCp?: number,
 * }} params
 * @returns {number}
 */
export function creditLimitCp(params) {
  return projectedAnnualIncomeCp(params)
}
