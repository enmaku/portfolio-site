import { MATCHES_PER_WEEK_MAX_WEEKS } from './buildMatchesPerWeekChart.js'
import { MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS } from './computeRollingWeekAverage.js'

export const MATCHES_PER_WEEK_TREND_WINDOW_MIN = 1
export const MATCHES_PER_WEEK_TREND_WINDOW_DEFAULT = MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS

/**
 * @param {number} weekCount
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveMatchesPerWeekTrendWindowSize(weekCount) {
  if (!Number.isFinite(weekCount) || weekCount < 1) {
    return { status: 'error' }
  }
  const max = Math.min(MATCHES_PER_WEEK_MAX_WEEKS, weekCount)
  const min = Math.min(MATCHES_PER_WEEK_TREND_WINDOW_MIN, weekCount)
  const defaultWindow = Math.min(MATCHES_PER_WEEK_TREND_WINDOW_DEFAULT, weekCount)
  return { status: 'ok', min, max, default: defaultWindow }
}
