import {
  countAllMatchOutcomes,
  countMatchOutcomesWhere,
} from '../../firebase/matchOutcomeCountQuery.js'
import {
  formatMatchOutcomeRate,
  MATCH_OUTCOME_RATE_UNAVAILABLE,
} from '../formatMatchOutcomeRate.js'

/** @typedef {{ status: 'ok', value: string } | { status: 'error' }} HumanEliminatedRateTileResult */

/**
 * @typedef {object} HumanEliminatedRateLoaderDeps
 * @property {(field: string, value: unknown, deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countMatchOutcomesWhere]
 * @property {(deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countAllMatchOutcomes]
 * @property {import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps} [countQueryDeps]
 */

/**
 * @param {HumanEliminatedRateLoaderDeps} [deps]
 * @returns {Promise<HumanEliminatedRateTileResult>}
 */
export async function loadHumanEliminatedRateTile(deps = {}) {
  try {
    const countWhere = deps.countMatchOutcomesWhere ?? countMatchOutcomesWhere
    const countAll = deps.countAllMatchOutcomes ?? countAllMatchOutcomes
    const queryDeps = deps.countQueryDeps
    const [numerator, denominator] = await Promise.all([
      countWhere('humanEliminated', true, queryDeps),
      countAll(queryDeps),
    ])
    const formatted = formatMatchOutcomeRate(numerator, denominator)
    if (formatted === MATCH_OUTCOME_RATE_UNAVAILABLE) {
      return { status: 'error' }
    }
    return { status: 'ok', value: formatted }
  } catch {
    return { status: 'error' }
  }
}
