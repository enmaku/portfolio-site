import {
  attachLabelIndexToModelPublishMarkers,
  buildModelPublishMarkersForWinSeries,
} from './buildModelPublishMarkersForWinSeries.js'
import { computeRollingAverage } from './computeRollingWeekAverage.js'
import { MATCH_LENGTH_TREND_WINDOW_DEFAULT } from './resolveMatchLengthTrendWindowSize.js'

/**
 * @typedef {import('../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord} MatchLengthSeriesRecord
 */

/**
 * @typedef {object} ModelPublishMarkerView
 * @property {number} sequence
 * @property {string} modelId
 * @property {number} labelIndex
 */

/**
 * @typedef {object} MatchLengthOverTimeChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {number[]} rollingAverageValues
 * @property {ModelPublishMarkerView[]} modelPublishMarkers
 */

/**
 * @param {MatchLengthSeriesRecord[]} series oldest→newest
 * @param {Record<string, string>} [publishedAtByModelId]
 * @param {number} [trendWindowSize]
 * @returns {{ status: 'ok', chart: MatchLengthOverTimeChart } | { status: 'error' }}
 */
export function buildMatchLengthOverTimeChart(
  series,
  publishedAtByModelId,
  trendWindowSize = MATCH_LENGTH_TREND_WINDOW_DEFAULT,
) {
  if (!Array.isArray(series) || series.length === 0) {
    return { status: 'error' }
  }

  const labels = series.map((_, index) => String(index + 1))
  const values = series.map((point) => point.historyStepCount)
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return { status: 'error' }
  }

  if (!Number.isFinite(trendWindowSize) || trendWindowSize < 1) {
    return { status: 'error' }
  }
  const rolling = computeRollingAverage(values, trendWindowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }

  const matchSeries = series.map((point) => ({
    createdAt: point.createdAt,
    humanWon: false,
  }))
  const modelPublishMarkers = attachLabelIndexToModelPublishMarkers(
    labels,
    buildModelPublishMarkersForWinSeries({
      series: matchSeries,
      publishedAtByModelId,
      chartSequenceMin: 1,
      chartSequenceMax: series.length,
    }),
  )

  return {
    status: 'ok',
    chart: { labels, values, rollingAverageValues: rolling.values, modelPublishMarkers },
  }
}
