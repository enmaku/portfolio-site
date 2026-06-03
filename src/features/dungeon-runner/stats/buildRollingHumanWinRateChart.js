import {
  attachLabelIndexToModelPublishMarkers,
  buildModelPublishMarkersForWinSeries,
} from './buildModelPublishMarkersForWinSeries.js'
import { computeRollingHumanWinRate } from './computeRollingHumanWinRate.js'

/**
 * @typedef {import('./tiles/rollingHumanWinRateLoader.js').RollingHumanWinRateChart} RollingHumanWinRateChart
 */

/**
 * @param {import('./computeRollingHumanWinRate.js').HumanWinSeriesPoint[]} humanWonSeries
 * @param {number} windowSize
 * @param {Record<string, string>} [publishedAtByModelId]
 * @returns {{ status: 'ok', chart: RollingHumanWinRateChart } | { status: 'error' }}
 */
export function buildRollingHumanWinRateChart(humanWonSeries, windowSize, publishedAtByModelId) {
  const rolling = computeRollingHumanWinRate(humanWonSeries, windowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }
  const labels = rolling.points.map((point) => String(point.sequence))
  const chartSequenceMin = rolling.points[0]?.sequence ?? windowSize
  const chartSequenceMax = rolling.points[rolling.points.length - 1]?.sequence ?? humanWonSeries.length
  const markers = attachLabelIndexToModelPublishMarkers(
    labels,
    buildModelPublishMarkersForWinSeries({
      series: humanWonSeries,
      publishedAtByModelId,
      chartSequenceMin,
      chartSequenceMax,
    }),
  )
  return {
    status: 'ok',
    chart: {
      labels,
      percents: rolling.points.map((point) => point.percent),
      modelPublishMarkers: markers,
    },
  }
}
