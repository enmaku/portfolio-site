import { resolveCappedTrendWindowSize } from './resolveCappedTrendWindowSize.js'

export const HUMAN_WIN_RATE_TREND_WINDOW_MIN = 2
export const HUMAN_WIN_RATE_TREND_WINDOW_DEFAULT = 20
export const HUMAN_WIN_RATE_TREND_WINDOW_MAX = 100

const HUMAN_WIN_RATE_CONFIG = {
  min: HUMAN_WIN_RATE_TREND_WINDOW_MIN,
  default: HUMAN_WIN_RATE_TREND_WINDOW_DEFAULT,
  maxCap: HUMAN_WIN_RATE_TREND_WINDOW_MAX,
}

/**
 * @param {number} seriesLength
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveHumanWinRateTrendWindowSize(seriesLength) {
  return resolveCappedTrendWindowSize(seriesLength, HUMAN_WIN_RATE_CONFIG)
}
