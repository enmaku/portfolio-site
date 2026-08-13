import {
  bankedTimeMsForPerson,
  hIndexForPerson,
  hIndexFromSessions,
  playTimeMsFromSessions,
  sessionWinPersonIds,
  winPercentageForPerson,
  winShareRows,
} from '../domain/stats.js'

function gameKeyString(game) {
  if (!game || typeof game !== 'object') return null
  if (game.kind === 'catalog' && game.catalogEntryId) return `catalog:${game.catalogEntryId}`
  if (game.kind === 'custom' && game.id) return `custom:${game.id}`
  return null
}

function personWasPresent(session, recordedPlayerId) {
  return (session.presentPlayers || []).some(
    (p) => !p.removed && p.recordedPlayerId === recordedPlayerId,
  )
}

function sittingsPlayedForPerson(sessions, personId) {
  return (sessions || []).filter((s) => personWasPresent(s, personId)).length
}

function gamesPlayedForPerson(sessions, personId) {
  const keys = new Set()
  for (const session of sessions || []) {
    if (!personWasPresent(session, personId)) continue
    const key = gameKeyString(session.game)
    if (key) keys.add(key)
  }
  return keys.size
}

function gamesPlayedCount(sessions) {
  const keys = new Set()
  for (const session of sessions || []) {
    const key = gameKeyString(session?.game)
    if (key) keys.add(key)
  }
  return keys.size
}

function sessionWinsForPerson(sessions, personId) {
  let wins = 0
  for (const session of sessions || []) {
    if (sessionWinPersonIds(session).includes(personId)) wins += 1
  }
  return wins
}

/**
 * @param {{
 *   people: Array<{ id: string, name?: string, color?: string }>,
 *   sessions: object[],
 *   gamesInCollection: number,
 * }} input
 */
export function buildAggregateStatisticsViewModel({ people, sessions, gamesInCollection }) {
  const list = sessions || []
  const roster = people || []
  const winShare = winShareRows(list, roster)

  const personRows = roster
    .map((person) => {
      const sittingsPlayed = sittingsPlayedForPerson(list, person.id)
      if (sittingsPlayed < 1) return null
      return {
        personId: person.id,
        name: person.name || '',
        color: person.color || null,
        sittingsPlayed,
        gamesPlayed: gamesPlayedForPerson(list, person.id),
        bankedTimeMs: bankedTimeMsForPerson(list, person.id),
        sessionWins: sessionWinsForPerson(list, person.id),
        winPercentage: winPercentageForPerson(list, person.id),
        hIndex: hIndexForPerson(list, person.id),
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.sittingsPlayed !== a.sittingsPlayed) return b.sittingsPlayed - a.sittingsPlayed
      if (b.sessionWins !== a.sessionWins) return b.sessionWins - a.sessionWins
      return String(a.name).localeCompare(String(b.name))
    })

  return {
    sessionsRecorded: list.length,
    gamesPlayed: gamesPlayedCount(list),
    gamesInCollection: typeof gamesInCollection === 'number' ? gamesInCollection : 0,
    playTimeMs: playTimeMsFromSessions(list),
    hIndex: hIndexFromSessions(list),
    winShareRows: winShare,
    people: personRows,
  }
}
