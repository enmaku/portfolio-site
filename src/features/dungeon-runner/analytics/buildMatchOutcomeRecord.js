import {
  getMatchOverEndDialogVariant,
  isHumanEliminated,
  MATCH_OVER_END_VARIANTS,
} from '../ui/humanEliminationCompletionPolicy.js'
import {
  buildHistoryRollups,
  buildOpponentRollups,
  countEquipmentSacrifices,
  normalizeOutcomeRole,
  normalizeOutcomeSeats,
  parseMatchIdEpochMs,
} from './matchOutcomeRollups.js'

export const MATCH_OUTCOME_SCHEMA_VERSION = 1

/**
 * @param {{
 *   matchId: string,
 *   createdAt: string,
 *   setup: { totalSeats: number, opponents: Array<{ type: 'nn' | 'randombot', modelId?: string }> },
 *   state: import('../engine/kernel.js').MatchState,
 *   seats: Array<{ id: string, label: string, role: { type: string, modelId?: string } }>,
 *   humanPlayerSeatId: string,
 *   presentationSpeedProfile?: 'cinematic' | 'brisk',
 * }} input
 */
export function buildMatchOutcomeRecord(input) {
  const { matchId, createdAt, setup, state, seats, humanPlayerSeatId, presentationSpeedProfile } = input ?? {}
  const history = state?.history ?? []
  const outcomeSeats = normalizeOutcomeSeats(seats)
  const endVariant = getMatchOverEndDialogVariant(state, humanPlayerSeatId)
  const humanWon = endVariant === MATCH_OVER_END_VARIANTS.VICTORY
  const matchWinnerSeatId = state?.matchWinnerSeatId ?? ''
  const winnerSeat = outcomeSeats.find((seat) => seat.seatId === matchWinnerSeatId)
  const winnerRole = normalizeOutcomeRole(winnerSeat?.role ?? { type: 'unknown' })
  const scoreboard = state?.scoreboard ?? {}
  const opponentRollups = buildOpponentRollups(setup)
  const historyRollups = buildHistoryRollups(history, outcomeSeats)

  const record = {
    outcomeSchemaVersion: MATCH_OUTCOME_SCHEMA_VERSION,
    matchId,
    createdAt,
    setup,
    seats: outcomeSeats,
    humanWon,
    endVariant,
    humanPlayerSeatId,
    matchWinnerSeatId,
    humanEliminated: isHumanEliminated(state, humanPlayerSeatId),
    winnerRole,
    scoreboard,
    opponentModelIds: opponentRollups.opponentModelIds,
    opponentCountByType: opponentRollups.opponentCountByType,
    ...historyRollups,
    equipmentSacrificeCount: countEquipmentSacrifices(history),
    matchIdEpochMs: parseMatchIdEpochMs(matchId),
  }

  if (presentationSpeedProfile === 'cinematic' || presentationSpeedProfile === 'brisk') {
    record.presentationSpeedProfile = presentationSpeedProfile
  }

  return record
}
