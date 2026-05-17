/** @typedef {'irv' | 'borda' | 'condorcet'} VotingMethod */

export const DEFAULT_VOTING_METHOD = /** @type {const} */ ('irv')

/** @type {readonly VotingMethod[]} */
export const VOTING_METHOD_IDS = ['irv', 'borda', 'condorcet']

/** @type {readonly { value: VotingMethod, label: string }[]} */
export const VOTING_METHOD_OPTIONS = [
  { value: 'irv', label: 'Instant-runoff voting' },
  { value: 'borda', label: 'Borda count' },
  { value: 'condorcet', label: 'Condorcet method' },
]

/**
 * @param {unknown} value
 * @returns {VotingMethod}
 */
export function normalizeVotingMethod(value) {
  if (value === 'ranked-points') return DEFAULT_VOTING_METHOD
  return VOTING_METHOD_IDS.includes(/** @type {VotingMethod} */ (value))
    ? /** @type {VotingMethod} */ (value)
    : DEFAULT_VOTING_METHOD
}
