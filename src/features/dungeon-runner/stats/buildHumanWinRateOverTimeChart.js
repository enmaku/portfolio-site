import {
  attachLabelIndexToModelPublishMarkers,
  buildModelPublishMarkersForWinSeries,
} from './buildModelPublishMarkersForWinSeries.js'
import { computeRollingAverage } from './computeRollingWeekAverage.js'
import { MATCH_LENGTH_TREND_WINDOW_DEFAULT } from './resolveMatchLengthTrendWindowSize.js'

/**
 * @typedef {import('./computeRollingHumanWinRate.js').HumanWinSeriesPoint} HumanWinSeriesPoint
 */

/**
 * @typedef {object} ModelPublishMarkerView
 * @property {number} sequence
 * @property {string} modelId
 * @property {number} labelIndex
 */

/**
 * @typedef {object} HumanWinRateOverTimeChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {number[]} rollingAverageValues
 * @property {ModelPublishMarkerView[]} modelPublishMarkers
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
  trendWindowSize = MATCH_LENGTH_TREND_WINDOW_DEFAULT,
) {
  if (!Array.isArray(humanWonSeries) || humanWonSeries.length === 0) {
    return { status: 'error' }
  }

  const labels = humanWonSeries.map((_, index) => String(index + 1))
  const values = humanWonSeries.map((point) => (point.humanWon === true ? 100 : 0))
  if (values.some((value) => !Number.isFinite(value))) {
    return { status: 'error' }
  }
  if (!Number.isFinite(trendWindowSize) || trendWindowSize < 1) {
    return { status: 'error' }
  }

  const rolling = computeRollingAverage(values, trendWindowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }

  const modelPublishMarkers = attachLabelIndexToModelPublishMarkers(
    labels,
    buildModelPublishMarkersForWinSeries({
      series: humanWonSeries,
      publishedAtByModelId,
      chartSequenceMin: 1,
      chartSequenceMax: humanWonSeries.length,
    }),
  )

  return {
    status: 'ok',
    chart: {
      labels,
      values,
      rollingAverageValues: rolling.values,
      modelPublishMarkers,
    },
  }
}
