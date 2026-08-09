import {
  averageScoreForPersonAtGame,
  personalBestForPersonAtGame,
  playCountForPersonAtGame,
  pointsPerMinuteForPersonAtGame,
} from '../domain/stats.js'

/**
 * @param {object[]} people
 * @param {object[]} sessions
 */
export function buildStatsRows(people, sessions) {
  /** @type {Array<object>} */
  const rows = []
  const gamesByKey = new Map()

  for (const session of sessions) {
    const game = session.game
    if (!game) continue
    const key =
      game.kind === 'catalog'
        ? `catalog:${game.catalogEntryId}`
        : `custom:${game.id || game.title}`
    if (!gamesByKey.has(key)) {
      gamesByKey.set(key, {
        key,
        title: game.title,
        gameKey:
          game.kind === 'catalog'
            ? { kind: 'catalog', catalogEntryId: game.catalogEntryId }
            : { kind: 'custom', id: game.id },
      })
    }
  }

  for (const person of people) {
    for (const game of gamesByKey.values()) {
      const playCount = playCountForPersonAtGame(sessions, person.id, game.gameKey)
      if (playCount < 1) continue
      rows.push({
        personId: person.id,
        personName: person.name,
        gameKey: game.key,
        gameTitle: game.title,
        playCount,
        personalBest: personalBestForPersonAtGame(sessions, person.id, game.gameKey),
        averageScore: averageScoreForPersonAtGame(sessions, person.id, game.gameKey),
        pointsPerMinute: pointsPerMinuteForPersonAtGame(sessions, person.id, game.gameKey),
      })
    }
  }

  return rows.sort((a, b) => {
    const byPerson = String(a.personName).localeCompare(String(b.personName))
    if (byPerson !== 0) return byPerson
    return String(a.gameTitle).localeCompare(String(b.gameTitle))
  })
}
