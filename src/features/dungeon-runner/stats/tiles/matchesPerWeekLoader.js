import { countMatchOutcomesCreatedBetween } from '../../firebase/matchOutcomeCountQuery.js'
import {
  buildMatchesPerWeekBuckets,
  buildMatchesPerWeekChart,
} from '../buildMatchesPerWeekChart.js'
import { resolveMatchesPerWeekTrendWindowSize } from '../resolveMatchesPerWeekTrendWindowSize.js'

/**
 * @typedef {object} StatsNumericSeriesChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {(number | null)[]} [rollingAverageValues]
 */

/**
 * @typedef {object} MatchesPerWeekTrendWindowBounds
 * @property {number} min
 * @property {number} max
 * @property {number} default
 */

/**
 * @typedef {import('../buildMatchesPerWeekChart.js').UtcWeekBucket} UtcWeekBucket
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart, weeklyCounts: number[], weekBuckets: UtcWeekBucket[], windowBounds: MatchesPerWeekTrendWindowBounds } | { status: 'error' }} MatchesPerWeekTileResult
 */

/**
 * @typedef {object} MatchesPerWeekLoaderDeps
 * @property {() => UtcWeekBucket[]} [buildWeekBuckets]
 * @property {(startInclusive: string, endExclusive: string, deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countMatchOutcomesCreatedBetween]
 * @property {import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps} [countQueryDeps]
 * @property {number} [nowMs]
 */

/**
 * @param {MatchesPerWeekLoaderDeps} [deps]
 * @returns {Promise<MatchesPerWeekTileResult>}
 */
export async function loadMatchesPerWeekTile(deps = {}) {
  try {
    const buildBuckets = deps.buildWeekBuckets ?? buildMatchesPerWeekBuckets
    const countBetween = deps.countMatchOutcomesCreatedBetween ?? countMatchOutcomesCreatedBetween
    const queryDeps = deps.countQueryDeps
    const buckets = buildBuckets({ nowMs: deps.nowMs })
    const boundsResult = resolveMatchesPerWeekTrendWindowSize(buckets.length)
    if (boundsResult.status === 'error') {
      return { status: 'error' }
    }
    const windowBounds = {
      min: boundsResult.min,
      max: boundsResult.max,
      default: boundsResult.default,
    }
    const counts = await Promise.all(
      buckets.map((bucket) =>
        countBetween(bucket.startInclusive, bucket.endExclusive, queryDeps),
      ),
    )
    const built = buildMatchesPerWeekChart(buckets, counts, windowBounds.default)
    if (built.status === 'error') {
      return { status: 'error' }
    }
    return {
      status: 'ok',
      chart: {
        labels: built.chart.labels,
        values: built.chart.values,
        rollingAverageValues: built.chart.rollingAverageValues,
      },
      weeklyCounts: counts,
      weekBuckets: buckets,
      windowBounds,
    }
  } catch {
    return { status: 'error' }
  }
}
