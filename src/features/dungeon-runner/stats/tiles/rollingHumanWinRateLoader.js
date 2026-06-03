import { fetchHumanWinSeries } from '../../firebase/humanWinSeriesQuery.js'
import { fetchModelCatalog } from '../../models/catalog.js'
import { buildHumanWinRateOverTimeChart } from '../buildHumanWinRateOverTimeChart.js'
import { resolveMatchLengthTrendWindowSize } from '../resolveMatchLengthTrendWindowSize.js'

/**
 * @typedef {object} ModelPublishMarkerView
 * @property {number} sequence
 * @property {string} modelId
 * @property {number} labelIndex
 */

/**
 * @typedef {object} StatsNumericSeriesChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {number[]} rollingAverageValues
 * @property {ModelPublishMarkerView[]} modelPublishMarkers
 */

/**
 * @typedef {object} HumanWinRateTrendWindowBounds
 * @property {number} min
 * @property {number} max
 * @property {number} default
 */

/**
 * @typedef {object} HumanWinSeriesPoint
 * @property {boolean} humanWon
 * @property {unknown} [createdAt]
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart, humanWonSeries: HumanWinSeriesPoint[], windowBounds: HumanWinRateTrendWindowBounds, publishedAtByModelId: Record<string, string> } | { status: 'error' }} RollingHumanWinRateTileResult
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
  try {
    const fetchSeries = deps.fetchHumanWinSeries ?? fetchHumanWinSeries
    const fetchCatalog = deps.fetchModelCatalog ?? fetchModelCatalog
    const records = await fetchSeries(deps.seriesQueryDeps)
    const humanWonSeries = records.map((record) => ({
      humanWon: record.humanWon,
      createdAt: record.createdAt,
    }))
    const boundsResult = resolveMatchLengthTrendWindowSize(humanWonSeries.length)
    if (boundsResult.status === 'error') {
      return { status: 'error' }
    }
    const windowBounds = {
      min: boundsResult.min,
      max: boundsResult.max,
      default: boundsResult.default,
    }
    const catalog = await fetchCatalog()
    const publishedAtByModelId = catalog.publishedAtByModelId ?? {}
    const chartResult = buildHumanWinRateOverTimeChart(
      humanWonSeries,
      publishedAtByModelId,
      windowBounds.default,
    )
    if (chartResult.status === 'error') {
      return { status: 'error' }
    }
    return {
      status: 'ok',
      humanWonSeries,
      windowBounds,
      publishedAtByModelId,
      chart: chartResult.chart,
    }
  } catch {
    return { status: 'error' }
  }
}
