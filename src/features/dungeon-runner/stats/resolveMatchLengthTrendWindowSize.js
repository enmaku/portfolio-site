export const MATCH_LENGTH_TREND_WINDOW_MIN = 2
export const MATCH_LENGTH_TREND_WINDOW_DEFAULT = 10
export const MATCH_LENGTH_TREND_WINDOW_MAX = 100

/**
 * @param {number} seriesLength
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveMatchLengthTrendWindowSize(seriesLength) {
  if (!Number.isFinite(seriesLength) || seriesLength < 1) {
    return { status: 'error' }
  }
  const max = Math.min(MATCH_LENGTH_TREND_WINDOW_MAX, seriesLength)
  const min = Math.min(MATCH_LENGTH_TREND_WINDOW_MIN, seriesLength)
  const defaultWindow = Math.min(MATCH_LENGTH_TREND_WINDOW_DEFAULT, seriesLength)
  return { status: 'ok', min, max, default: defaultWindow }
}
