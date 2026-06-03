import { buildMatchSequenceOverTimeChart } from './buildMatchSequenceOverTimeChart.js'

/**
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').HumanWinSeriesPoint} HumanWinSeriesPoint
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').StatsNumericSeriesChart} HumanWinRateOverTimeChart
 */

/**
 * @param {HumanWinSeriesPoint[]} humanWonSeries oldest→newest
 * @param {Record<string, string>} [publishedAtByModelId]
 * @param {number} [trendWindowSize]
 * @returns {{ status: 'ok', chart: HumanWinRateOverTimeChart } | { status: 'error' }}
 */
export function buildHumanWinRateOverTimeChart(
  humanWonSeries,
  publishedAtByModelId,
  trendWindowSize,
) {
  if (!Array.isArray(humanWonSeries) || humanWonSeries.length === 0) {
    return { status: 'error' }
  }
  return buildMatchSequenceOverTimeChart({
    timelinePoints: humanWonSeries,
    values: humanWonSeries.map((point) => (point.humanWon === true ? 100 : 0)),
    publishedAtByModelId,
    trendWindowSize,
  })
}
