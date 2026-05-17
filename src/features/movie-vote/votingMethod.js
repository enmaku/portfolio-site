/** @typedef {'irv' | 'borda' | 'dowdall' | 'condorcet' | 'copeland' | 'coombs' | 'baldwin'} VotingMethod */

export const DEFAULT_VOTING_METHOD = /** @type {const} */ ('irv')

/** @type {readonly VotingMethod[]} */
export const VOTING_METHOD_IDS = [
  'irv',
  'borda',
  'dowdall',
  'condorcet',
  'copeland',
  'coombs',
  'baldwin',
]

/** @type {readonly { value: VotingMethod, label: string }[]} */
export const VOTING_METHOD_OPTIONS = [
  { value: 'irv', label: 'Instant-runoff voting' },
  { value: 'borda', label: 'Borda count' },
  { value: 'dowdall', label: 'Dowdall method' },
  { value: 'condorcet', label: 'Condorcet method' },
  { value: 'copeland', label: 'Copeland method' },
  { value: 'coombs', label: 'Coombs method' },
  { value: 'baldwin', label: 'Baldwin method' },
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
