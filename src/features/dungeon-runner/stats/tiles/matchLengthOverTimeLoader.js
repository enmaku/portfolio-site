import { fetchMatchLengthSeries } from '../../firebase/matchLengthSeriesQuery.js'
import { fetchModelCatalog } from '../../models/catalog.js'
import { buildMatchLengthOverTimeChart } from '../buildMatchLengthOverTimeChart.js'
import { resolveMatchLengthTrendWindowSize } from '../resolveMatchLengthTrendWindowSize.js'

/**
 * @typedef {object} StatsNumericSeriesChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {number[]} [rollingAverageValues]
 * @property {import('../buildMatchLengthOverTimeChart.js').ModelPublishMarkerView[]} [modelPublishMarkers]
 */

/**
 * @typedef {object} MatchLengthTrendWindowBounds
 * @property {number} min
 * @property {number} max
 * @property {number} default
 */

/**
 * @typedef {{ status: 'ok', chart: StatsNumericSeriesChart, matchLengthSeries: import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord[], windowBounds: MatchLengthTrendWindowBounds, publishedAtByModelId: Record<string, string> } | { status: 'error' }} MatchLengthOverTimeTileResult
 */

/**
 * @typedef {object} MatchLengthOverTimeLoaderDeps
 * @property {() => Promise<import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord[]>} [fetchMatchLengthSeries]
 * @property {import('../../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesQueryDeps} [seriesQueryDeps]
 * @property {() => Promise<{ publishedAtByModelId: Record<string, string> }>} [fetchModelCatalog]
 */

/**
 * @param {MatchLengthOverTimeLoaderDeps} [deps]
 * @returns {Promise<MatchLengthOverTimeTileResult>}
 */
export async function loadMatchLengthOverTimeTile(deps = {}) {
  try {
    const fetchSeries = deps.fetchMatchLengthSeries ?? fetchMatchLengthSeries
    const fetchCatalog = deps.fetchModelCatalog ?? fetchModelCatalog
    const matchLengthSeries = await fetchSeries(deps.seriesQueryDeps)
    const boundsResult = resolveMatchLengthTrendWindowSize(matchLengthSeries.length)
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
    const built = buildMatchLengthOverTimeChart(
      matchLengthSeries,
      publishedAtByModelId,
      windowBounds.default,
    )
    if (built.status === 'error') {
      return { status: 'error' }
    }
    return {
      status: 'ok',
      chart: built.chart,
      matchLengthSeries,
      windowBounds,
      publishedAtByModelId,
    }
  } catch {
    return { status: 'error' }
  }
}
