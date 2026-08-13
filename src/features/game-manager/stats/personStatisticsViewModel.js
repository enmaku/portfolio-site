import {
  averageScoreForPersonAtGame,
  bankedTimeMsForPerson,
  hIndexForPerson,
  isFirstPlayAtGame,
  isPersonalBestInSession,
  personalBestForPersonAtGame,
  playCountForPersonAtGame,
  pointsPerMinuteForPersonAtGame,
  sessionWinPersonIds,
  winPercentageForPerson,
} from '../domain/stats.js'
import { sessionSortMs } from '../sessions/sessionsListViewModel.js'

function gameKeyString(game) {
  if (!game || typeof game !== 'object') return null
  if (game.kind === 'catalog' && game.catalogEntryId) return `catalog:${game.catalogEntryId}`
  if (game.kind === 'custom' && game.id) return `custom:${game.id}`
  return null
}

function gameKeyFromGame(game) {
  if (!game) return null
  if (game.kind === 'catalog') return { kind: 'catalog', catalogEntryId: game.catalogEntryId }
  if (game.kind === 'custom') return { kind: 'custom', id: game.id }
  return null
}

function personWasPresent(session, recordedPlayerId) {
  return (session.presentPlayers || []).some(
    (p) => !p.removed && p.recordedPlayerId === recordedPlayerId,
  )
}

/**
 * @param {{
 *   person: { id: string, name?: string, color?: string },
 *   sessions: object[],
 * }} input
 * @returns {null | object}
 */
export function buildPersonStatisticsViewModel({ person, sessions }) {
  if (!person?.id) return null
  const list = (sessions || []).filter((s) => personWasPresent(s, person.id))
  if (!list.length) return null

  const gamesByKey = new Map()
  for (const session of list) {
    const key = gameKeyString(session.game)
    const gameKey = gameKeyFromGame(session.game)
    if (!key || !gameKey) continue
    if (!gamesByKey.has(key)) {
      gamesByKey.set(key, {
        key,
        gameKey,
        gameTitle: session.game?.title || '',
        game: session.game || null,
      })
    }
  }

  const games = [...gamesByKey.values()]
    .map((game) => {
      const playCount = playCountForPersonAtGame(list, person.id, game.gameKey)
      if (playCount < 1) return null
      let sessionWins = 0
      for (const s of list) {
        if (s.state !== 'complete') continue
        const sk = gameKeyString(s.game)
        if (sk !== game.key) continue
        if (sessionWinPersonIds(s).includes(person.id)) sessionWins += 1
      }
      return {
        gameKey: game.key,
        gameTitle: game.gameTitle,
        game: game.game,
        playCount,
        personalBest: personalBestForPersonAtGame(list, person.id, game.gameKey),
        averageScore: averageScoreForPersonAtGame(list, person.id, game.gameKey),
        pointsPerMinute: pointsPerMinuteForPersonAtGame(list, person.id, game.gameKey),
        sessionWins,
        winPercentage: winPercentageForPerson(
          list.filter((s) => gameKeyString(s.game) === game.key),
          person.id,
        ),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.playCount !== a.playCount) return b.playCount - a.playCount
      if (b.sessionWins !== a.sessionWins) return b.sessionWins - a.sessionWins
      return String(a.gameTitle).localeCompare(String(b.gameTitle))
    })

  const history = list
    .filter((s) => s.state === 'complete')
    .map((session) => {
      const gameKey = gameKeyFromGame(session.game)
      return {
        sessionId: session.id,
        sortMs: sessionSortMs(session),
        gameTitle: session.game?.title || '',
        game: session.game || null,
        isWinner: sessionWinPersonIds(session).includes(person.id),
        isFirstPlay: gameKey
          ? isFirstPlayAtGame(list, person.id, gameKey, session.id)
          : false,
        isPersonalBest: gameKey
          ? isPersonalBestInSession(list, person.id, gameKey, session)
          : false,
      }
    })
    .sort((a, b) => b.sortMs - a.sortMs)

  return {
    personId: person.id,
    name: person.name || '',
    color: person.color || null,
    sittingsPlayed: list.length,
    gamesPlayed: games.length,
    bankedTimeMs: bankedTimeMsForPerson(list, person.id),
    sessionWins: list.filter((s) => sessionWinPersonIds(s).includes(person.id)).length,
    winPercentage: winPercentageForPerson(list, person.id),
    hIndex: hIndexForPerson(list, person.id),
    games,
    history,
  }
}
