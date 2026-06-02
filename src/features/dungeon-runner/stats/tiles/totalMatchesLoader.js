import { countAllMatchOutcomes } from '../../firebase/matchOutcomeCountQuery.js'

/** @typedef {{ status: 'ok', value: number } | { status: 'error' }} TotalMatchesTileResult */

/**
 * @typedef {object} TotalMatchesLoaderDeps
 * @property {(deps?: import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps) => Promise<number>} [countAllMatchOutcomes]
 * @property {import('../../firebase/matchOutcomeCountQuery.js').MatchOutcomeCountQueryDeps} [countQueryDeps]
 */

/**
 * @param {TotalMatchesLoaderDeps} [deps]
 * @returns {Promise<TotalMatchesTileResult>}
 */
export async function loadTotalMatchesTile(deps = {}) {
  try {
    const countFn = deps.countAllMatchOutcomes ?? countAllMatchOutcomes
    const count = await countFn(deps.countQueryDeps)
    if (!Number.isFinite(count) || count <= 0) {
      return { status: 'error' }
    }
    return { status: 'ok', value: count }
  } catch {
    return { status: 'error' }
  }
}
