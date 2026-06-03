import { fetchMatchLengthSeries } from '../../firebase/matchLengthSeriesQuery.js'
import { buildMatchLengthOverTimeChart } from '../buildMatchLengthOverTimeChart.js'
import { loadMatchSequenceChartTile } from '../loadMatchSequenceChartTile.js'

/**
 * @typedef {import('../dungeonRunnerStatsChartTypes.js').StatsNumericSeriesChart} StatsNumericSeriesChart
 * @typedef {import('../dungeonRunnerStatsChartTypes.js').TrendWindowBounds} TrendWindowBounds
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart, matchLengthSeries: import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord[], windowBounds: TrendWindowBounds, publishedAtByModelId: Record<string, string> } | { status: 'error' }} MatchLengthOverTimeTileResult
 */

/**
 * @typedef {object} MatchLengthOverTimeLoaderDeps
 * @property {() => Promise<import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord[]>} [fetchMatchLengthSeries]
 * @property {import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesQueryDeps} [seriesQueryDeps]
 * @property {() => Promise<{ publishedAtByModelId: Record<string, string> }>} [fetchModelCatalog]
 */

/**
 * @param {MatchLengthOverTimeLoaderDeps} [deps]
 * @returns {Promise<MatchLengthOverTimeTileResult>}
 */
export async function loadMatchLengthOverTimeTile(deps = {}) {
  const fetchSeries = deps.fetchMatchLengthSeries ?? fetchMatchLengthSeries
  return loadMatchSequenceChartTile({
    fetchSeries: () => fetchSeries(deps.seriesQueryDeps),
    prepareSeries: (matchLengthSeries) => ({ timelineSeries: matchLengthSeries, matchLengthSeries }),
    buildChart: buildMatchLengthOverTimeChart,
    fetchModelCatalog: deps.fetchModelCatalog,
  })
}
