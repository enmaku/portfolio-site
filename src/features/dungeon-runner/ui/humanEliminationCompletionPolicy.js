import { MATCH_PHASES } from '../engine/kernel.js'

export const MATCH_OVER_END_VARIANTS = {
  VICTORY: 'victory',
  DEFEAT_NOT_ELIMINATED: 'defeat-not-eliminated',
  ELIMINATION_END_HUMAN: 'elimination-end-human',
}

export function isHumanEliminated(state, humanPlayerSeatId) {
  if (!state?.scoreboard || !humanPlayerSeatId) return false
  return !!state.scoreboard[humanPlayerSeatId]?.eliminated
}

export function needsHeadlessCompletion(state, humanPlayerSeatId) {
  return isHumanEliminated(state, humanPlayerSeatId) && state?.phase !== MATCH_PHASES.MATCH_OVER
}

export function getMatchOverEndDialogVariant(state, humanPlayerSeatId) {
  if (!state || state.phase !== MATCH_PHASES.MATCH_OVER || !humanPlayerSeatId) return null
  const winnerSeatId = state.matchWinnerSeatId
  if (winnerSeatId === humanPlayerSeatId) return MATCH_OVER_END_VARIANTS.VICTORY
  if (isHumanEliminated(state, humanPlayerSeatId)) return MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN
  return MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED
}
