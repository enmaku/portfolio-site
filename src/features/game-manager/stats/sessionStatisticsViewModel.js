import {
  isFirstPlayAtGame,
  isPersonalBestInSession,
  sessionWinPersonIds,
} from '../domain/stats.js'
import { SCORE_ENTRY_MODES, normalizeScoreEntryMode } from '../domain/playSession.js'

function gameKeyFromSession(session) {
  const game = session?.game
  if (!game) return null
  if (game.kind === 'catalog') return { kind: 'catalog', catalogEntryId: game.catalogEntryId }
  if (game.kind === 'custom') return { kind: 'custom', id: game.id }
  return null
}

function bankedMsForSeat(timerExport, recordedPlayerId) {
  const seats = timerExport?.seats
  if (!Array.isArray(seats)) return null
  const seat = seats.find((s) => s && s.recordedPlayerId === recordedPlayerId)
  if (!seat || typeof seat.bankedMs !== 'number' || !Number.isFinite(seat.bankedMs)) return null
  return seat.bankedMs
}

/**
 * @param {{ session: object, sessions: object[] }} input
 */
export function buildSessionStatisticsViewModel({ session, sessions }) {
  const mode = normalizeScoreEntryMode(session?.score?.mode)
  const gameKey = gameKeyFromSession(session)
  const winnerIds = sessionWinPersonIds(session)
  const playTimeMs =
    typeof session?.timerExport?.durationMs === 'number' && Number.isFinite(session.timerExport.durationMs)
      ? session.timerExport.durationMs
      : null

  const players = (session?.presentPlayers || [])
    .filter((p) => p && !p.removed && p.recordedPlayerId)
    .map((p) => {
      const personId = p.recordedPlayerId
      const bankedMs = bankedMsForSeat(session.timerExport, personId)
      const base = {
        personId,
        name: p.name || '',
        color: p.color || null,
        bankedMs,
        isWinner: winnerIds.includes(personId),
        isFirstPlay: gameKey ? isFirstPlayAtGame(sessions, personId, gameKey, session.id) : false,
        isPersonalBest: false,
      }

      if (mode === SCORE_ENTRY_MODES.POINTS) {
        const score = session.score?.perPlayer?.[personId]
        let pointsPerMinute = null
        if (
          typeof score === 'number' &&
          Number.isFinite(score) &&
          typeof bankedMs === 'number' &&
          bankedMs > 0
        ) {
          pointsPerMinute = score / (bankedMs / 60000)
        }
        return {
          ...base,
          score: typeof score === 'number' && Number.isFinite(score) ? score : null,
          pointsPerMinute,
          isPersonalBest: gameKey
            ? isPersonalBestInSession(sessions, personId, gameKey, session)
            : false,
        }
      }

      if (mode === SCORE_ENTRY_MODES.OUTCOMES) {
        return {
          ...base,
          outcome: session.score?.outcomes?.[personId] || null,
          isPersonalBest: false,
        }
      }

      return base
    })

  return {
    mode,
    gameTitle: session?.game?.title || '',
    playTimeMs,
    winnerIds,
    players,
  }
}
