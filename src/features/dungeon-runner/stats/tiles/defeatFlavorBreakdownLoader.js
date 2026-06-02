import { countMatchOutcomesWhere } from '../../firebase/matchOutcomeCountQuery.js'
import { MATCH_OVER_END_VARIANTS } from '../../ui/humanEliminationCompletionPolicy.js'

/** @typedef {{ key: string, count: number }} BreakdownTileRow */

/** @typedef {{ status: 'ok', breakdown: BreakdownTileRow[] } | { status: 'error' }} DefeatFlavorBreakdownTileResult */

/** @type {readonly string[]} */
export const DEFEAT_FLAVOR_BREAKDOWN_KEYS = [
  MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED,
  MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN,
]

/**
 * @typedef {object} DefeatFlavorBreakdownLoaderDeps
 * @property {(field: string, value: unknown, deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countMatchOutcomesWhere]
 * @property {import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps} [countQueryDeps]
 */

/**
 * @param {DefeatFlavorBreakdownLoaderDeps} [deps]
 * @returns {Promise<DefeatFlavorBreakdownTileResult>}
 */
export async function loadDefeatFlavorBreakdownTile(deps = {}) {
  try {
    const countFn = deps.countMatchOutcomesWhere ?? countMatchOutcomesWhere
    const queryDeps = deps.countQueryDeps
    const counts = await Promise.all(
      DEFEAT_FLAVOR_BREAKDOWN_KEYS.map((key) => countFn('endVariant', key, queryDeps)),
    )
    const breakdown = DEFEAT_FLAVOR_BREAKDOWN_KEYS.map((key, index) => ({
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
