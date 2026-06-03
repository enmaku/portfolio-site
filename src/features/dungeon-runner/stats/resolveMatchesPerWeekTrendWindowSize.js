import { MATCHES_PER_WEEK_MAX_WEEKS } from './buildMatchesPerWeekChart.js'
import { MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS } from './computeRollingWeekAverage.js'
import { resolveCappedTrendWindowSize } from './resolveCappedTrendWindowSize.js'

export const MATCHES_PER_WEEK_TREND_WINDOW_MIN = 1
export const MATCHES_PER_WEEK_TREND_WINDOW_DEFAULT = MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS

const MATCHES_PER_WEEK_CONFIG = {
  min: MATCHES_PER_WEEK_TREND_WINDOW_MIN,
  default: MATCHES_PER_WEEK_TREND_WINDOW_DEFAULT,
  maxCap: MATCHES_PER_WEEK_MAX_WEEKS,
}

/**
 * @param {number} weekCount
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveMatchesPerWeekTrendWindowSize(weekCount) {
  return resolveCappedTrendWindowSize(weekCount, MATCHES_PER_WEEK_CONFIG)
}
