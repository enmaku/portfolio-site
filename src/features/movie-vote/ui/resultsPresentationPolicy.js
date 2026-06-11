import { shouldAnimateRoundsReplay } from '../resultsScoreboard.js'

/**
 * Pure policy for which results phase surfaces mount and whether replay runs.
 *
 * @param {{
 *   votingMethod: import('../votingMethod.js').VotingMethod | string | null | undefined,
 *   electionOutcome: import('../electionOutcomeTypes.js').ElectionOutcome | null | undefined,
 *   roomAuthoritySeq: number | null | undefined,
 *   lastReplayedSeq: number | null | undefined,
 * }} args
 * @returns {{
 *   shouldAnimateReplay: boolean,
 *   showResultsSummaryNow: boolean,
 *   showPairwiseMatrixNow: boolean,
 * }}
 */
export function resolveResultsPresentation({
  votingMethod,
  electionOutcome,
  roomAuthoritySeq,
  lastReplayedSeq,
}) {
  if (!electionOutcome) {
    return {
      shouldAnimateReplay: false,
      showResultsSummaryNow: false,
      showPairwiseMatrixNow: false,
    }
  }

  const isPairwiseMethod = votingMethod === 'condorcet' || votingMethod === 'copeland'
  const hasAuthority = typeof roomAuthoritySeq === 'number' && roomAuthoritySeq > 0
  const alreadyReplayed =
    hasAuthority &&
    typeof lastReplayedSeq === 'number' &&
    lastReplayedSeq >= roomAuthoritySeq

  const canReplayByMethod = shouldAnimateRoundsReplay(electionOutcome)
  const shouldAnimateReplay = canReplayByMethod && hasAuthority && !alreadyReplayed
  const showResultsSummaryNow = !shouldAnimateReplay

  return {
    shouldAnimateReplay,
    showResultsSummaryNow,
    showPairwiseMatrixNow: showResultsSummaryNow && isPairwiseMethod,
  }
}
