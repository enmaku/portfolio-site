import { fetchHumanWinSeries } from '../../firebase/humanWinSeriesQuery.js'
import { computeRollingHumanWinRate } from '../computeRollingHumanWinRate.js'
import { resolveRollingWindowSize } from '../resolveRollingWindowSize.js'

/**
 * @typedef {object} RollingHumanWinRateChart
 * @property {string[]} labels match sequence ordinals as strings
 * @property {number[]} percents whole-percent Y values
 */

/**
 * @typedef {object} RollingHumanWinRateWindowBounds
 * @property {number} min
 * @property {number} max
 * @property {number} default
 */

/**
 * @typedef {object} HumanWinSeriesPoint
 * @property {boolean} humanWon
 */

/**
 * @typedef {{ status: 'ok', humanWonSeries: HumanWinSeriesPoint[], windowBounds: RollingHumanWinRateWindowBounds, chart: RollingHumanWinRateChart } | { status: 'error' }} RollingHumanWinRateTileResult
 */

/**
 * @typedef {object} RollingHumanWinRateLoaderDeps
 * @property {() => Promise<import('../../firebase/humanWinSeriesQuery.js').HumanWinSeriesRecord[]>} [fetchHumanWinSeries]
 * @property {import('../../firebase/humanWinSeriesQuery.js').HumanWinSeriesQueryDeps} [seriesQueryDeps]
 */

/**
 * @param {RollingHumanWinRateLoaderDeps} [deps]
 * @returns {Promise<RollingHumanWinRateTileResult>}
 */
export async function loadRollingHumanWinRateTile(deps = {}) {
  try {
    const fetchSeries = deps.fetchHumanWinSeries ?? fetchHumanWinSeries
    const records = await fetchSeries(deps.seriesQueryDeps)
    const humanWonSeries = records.map((record) => ({ humanWon: record.humanWon }))
    const boundsResult = resolveRollingWindowSize(humanWonSeries.length)
    if (boundsResult.status === 'error') {
      return { status: 'error' }
    }
    const windowBounds = {
      min: boundsResult.min,
      max: boundsResult.max,
      default: boundsResult.default,
    }
    const rolling = computeRollingHumanWinRate(humanWonSeries, windowBounds.default)
    if (rolling.status === 'error') {
      return { status: 'error' }
    }
    return {
      status: 'ok',
      humanWonSeries,
      windowBounds,
      chart: {
        labels: rolling.points.map((point) => String(point.sequence)),
        percents: rolling.points.map((point) => point.percent),
      },
    }
  } catch {
    return { status: 'error' }
  }
}
