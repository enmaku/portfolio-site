/** @typedef {'loading' | 'ok' | 'error'} DungeonRunnerStatsTileStatus */

/**
 * @typedef {object} DungeonRunnerStatsBreakdownRow
 * @property {string} key
 * @property {number} count
 */

/**
 * @typedef {object} DungeonRunnerStatsTileState
 * @property {DungeonRunnerStatsTileStatus} status
 * @property {number | string} [value]
 * @property {DungeonRunnerStatsBreakdownRow[]} [breakdown]
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
function mapLoaderOkResult(result) {
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
