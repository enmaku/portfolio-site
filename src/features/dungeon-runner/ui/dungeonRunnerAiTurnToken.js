import { MATCH_PHASES } from '../engine/kernel.js'

/**
 * Stable id for one AI decision point. Dedupes interval/watch reschedules without
 * blocking multi-step bidding (draw then resolve) or dungeon runner subphases.
 *
 * @param {{ matchId: string, state: object }} params
 */
export function buildAiTurnRunToken({ matchId, state }) {
  if (!matchId || !state) return ''
  const seatId = state.turn?.activeSeatId ?? ''
  const parts = [matchId, String(state.turn?.turnNumber ?? ''), state.phase ?? '', seatId]

  if (state.phase === MATCH_PHASES.BIDDING) {
    parts.push(state.bidding?.subphase ?? '')
    parts.push(state.bidding?.revealedMonsterCard ?? '')
  } else if (state.phase === MATCH_PHASES.DUNGEON) {
    parts.push(state.dungeon?.subphase ?? '')
    parts.push(state.dungeon?.currentMonster ?? '')
    parts.push(String(Array.isArray(state.dungeon?.remainingMonsters) ? state.dungeon.remainingMonsters.length : ''))
  }

  parts.push(String(state.rng?.step ?? ''))

  return parts.join(':')
}
