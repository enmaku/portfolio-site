import { resolveCappedTrendWindowSize } from './resolveCappedTrendWindowSize.js'

export const MATCH_SEQUENCE_TREND_WINDOW_MIN = 2
export const MATCH_SEQUENCE_TREND_WINDOW_DEFAULT = 10
export const MATCH_SEQUENCE_TREND_WINDOW_MAX = 100

/** @deprecated Use MATCH_SEQUENCE_TREND_WINDOW_MIN */
export const MATCH_LENGTH_TREND_WINDOW_MIN = MATCH_SEQUENCE_TREND_WINDOW_MIN
/** @deprecated Use MATCH_SEQUENCE_TREND_WINDOW_DEFAULT */
export const MATCH_LENGTH_TREND_WINDOW_DEFAULT = MATCH_SEQUENCE_TREND_WINDOW_DEFAULT
/** @deprecated Use MATCH_SEQUENCE_TREND_WINDOW_MAX */
export const MATCH_LENGTH_TREND_WINDOW_MAX = MATCH_SEQUENCE_TREND_WINDOW_MAX

const MATCH_SEQUENCE_CONFIG = {
  min: MATCH_SEQUENCE_TREND_WINDOW_MIN,
  default: MATCH_SEQUENCE_TREND_WINDOW_DEFAULT,
  maxCap: MATCH_SEQUENCE_TREND_WINDOW_MAX,
}

/**
 * @param {number} seriesLength
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveMatchSequenceTrendWindowSize(seriesLength) {
  return resolveCappedTrendWindowSize(seriesLength, MATCH_SEQUENCE_CONFIG)
}

/** @deprecated Use resolveMatchSequenceTrendWindowSize */
export function resolveMatchLengthTrendWindowSize(seriesLength) {
  return resolveMatchSequenceTrendWindowSize(seriesLength)
}
