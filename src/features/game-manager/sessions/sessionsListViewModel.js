/**
 * @param {object | null | undefined} game
 * @returns {string}
 */
export function sessionGameGroupKey(game) {
  if (!game) return 'unknown'
  if (game.kind === 'catalog' && game.catalogEntryId) return `catalog:${game.catalogEntryId}`
  if (game.kind === 'custom' && game.id) return `custom:${game.id}`
  if (game.title) return `title:${String(game.title).toLowerCase()}`
  return 'unknown'
}

/**
 * Milliseconds used to sort sessions (newest first). Prefers createdAt; falls back to id timestamp.
 * @param {object} session
 * @returns {number}
 */
export function sessionSortMs(session) {
  if (typeof session?.createdAt === 'number' && Number.isFinite(session.createdAt)) {
    return session.createdAt
  }
  const id = String(session?.id || '')
  const match = /^session_([a-z0-9]+)_/i.exec(id)
  if (match) {
    const parsed = Number.parseInt(match[1], 36)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/**
 * Group play sessions by game for the Sessions surface.
 * Games ordered by newest nested session; sessions within a game newest-first.
 *
 * @param {object[]} sessions
 * @returns {{ key: string, game: object, sessions: object[], newestMs: number }[]}
 */
export function buildSessionGameGroups(sessions) {
  /** @type {Map<string, { key: string, game: object, sessions: object[] }>} */
  const byKey = new Map()
  for (const session of sessions || []) {
    const key = sessionGameGroupKey(session?.game)
    let group = byKey.get(key)
    if (!group) {
      group = { key, game: session?.game || { title: 'Unknown' }, sessions: [] }
      byKey.set(key, group)
    }
    group.sessions.push(session)
  }

  const groups = [...byKey.values()].map((group) => {
    const sortedSessions = [...group.sessions].sort((a, b) => sessionSortMs(b) - sessionSortMs(a))
    return {
      key: group.key,
      game: group.game,
      sessions: sortedSessions,
      newestMs: sessionSortMs(sortedSessions[0]),
    }
  })

  groups.sort((a, b) => b.newestMs - a.newestMs)
  return groups
}
