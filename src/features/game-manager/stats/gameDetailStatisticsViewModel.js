import {
  averageScoreForPersonAtGame,
  personalBestForPersonAtGame,
  playCountForPersonAtGame,
  playTimeMsFromSessions,
  pointsPerMinuteForPersonAtGame,
  sessionWinPersonIds,
  winPercentageForPerson,
  winShareRows,
} from '../domain/stats.js'

function gameMatches(sessionGame, gameKey) {
  if (!sessionGame || !gameKey) return false
  if (gameKey.kind === 'catalog') {
    return sessionGame.kind === 'catalog' && sessionGame.catalogEntryId === gameKey.catalogEntryId
  }
  if (gameKey.kind === 'custom') {
    return sessionGame.kind === 'custom' && sessionGame.id === gameKey.id
  }
  return false
}

function sessionsForGame(sessions, gameKey) {
  return (sessions || []).filter((s) => gameMatches(s.game, gameKey))
}

function personWasPresent(session, recordedPlayerId) {
  return (session.presentPlayers || []).some(
    (p) => !p.removed && p.recordedPlayerId === recordedPlayerId,
  )
}

/**
 * @param {{
 *   gameKey: { kind: string, catalogEntryId?: string, id?: string },
 *   people: Array<{ id: string, name?: string, color?: string }>,
 *   sessions: object[],
 * }} input
 * @returns {null | object}
 */
export function buildGameDetailStatisticsViewModel({ gameKey, people, sessions }) {
  const atGame = sessionsForGame(sessions, gameKey)
  if (!atGame.length) return null

  const winShare = winShareRows(atGame, people || [])
  const personRows = (people || [])
    .map((person) => {
      const playCount = playCountForPersonAtGame(atGame, person.id, gameKey)
      if (playCount < 1) return null
      const completePresent = atGame.filter(
        (s) => s.state === 'complete' && personWasPresent(s, person.id),
      )
      let sessionWins = 0
      for (const s of completePresent) {
        if (sessionWinPersonIds(s).includes(person.id)) sessionWins += 1
      }
      return {
        personId: person.id,
        name: person.name || '',
        color: person.color || null,
        playCount,
        personalBest: personalBestForPersonAtGame(atGame, person.id, gameKey),
        averageScore: averageScoreForPersonAtGame(atGame, person.id, gameKey),
        pointsPerMinute: pointsPerMinuteForPersonAtGame(atGame, person.id, gameKey),
        sessionWins,
        winPercentage: winPercentageForPerson(atGame, person.id),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.playCount !== a.playCount) return b.playCount - a.playCount
      if (b.sessionWins !== a.sessionWins) return b.sessionWins - a.sessionWins
      return String(a.name).localeCompare(String(b.name))
    })

  return {
    sittings: atGame.length,
    playTimeMs: playTimeMsFromSessions(atGame),
    winShareRows: winShare,
    people: personRows,
  }
}
