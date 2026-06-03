import { buildUtcWeekBuckets } from './buildUtcWeekBuckets.js'
import {
  computeRollingWeekAverage,
  MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS,
} from './computeRollingWeekAverage.js'

export const MATCHES_PER_WEEK_MAX_WEEKS = 52

/**
 * @typedef {import('./buildUtcWeekBuckets.js').UtcWeekBucket} UtcWeekBucket
 */

/**
 * @typedef {object} MatchesPerWeekChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {(number | null)[]} rollingAverageValues
 * @property {UtcWeekBucket[]} buckets
 */

/**
 * @param {UtcWeekBucket[]} buckets
 * @param {number[]} counts parallel to buckets
 * @param {number} [windowSize]
 * @returns {{ status: 'ok', chart: MatchesPerWeekChart } | { status: 'error' }}
 */
export function buildMatchesPerWeekChart(
  buckets,
  counts,
  windowSize = MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS,
) {
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return { status: 'error' }
  }
  if (!Array.isArray(counts) || counts.length !== buckets.length) {
    return { status: 'error' }
  }
  if (counts.some((count) => !Number.isFinite(count) || count < 0)) {
    return { status: 'error' }
  }
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total <= 0) {
    return { status: 'error' }
  }

  if (!Number.isFinite(windowSize) || windowSize < 1) {
    return { status: 'error' }
  }
  const rolling = computeRollingWeekAverage(counts, windowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }
  const rollingAverageValues = rolling.values

  return {
    status: 'ok',
    chart: {
      labels: buckets.map((bucket) => bucket.label),
      values: counts,
      ...(rollingAverageValues ? { rollingAverageValues } : {}),
      buckets,
    },
  }
}

/**
 * @param {{ nowMs?: number, weekCount?: number }} [options]
 * @returns {UtcWeekBucket[]}
 */
export function buildMatchesPerWeekBuckets(options = {}) {
  const weekCount = options.weekCount ?? MATCHES_PER_WEEK_MAX_WEEKS
  return buildUtcWeekBuckets({ nowMs: options.nowMs, weekCount })
}
