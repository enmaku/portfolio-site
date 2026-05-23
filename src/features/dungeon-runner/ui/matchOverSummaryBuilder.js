import { MATCH_PHASES } from '../engine/kernel.js'
import {
  getMatchOverEndDialogVariant,
  MATCH_OVER_END_VARIANTS,
} from './humanEliminationCompletionPolicy.js'

const FALLBACK_SUMMARY = {
  variant: null,
  showWinner: false,
  title: 'Match over',
  message: 'The match has ended.',
  winnerLabel: null,
}

export function buildMatchOverSummary({ state = null, humanPlayerSeatId = null, seats = [] } = {}) {
  if (!state || state.phase !== MATCH_PHASES.MATCH_OVER) return { ...FALLBACK_SUMMARY }

  const variant = getMatchOverEndDialogVariant(state, humanPlayerSeatId)
  const winnerSeatId = state.matchWinnerSeatId
  const winnerSeat = seats.find((seat) => seat.id === winnerSeatId)
  const winnerLabel = winnerSeat?.label ?? winnerSeatId ?? 'Unknown'

  if (variant === MATCH_OVER_END_VARIANTS.VICTORY) {
    return {
      variant,
      showWinner: true,
      title: 'Victory!',
      message: 'You won the match. Great run.',
      winnerLabel,
    }
  }

  if (variant === MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN) {
    return {
      variant,
      showWinner: false,
      title: 'Eliminated',
      message: 'You were eliminated from the match.',
      winnerLabel: null,
    }
  }

  if (variant === MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED) {
    return {
      variant,
      showWinner: true,
      title: 'Defeat',
      message: `${winnerLabel} won this match.`,
      winnerLabel,
    }
  }

  return { ...FALLBACK_SUMMARY, variant }
}
