import { fetchHumanWinSeries } from '../../firebase/humanWinSeriesQuery.js'
import { buildHumanWinRateOverTimeChart } from '../buildHumanWinRateOverTimeChart.js'
import { loadMatchSequenceChartTile } from '../loadMatchSequenceChartTile.js'

/**
 * @typedef {import('../dungeonRunnerStatsChartTypes.js').StatsNumericSeriesChart} StatsNumericSeriesChart
 * @typedef {import('../dungeonRunnerStatsChartTypes.js').TrendWindowBounds} TrendWindowBounds
 * @typedef {import('../dungeonRunnerStatsChartTypes.js').HumanWinSeriesPoint} HumanWinSeriesPoint
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart, humanWonSeries: HumanWinSeriesPoint[], windowBounds: TrendWindowBounds, publishedAtByModelId: Record<string, string> } | { status: 'error' }} RollingHumanWinRateTileResult
 */

/**
 * @typedef {object} RollingHumanWinRateLoaderDeps
 * @property {() => Promise<import('../../firebase/humanWinSeriesQuery.js').HumanWinSeriesRecord[]>} [fetchHumanWinSeries]
 * @property {import('../../firebase/humanWinSeriesQuery.js').HumanWinSeriesQueryDeps} [seriesQueryDeps]
 * @property {() => Promise<{ publishedAtByModelId: Record<string, string> }>} [fetchModelCatalog]
 */

/**
 * @param {RollingHumanWinRateLoaderDeps} [deps]
 * @returns {Promise<RollingHumanWinRateTileResult>}
 */
export async function loadRollingHumanWinRateTile(deps = {}) {
  const fetchSeries = deps.fetchHumanWinSeries ?? fetchHumanWinSeries
  return loadMatchSequenceChartTile({
    fetchSeries: () => fetchSeries(deps.seriesQueryDeps),
    prepareSeries: (records) => {
      const humanWonSeries = records.map((record) => ({
        humanWon: record.humanWon,
        createdAt: record.createdAt,
      }))
      return { timelineSeries: humanWonSeries, humanWonSeries }
    },
    buildChart: buildHumanWinRateOverTimeChart,
    fetchModelCatalog: deps.fetchModelCatalog,
  })
}
