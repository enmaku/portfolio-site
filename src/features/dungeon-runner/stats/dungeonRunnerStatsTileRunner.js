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
 * @typedef {object} DungeonRunnerStatsTileState
 * @property {DungeonRunnerStatsTileStatus} status
 * @property {number | string} [value]
 * @property {DungeonRunnerStatsBreakdownRow[]} [breakdown]
 * @property {RollingHumanWinRateChartPayload} [chart]
 * @property {HumanWinSeriesPoint[]} [humanWonSeries]
 * @property {RollingHumanWinRateWindowBounds} [windowBounds]
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
    }
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
 *   | { status: 'ok', chart: RollingHumanWinRateChartPayload, humanWonSeries: HumanWinSeriesPoint[], windowBounds: RollingHumanWinRateWindowBounds }
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
