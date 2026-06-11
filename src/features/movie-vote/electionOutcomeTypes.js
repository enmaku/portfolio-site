/**
 * Neutral election outcome types shared across all voting methods.
 */

/**
 * @typedef {object} ElectionRoundLog
 * @property {Record<string, number>} [firstPreferenceCounts] First-preference votes per active candidate (IRV, Borda).
 * @property {Record<string, number>} [lastPlaceCounts] Last-place votes per active candidate (Coombs method).
 * @property {string[]} activeIds Candidates still in the race at start of this round.
 * @property {number} ballotsWithVote Ballots contributing a preference among active candidates this round.
 * @property {string[]} eliminatedIds Removed after this round (empty if election ended without elimination).
 */

/**
 * @typedef {object} ElectionOutcome
 * @property {ElectionRoundLog[]} rounds
 * @property {string | null} winnerId
 * @property {string[] | null} tieWinnerIds `null` if a single winner (or single-candidate trivial case); non-empty
 *   array for a **declared tie**; `[]` only when there are no candidates.
 * @property {import('./votingMethod.js').VotingMethod} [votingMethod]
 * @property {import('./condorcet.js').PairwiseMatrix} [pairwiseMatrix] Condorcet or Copeland method.
 * @property {Record<string, number>} [copelandScores] Copeland method only.
 */

export {}
