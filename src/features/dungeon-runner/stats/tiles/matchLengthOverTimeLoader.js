import { fetchMatchLengthSeries } from '../../firebase/matchLengthSeriesQuery.js'
import { buildMatchLengthOverTimeChart } from '../buildMatchLengthOverTimeChart.js'

/**
 * @typedef {object} StatsNumericSeriesChart
 * @property {string[]} labels
 * @property {number[]} values
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart } | { status: 'error' }} MatchLengthOverTimeTileResult
 */

/**
 * @typedef {object} MatchLengthOverTimeLoaderDeps
 * @property {() => Promise<import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord[]>} [fetchMatchLengthSeries]
 * @property {import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesQueryDeps} [seriesQueryDeps]
 */

/**
 * @param {MatchLengthOverTimeLoaderDeps} [deps]
 * @returns {Promise<MatchLengthOverTimeTileResult>}
 */
export async function loadMatchLengthOverTimeTile(deps = {}) {
  try {
    const fetchSeries = deps.fetchMatchLengthSeries ?? fetchMatchLengthSeries
    const records = await fetchSeries(deps.seriesQueryDeps)
    const built = buildMatchLengthOverTimeChart(records)
    if (built.status === 'error') {
      return { status: 'error' }
    }
    return { status: 'ok', chart: built.chart }
  } catch {
    return { status: 'error' }
  }
}
