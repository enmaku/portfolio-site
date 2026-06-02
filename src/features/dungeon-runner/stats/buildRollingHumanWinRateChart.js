import { computeRollingHumanWinRate } from './computeRollingHumanWinRate.js'

/**
 * @typedef {import('./tiles/rollingHumanWinRateLoader.js').RollingHumanWinRateChart} RollingHumanWinRateChart
 */

/**
 * @param {{ humanWon: boolean }[]} humanWonSeries
 * @param {number} windowSize
 * @returns {{ status: 'ok', chart: RollingHumanWinRateChart } | { status: 'error' }}
 */
export function buildRollingHumanWinRateChart(humanWonSeries, windowSize) {
  const rolling = computeRollingHumanWinRate(humanWonSeries, windowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }
  return {
    status: 'ok',
    chart: {
      labels: rolling.points.map((point) => String(point.sequence)),
      percents: rolling.points.map((point) => point.percent),
    },
  }
}
