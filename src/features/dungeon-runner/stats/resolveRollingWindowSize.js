const ROLLING_WINDOW_MIN = 5
const ROLLING_WINDOW_DEFAULT = 10
const ROLLING_WINDOW_MAX = 100

/**
 * @param {number} seriesLength
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveRollingWindowSize(seriesLength) {
  if (!Number.isFinite(seriesLength) || seriesLength < ROLLING_WINDOW_MIN) {
    return { status: 'error' }
  }
  return {
    status: 'ok',
    min: ROLLING_WINDOW_MIN,
    max: Math.min(ROLLING_WINDOW_MAX, seriesLength),
    default: Math.min(ROLLING_WINDOW_DEFAULT, seriesLength),
  }
}
