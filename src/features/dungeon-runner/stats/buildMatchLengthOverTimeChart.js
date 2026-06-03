import { buildMatchSequenceOverTimeChart } from './buildMatchSequenceOverTimeChart.js'

/**
 * @typedef {import('../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord} MatchLengthSeriesRecord
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').ModelPublishMarkerView} ModelPublishMarkerView
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').StatsNumericSeriesChart} MatchLengthOverTimeChart
 */

/**
 * @param {MatchLengthSeriesRecord[]} series oldest→newest
 * @param {Record<string, string>} [publishedAtByModelId]
 * @param {number} [trendWindowSize]
 * @returns {{ status: 'ok', chart: MatchLengthOverTimeChart } | { status: 'error' }}
 */
export function buildMatchLengthOverTimeChart(series, publishedAtByModelId, trendWindowSize) {
  if (!Array.isArray(series) || series.length === 0) {
    return { status: 'error' }
  }
  return buildMatchSequenceOverTimeChart({
    timelinePoints: series,
    values: series.map((point) => point.historyStepCount),
    publishedAtByModelId,
    trendWindowSize,
    validateValue: (value) => Number.isFinite(value) && value >= 0,
  })
}
