/**
 * Credit limit and projected annual income.
 * Domain: world-builder/CONTEXT.md — credit limit.
 */

/**
 * Projected annual income used for the credit limit.
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
