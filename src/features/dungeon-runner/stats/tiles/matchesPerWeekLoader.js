import { countMatchOutcomesCreatedBetween } from '../../firebase/matchOutcomeCountQuery.js'
import {
  buildMatchesPerWeekBuckets,
  buildMatchesPerWeekChart,
} from '../buildMatchesPerWeekChart.js'

/**
 * @typedef {object} StatsNumericSeriesChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {(number | null)[]} [rollingAverageValues]
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart } | { status: 'error' }} MatchesPerWeekTileResult
 */

/**
 * @typedef {object} MatchesPerWeekLoaderDeps
 * @property {() => import('../buildMatchesPerWeekChart.js').UtcWeekBucket[]} [buildWeekBuckets]
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
    const counts = await Promise.all(
      buckets.map((bucket) =>
        countBetween(bucket.startInclusive, bucket.endExclusive, queryDeps),
      ),
    )
    const built = buildMatchesPerWeekChart(buckets, counts)
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
    }
  } catch {
    return { status: 'error' }
  }
}
