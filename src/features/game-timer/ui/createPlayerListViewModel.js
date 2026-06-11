/**
 * @import '../types.js'
 */

import {
  displayedMsForPlayer,
  displayedMsForPlayerInRound,
  maxDisplayedMs,
  maxDisplayedMsInRound,
  progressRatio,
} from '../core.js'

/**
 * @param {object} input
 * @param {GameTimerPlayer[]} input.players
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null, turnStartedRound: number | null }} input.session
 * @param {number} input.round
 * @param {boolean} input.hardPassEnabled
 * @param {Record<string, string[]>} input.hardPassOrderByRound
 * @param {boolean} input.hasMultipleRounds
 * @param {number} input.nowMs
 * @returns {Map<string, GameTimerPlayerRowViewModel>}
 */
export function createPlayerListViewModel({
  players,
  session,
  round,
  hardPassEnabled,
  hardPassOrderByRound,
  hasMultipleRounds,
  nowMs,
}) {
  const hardPassIdsThisRound = new Set(
    Array.isArray(hardPassOrderByRound[String(round)]) ? hardPassOrderByRound[String(round)] : [],
  )

  const maxMs = maxDisplayedMs(players, session, nowMs)
  const maxRoundMs = hasMultipleRounds ? maxDisplayedMsInRound(players, session, nowMs, round) : 0
  const map = new Map()

  for (const p of players) {
    const displayedMs = displayedMsForPlayer(p, session, nowMs)
    const displayedMsRound = hasMultipleRounds
      ? displayedMsForPlayerInRound(p, session, nowMs, round)
      : 0
    const isHardPassed = hardPassEnabled && hardPassIdsThisRound.has(p.id)
    const isPausedHeldTurn =
      !isHardPassed && session.activePlayerId === p.id && session.turnStartedAt == null

    map.set(p.id, {
      id: p.id,
      name: p.name,
      color: p.color,
      displayedMs,
      progress: progressRatio(displayedMs, maxMs),
      displayedMsRound,
      progressRound: hasMultipleRounds ? progressRatio(displayedMsRound, maxRoundMs) : 0,
      isActive: session.activePlayerId === p.id,
      isHardPassed,
      isPausedHeldTurn,
    })
  }

  return map
}

/**
 * @typedef {GameTimerPlayerRow & { isHardPassed: boolean, isPausedHeldTurn: boolean }} GameTimerPlayerRowViewModel
 */
