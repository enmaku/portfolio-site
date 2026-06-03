/** @typedef {'loading' | 'ok' | 'error'} DungeonRunnerStatsTileStatus */

/**
 * @typedef {object} DungeonRunnerStatsBreakdownRow
 * @property {string} key
 * @property {number} count
 */

/**
 * @typedef {object} RollingHumanWinRateChartPayload
 * @property {string[]} labels
 * @property {number[]} percents
 * @property {Array<{ sequence: number, modelId: string, labelIndex: number }>} [modelPublishMarkers]
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
 * @property {RollingHumanWinRateChartPayload | StatsNumericSeriesChartPayload} [chart]
 * @property {HumanWinSeriesPoint[]} [humanWonSeries]
 * @property {RollingHumanWinRateWindowBounds} [windowBounds]
 * @property {MatchLengthSeriesRecord[]} [matchLengthSeries]
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
function isRollingChartPayload(chart) {
  return (
    chart &&
    Array.isArray(chart.labels) &&
    Array.isArray(chart.percents) &&
    chart.labels.length === chart.percents.length &&
    chart.labels.length > 0 &&
    chart.percents.every((value) => Number.isFinite(value))
  )
}

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

function mapLoaderOkResult(result) {
  if (isRollingChartPayload(result.chart)) {
    const humanWonSeries = Array.isArray(result.humanWonSeries)
      ? result.humanWonSeries.filter((point) => point && typeof point.humanWon === 'boolean')
      : []
    const bounds = result.windowBounds
    if (
      humanWonSeries.length < 5 ||
      !bounds ||
      !Number.isFinite(bounds.min) ||
      !Number.isFinite(bounds.max) ||
      !Number.isFinite(bounds.default)
    ) {
      return null
    }
    return {
      status: 'ok',
      chart: result.chart,
      humanWonSeries,
      windowBounds: bounds,
      publishedAtByModelId:
        result.publishedAtByModelId && typeof result.publishedAtByModelId === 'object'
          ? result.publishedAtByModelId
          : {},
    }
  }
  if (isNumericSeriesChartPayload(result.chart)) {
    const rawSeries = result.matchLengthSeries
    if (Array.isArray(rawSeries) && isTrendWindowBounds(result.windowBounds)) {
      const matchLengthSeries = rawSeries.filter(isMatchLengthSeriesRecord)
      if (matchLengthSeries.length !== rawSeries.length) {
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
 *   | { status: 'ok', chart: RollingHumanWinRateChartPayload, humanWonSeries: HumanWinSeriesPoint[], windowBounds: RollingHumanWinRateWindowBounds, publishedAtByModelId?: Record<string, string> }
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
