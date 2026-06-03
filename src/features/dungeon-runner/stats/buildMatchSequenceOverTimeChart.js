import {
  attachLabelIndexToModelPublishMarkers,
  buildModelPublishMarkersForWinSeries,
} from './buildModelPublishMarkersForWinSeries.js'
import { computeRollingAverage } from './computeRollingWeekAverage.js'
import { MATCH_SEQUENCE_TREND_WINDOW_DEFAULT } from './resolveMatchLengthTrendWindowSize.js'

/**
 * @typedef {import('./buildModelPublishMarkersForWinSeries.js').MatchTimelinePoint} MatchTimelinePoint
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').StatsNumericSeriesChart} MatchSequenceOverTimeChart
 */

/**
 * @param {{
 *   timelinePoints: MatchTimelinePoint[],
 *   values: number[],
 *   publishedAtByModelId?: Record<string, string>,
 *   trendWindowSize?: number,
 *   validateValue?: (value: number) => boolean,
 * }} input
 * @returns {{ status: 'ok', chart: MatchSequenceOverTimeChart } | { status: 'error' }}
 */
export function buildMatchSequenceOverTimeChart(input) {
  const {
    timelinePoints,
    values,
    publishedAtByModelId,
    trendWindowSize = MATCH_SEQUENCE_TREND_WINDOW_DEFAULT,
    validateValue = (value) => Number.isFinite(value),
  } = input ?? {}

  if (!Array.isArray(timelinePoints) || timelinePoints.length === 0) {
    return { status: 'error' }
  }
  if (!Array.isArray(values) || values.length !== timelinePoints.length) {
    return { status: 'error' }
  }
  if (values.some((value) => !validateValue(value))) {
    return { status: 'error' }
  }
  if (!Number.isFinite(trendWindowSize) || trendWindowSize < 1) {
    return { status: 'error' }
  }

  const labels = timelinePoints.map((_, index) => String(index + 1))
  const rolling = computeRollingAverage(values, trendWindowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }

  const modelPublishMarkers = attachLabelIndexToModelPublishMarkers(
    labels,
    buildModelPublishMarkersForWinSeries({
      series: timelinePoints,
      publishedAtByModelId,
      chartSequenceMin: 1,
      chartSequenceMax: timelinePoints.length,
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
