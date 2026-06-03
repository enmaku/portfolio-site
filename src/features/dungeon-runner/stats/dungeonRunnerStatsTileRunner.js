/** @typedef {'loading' | 'ok' | 'error'} DungeonRunnerStatsTileStatus */

/**
 * @typedef {object} DungeonRunnerStatsBreakdownRow
 * @property {string} key
 * @property {number} count
 */

/**
 * @typedef {object} StatsNumericSeriesChartPayload
 * @property {string[]} labels
 * @property {number[]} values
 * @property {(number | null)[]} [rollingAverageValues]
 * @property {Array<{ sequence: number, modelId: string, labelIndex: number }>} [modelPublishMarkers]
 */

/**
 * @typedef {object} RollingHumanWinRateWindowBounds
 * @property {number} min
 * @property {number} max
 * @property {number} default
 */

/**
 * @typedef {object} MatchLengthSeriesRecord
 * @property {string} createdAt
 * @property {number} historyStepCount
 */

/**
 * @typedef {object} HumanWinSeriesPoint
 * @property {boolean} humanWon
 * @property {unknown} [createdAt]
 */

/**
 * @typedef {object} DungeonRunnerStatsTileState
 * @property {DungeonRunnerStatsTileStatus} status
 * @property {number | string} [value]
 * @property {DungeonRunnerStatsBreakdownRow[]} [breakdown]
 * @property {StatsNumericSeriesChartPayload} [chart]
 * @property {HumanWinSeriesPoint[]} [humanWonSeries]
 * @property {RollingHumanWinRateWindowBounds} [windowBounds]
 * @property {MatchLengthSeriesRecord[]} [matchLengthSeries]
 * @property {number[]} [weeklyCounts]
 * @property {import('./buildMatchesPerWeekChart.js').UtcWeekBucket[]} [weekBuckets]
 * @property {Record<string, string>} [publishedAtByModelId]
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isDisplayableTileValue(value) {
  return Number.isFinite(value) || (typeof value === 'string' && value.length > 0)
}

/**
 * @param {unknown} result
 * @returns {DungeonRunnerStatsTileState | null}
 */
function isValidRollingAverageValues(values, rollingAverageValues) {
  if (rollingAverageValues === undefined) {
    return true
  }
  if (!Array.isArray(rollingAverageValues) || rollingAverageValues.length !== values.length) {
    return false
  }
  return rollingAverageValues.every(
    (value) => value === null || Number.isFinite(value),
  )
}

/**
 * @param {unknown} record
 * @returns {record is MatchLengthSeriesRecord}
 */
function isMatchLengthSeriesRecord(record) {
  return (
    !!record &&
    typeof record.createdAt === 'string' &&
    Number.isFinite(record.historyStepCount)
  )
}

/**
 * @param {unknown} bounds
 * @returns {bounds is RollingHumanWinRateWindowBounds}
 */
function isTrendWindowBounds(bounds) {
  return (
    !!bounds &&
    Number.isFinite(bounds.min) &&
    Number.isFinite(bounds.max) &&
    Number.isFinite(bounds.default) &&
    bounds.min >= 1 &&
    bounds.max >= bounds.min &&
    bounds.default >= bounds.min &&
    bounds.default <= bounds.max
  )
}

function isNumericSeriesChartPayload(chart) {
  return (
    chart &&
    Array.isArray(chart.labels) &&
    Array.isArray(chart.values) &&
    chart.labels.length === chart.values.length &&
    chart.labels.length > 0 &&
    chart.values.every((value) => Number.isFinite(value)) &&
    isValidRollingAverageValues(chart.values, chart.rollingAverageValues)
  )
}

/**
 * @param {unknown} point
 * @returns {point is HumanWinSeriesPoint}
 */
function isHumanWinSeriesPoint(point) {
  return !!point && typeof point.humanWon === 'boolean'
}

function mapLoaderOkResult(result) {
  if (isNumericSeriesChartPayload(result.chart)) {
    if (!isTrendWindowBounds(result.windowBounds)) {
      return { status: 'ok', chart: result.chart }
    }
    const rawMatchLengthSeries = result.matchLengthSeries
    if (Array.isArray(rawMatchLengthSeries)) {
      const matchLengthSeries = rawMatchLengthSeries.filter(isMatchLengthSeriesRecord)
      if (matchLengthSeries.length !== rawMatchLengthSeries.length) {
        return null
      }
      return {
        status: 'ok',
        chart: result.chart,
        matchLengthSeries,
        windowBounds: result.windowBounds,
        publishedAtByModelId:
          result.publishedAtByModelId && typeof result.publishedAtByModelId === 'object'
            ? result.publishedAtByModelId
            : {},
      }
    }
    const rawHumanWonSeries = result.humanWonSeries
    if (Array.isArray(rawHumanWonSeries)) {
      const humanWonSeries = rawHumanWonSeries.filter(isHumanWinSeriesPoint)
      if (humanWonSeries.length !== rawHumanWonSeries.length) {
        return null
      }
      return {
        status: 'ok',
        chart: result.chart,
        humanWonSeries,
        windowBounds: result.windowBounds,
        publishedAtByModelId:
          result.publishedAtByModelId && typeof result.publishedAtByModelId === 'object'
            ? result.publishedAtByModelId
            : {},
      }
    }
    const rawWeeklyCounts = result.weeklyCounts
    const rawWeekBuckets = result.weekBuckets
    if (Array.isArray(rawWeeklyCounts) && Array.isArray(rawWeekBuckets)) {
      const weeklyCounts = rawWeeklyCounts.filter((count) => Number.isFinite(count) && count >= 0)
      const weekBuckets = rawWeekBuckets.filter(
        (bucket) =>
          bucket &&
          typeof bucket.startInclusive === 'string' &&
          typeof bucket.endExclusive === 'string' &&
          typeof bucket.label === 'string',
      )
      if (
        weeklyCounts.length !== rawWeeklyCounts.length ||
        weekBuckets.length !== rawWeekBuckets.length ||
        weeklyCounts.length !== weekBuckets.length
      ) {
        return null
      }
      return {
        status: 'ok',
        chart: result.chart,
        weeklyCounts,
        weekBuckets,
        windowBounds: result.windowBounds,
      }
    }
    return { status: 'ok', chart: result.chart }
  }
  if (Array.isArray(result.breakdown)) {
    const breakdown = result.breakdown.filter(
      (row) =>
        row &&
        typeof row.key === 'string' &&
        Number.isFinite(row.count) &&
        row.count >= 0,
    )
    if (breakdown.length !== result.breakdown.length) {
      return null
    }
    return { status: 'ok', breakdown }
  }
  if (isDisplayableTileValue(result.value)) {
    return { status: 'ok', value: result.value }
  }
  return null
}

/**
 * @param {(deps?: unknown) => Promise<
 *   | { status: 'ok', value: number | string }
 *   | { status: 'ok', breakdown: DungeonRunnerStatsBreakdownRow[] }
 *   | { status: 'ok', chart: StatsNumericSeriesChartPayload, humanWonSeries?: HumanWinSeriesPoint[], matchLengthSeries?: MatchLengthSeriesRecord[], windowBounds?: RollingHumanWinRateWindowBounds, publishedAtByModelId?: Record<string, string> }
 *   | { status: 'ok', chart: StatsNumericSeriesChartPayload }
 *   | { status: 'error' }
 * >} loadQuery
 * @param {unknown} [deps]
 * @returns {Promise<DungeonRunnerStatsTileState>}
 */
export async function runDungeonRunnerStatsTileLoad(loadQuery, deps) {
  try {
    const result = await loadQuery(deps)
    if (result?.status === 'ok') {
      const mapped = mapLoaderOkResult(result)
      if (mapped) {
        return mapped
      }
    }
    return { status: 'error' }
  } catch {
    return { status: 'error' }
  }
}

/**
 * @returns {DungeonRunnerStatsTileState}
 */
export function createDungeonRunnerStatsTileLoadingState() {
  return { status: 'loading' }
}
