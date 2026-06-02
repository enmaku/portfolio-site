import { countMatchOutcomesWhere } from '../../firebase/matchOutcomeCountQuery.js'
import { MATCH_OVER_END_VARIANTS } from '../../ui/humanEliminationCompletionPolicy.js'

/** @typedef {{ key: string, count: number }} BreakdownTileRow */

/** @typedef {{ status: 'ok', breakdown: BreakdownTileRow[] } | { status: 'error' }} EndVariantBreakdownTileResult */

/** @type {readonly string[]} */
export const END_VARIANT_BREAKDOWN_KEYS = [
  MATCH_OVER_END_VARIANTS.VICTORY,
  MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED,
  MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN,
]

/**
 * @typedef {object} EndVariantBreakdownLoaderDeps
 * @property {(field: string, value: unknown, deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countMatchOutcomesWhere]
 * @property {import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps} [countQueryDeps]
 */

/**
 * @param {EndVariantBreakdownLoaderDeps} [deps]
 * @returns {Promise<EndVariantBreakdownTileResult>}
 */
export async function loadEndVariantBreakdownTile(deps = {}) {
  try {
    const countFn = deps.countMatchOutcomesWhere ?? countMatchOutcomesWhere
    const queryDeps = deps.countQueryDeps
    const counts = await Promise.all(
      END_VARIANT_BREAKDOWN_KEYS.map((key) => countFn('endVariant', key, queryDeps)),
    )
    const breakdown = END_VARIANT_BREAKDOWN_KEYS.map((key, index) => ({
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
