import { fetchModelCatalog } from '../models/catalog.js'
import { resolveMatchSequenceTrendWindowSize } from './resolveMatchLengthTrendWindowSize.js'

/**
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').StatsNumericSeriesChart} StatsNumericSeriesChart
 * @typedef {import('./dungeonRunnerStatsChartTypes.js').TrendWindowBounds} TrendWindowBounds
 */

/**
 * @param {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }} boundsResult
 * @returns {TrendWindowBounds | null}
 */
export function toTrendWindowBounds(boundsResult) {
  if (boundsResult.status === 'error') {
    return null
  }
  return {
    min: boundsResult.min,
    max: boundsResult.max,
    default: boundsResult.default,
  }
}

/**
 * @template TRecord, TSeries, TExtra
 * @param {{
 *   fetchSeries: (seriesQueryDeps?: unknown) => Promise<TRecord[]>,
 *   prepareSeries: (records: TRecord[]) => { timelineSeries: TSeries[] } & TExtra,
 *   buildChart: (
 *     series: TSeries[],
 *     publishedAtByModelId: Record<string, string>,
 *     defaultWindow: number,
 *   ) => {{ status: 'ok', chart: StatsNumericSeriesChart } | { status: 'error' }},
 *   resolveWindowSize?: (length: number) => { status: 'ok', min: number, max: number, default: number } | { status: 'error' },
 *   fetchModelCatalog?: () => Promise<{ publishedAtByModelId?: Record<string, string> }>,
 *   seriesQueryDeps?: unknown,
 * }} options
 * @returns {Promise<
 *   | ({ status: 'ok', chart: StatsNumericSeriesChart, windowBounds: TrendWindowBounds, publishedAtByModelId: Record<string, string> } & TExtra)
 *   | { status: 'error' }
 * >}
 */
export async function loadMatchSequenceChartTile(options) {
  const {
    fetchSeries,
    prepareSeries,
    buildChart,
    resolveWindowSize = resolveMatchSequenceTrendWindowSize,
    fetchModelCatalog: fetchCatalog = fetchModelCatalog,
    seriesQueryDeps,
  } = options

  try {
    const records = await fetchSeries(seriesQueryDeps)
    const { timelineSeries, ...resultFields } = prepareSeries(records)
    const windowBounds = toTrendWindowBounds(resolveWindowSize(timelineSeries.length))
    if (!windowBounds) {
      return { status: 'error' }
    }
    const catalog = await fetchCatalog()
    const publishedAtByModelId = catalog.publishedAtByModelId ?? {}
    const built = buildChart(timelineSeries, publishedAtByModelId, windowBounds.default)
    if (built.status === 'error') {
      return { status: 'error' }
    }
    return {
      status: 'ok',
      chart: built.chart,
      windowBounds,
      publishedAtByModelId,
      ...resultFields,
    }
  } catch {
    return { status: 'error' }
  }
}
