import { countMatchOutcomesWhere } from '../../firebase/matchOutcomeCountQuery.js'

/** @typedef {{ key: string, count: number }} BreakdownTileRow */

/** @typedef {{ status: 'ok', breakdown: BreakdownTileRow[] } | { status: 'error' }} WinnerRoleBreakdownTileResult */

/** @type {readonly string[]} */
export const WINNER_ROLE_BREAKDOWN_TYPES = ['human', 'nn', 'randombot']

/**
 * @typedef {object} WinnerRoleBreakdownLoaderDeps
 * @property {(field: string, value: unknown, deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countMatchOutcomesWhere]
 * @property {import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps} [countQueryDeps]
 */

/**
 * @param {WinnerRoleBreakdownLoaderDeps} [deps]
 * @returns {Promise<WinnerRoleBreakdownTileResult>}
 */
export async function loadWinnerRoleBreakdownTile(deps = {}) {
  try {
    const countFn = deps.countMatchOutcomesWhere ?? countMatchOutcomesWhere
    const queryDeps = deps.countQueryDeps
    const counts = await Promise.all(
      WINNER_ROLE_BREAKDOWN_TYPES.map((roleType) =>
        countFn('winnerRole.type', roleType, queryDeps),
      ),
    )
    const breakdown = WINNER_ROLE_BREAKDOWN_TYPES.map((key, index) => ({
      key,
      count: counts[index],
    }))
    const total = breakdown.reduce((sum, row) => sum + row.count, 0)
    if (!Number.isFinite(total) || total <= 0) {
      return { status: 'error' }
    }
    return { status: 'ok', breakdown }
  } catch {
    return { status: 'error' }
  }
}
