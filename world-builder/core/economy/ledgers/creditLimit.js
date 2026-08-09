/**
 * Credit limit from projected annual income.
 * Domain: world-builder/CONTEXT.md — credit limit.
 */

/**
 * Credit limit for mutual-credit / import room: max of prior realized net export+toll
 * income and exportable surplus after survival reservation.
 *
 * @param {{
 *   priorRealizedNetExportTollIncomeCp?: number,
 *   exportableSurplusAfterSurvivalReservationCp?: number,
 * }} params
 * @returns {number}
 */
export function creditLimitCp(params) {
  const prior = Math.max(0, params.priorRealizedNetExportTollIncomeCp ?? 0)
  const surplus = Math.max(0, params.exportableSurplusAfterSurvivalReservationCp ?? 0)
  return Math.max(prior, surplus)
}
