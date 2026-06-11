import {
  countsForScoreboardRound,
  isBordaScoreboardResult,
  isDowdallScoreboardResult,
  replayHeadingForResult,
  scoreUnitForResult,
  showVotePoolSuffix,
  targetPctsForScoreboardRound,
  totalRoundsForReplay,
} from '../resultsScoreboard.js'
import { buildBallotMovieIndex } from './ballotMovieIndex.js'

/**
 * @param {{
 *   electionOutcome: import('../electionOutcomeTypes.js').ElectionOutcome | null | undefined,
 *   ballotMovies: import('../types.js').BallotMovie[],
 * }} args
 * @returns {{
 *   steps: Array<{
 *     roundIdx: number,
 *     heading: string,
 *     eliminatedIds: string[],
 *     poolLabel: string,
 *     scoreUnit: string,
 *     showPoolSuffix: boolean,
 *     rows: Array<{ id: string, votes: number, barTargetPct: number, posterPath: string | null }>,
 *   }>,
 * }}
 */
export function createRoundsLogReplayViewModel({ electionOutcome, ballotMovies }) {
  if (!electionOutcome?.rounds?.length) {
    return { steps: [] }
  }

  const index = buildBallotMovieIndex(ballotMovies)
  const rounds = electionOutcome.rounds
  const totalRounds = totalRoundsForReplay(rounds)
  const votingMethod = electionOutcome.votingMethod
  const scoreUnit = scoreUnitForResult(electionOutcome)
  const showPoolSuffix = showVotePoolSuffix(electionOutcome)

  const steps = rounds.map((round, roundIdx) => {
    const counts = countsForScoreboardRound(round, votingMethod)
    const barTargets = targetPctsForScoreboardRound(round, votingMethod)
    const rows = round.activeIds
      .map((id) => ({
        id,
        votes: counts[id] ?? 0,
        barTargetPct: barTargets[id] ?? 0,
        posterPath: index.get(id)?.posterPath ?? null,
      }))
      .sort((a, b) => {
        if (a.votes !== b.votes) return b.votes - a.votes
        return a.id.localeCompare(b.id)
      })

    const poolLabel =
      typeof round.ballotsWithVote === 'number' && round.ballotsWithVote > 0
        ? String(round.ballotsWithVote)
        : '—'

    return {
      roundIdx,
      heading: replayHeadingForResult(electionOutcome, roundIdx, totalRounds),
      eliminatedIds: Array.isArray(round.eliminatedIds)
        ? round.eliminatedIds.filter(Boolean)
        : [],
      poolLabel,
      scoreUnit,
      showPoolSuffix,
      rows,
      headingKind: isBordaScoreboardResult(electionOutcome)
        ? 'finalScores'
        : isDowdallScoreboardResult(electionOutcome)
          ? 'dowdallScores'
          : 'roundOfTotal',
      totalRounds: isBordaScoreboardResult(electionOutcome) ||
        isDowdallScoreboardResult(electionOutcome)
        ? undefined
        : totalRounds,
    }
  })

  return { steps }
}
