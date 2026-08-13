import { SCORE_ENTRY_MODES, normalizeScoreEntryMode } from './playSession.js'

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

function personWasPresent(session, recordedPlayerId) {
  return (session.presentPlayers || []).some(
    (p) => !p.removed && p.recordedPlayerId === recordedPlayerId,
  )
}

function sessionsForPersonAtGame(sessions, recordedPlayerId, gameKey) {
  return sessions.filter(
    (s) => personWasPresent(s, recordedPlayerId) && gameMatches(s.game, gameKey),
  )
}

/**
 * @param {object[]} sessions
 * @param {string} recordedPlayerId
 * @param {{ kind: string, catalogEntryId?: string, id?: string }} gameKey
 */
export function playCountForPersonAtGame(sessions, recordedPlayerId, gameKey) {
  return sessionsForPersonAtGame(sessions, recordedPlayerId, gameKey).length
}

function perPlayerScores(sessions, recordedPlayerId, gameKey) {
  const values = []
  for (const s of sessionsForPersonAtGame(sessions, recordedPlayerId, gameKey)) {
    if (normalizeScoreEntryMode(s.score?.mode) !== SCORE_ENTRY_MODES.POINTS) continue
    const n = s.score.perPlayer?.[recordedPlayerId]
    if (typeof n === 'number' && Number.isFinite(n)) values.push(n)
  }
  return values
}

export function personalBestForPersonAtGame(sessions, recordedPlayerId, gameKey) {
  const values = perPlayerScores(sessions, recordedPlayerId, gameKey)
  if (!values.length) return null
  return Math.max(...values)
}

export function averageScoreForPersonAtGame(sessions, recordedPlayerId, gameKey) {
  const values = perPlayerScores(sessions, recordedPlayerId, gameKey)
  if (!values.length) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return sum / values.length
}

export function pointsPerMinuteForPersonAtGame(sessions, recordedPlayerId, gameKey) {
  const rates = []
  for (const s of sessionsForPersonAtGame(sessions, recordedPlayerId, gameKey)) {
    if (normalizeScoreEntryMode(s.score?.mode) !== SCORE_ENTRY_MODES.POINTS) continue
    const n = s.score.perPlayer?.[recordedPlayerId]
    const bankedMs = bankedMsForPerson(s.timerExport, recordedPlayerId)
    if (typeof n !== 'number' || !Number.isFinite(n)) continue
    if (typeof bankedMs !== 'number' || !(bankedMs > 0)) continue
    rates.push(n / (bankedMs / 60000))
  }
  if (!rates.length) return null
  return rates.reduce((a, b) => a + b, 0) / rates.length
}

/**
 * @param {{ seats?: Array<{ recordedPlayerId?: string, bankedMs?: number }> } | null | undefined} timerExport
 * @param {string} recordedPlayerId
 * @returns {number | null}
 */
function bankedMsForPerson(timerExport, recordedPlayerId) {
  const seats = timerExport?.seats
  if (!Array.isArray(seats)) return null
  const seat = seats.find((s) => s && s.recordedPlayerId === recordedPlayerId)
  if (!seat || typeof seat.bankedMs !== 'number' || !Number.isFinite(seat.bankedMs)) return null
  return seat.bankedMs
}

function activePresentPlayers(session) {
  return (session?.presentPlayers || []).filter((p) => p && !p.removed && p.recordedPlayerId)
}

/**
 * Person ids who earned a session win on a complete sitting.
 * @param {object | null | undefined} session
 * @returns {string[]}
 */
export function sessionWinPersonIds(session) {
  if (!session || session.state !== 'complete' || !session.score) return []
  const present = activePresentPlayers(session)
  if (!present.length) return []

  const mode = normalizeScoreEntryMode(session.score.mode)
  if (mode === SCORE_ENTRY_MODES.POINTS) {
    const perPlayer = session.score.perPlayer || {}
    let best = -Infinity
    const scored = []
    for (const p of present) {
      const n = perPlayer[p.recordedPlayerId]
      if (typeof n !== 'number' || !Number.isFinite(n)) continue
      scored.push({ id: p.recordedPlayerId, n })
      if (n > best) best = n
    }
    if (!Number.isFinite(best) || best === -Infinity) return []
    return scored.filter((s) => s.n === best).map((s) => s.id)
  }

  if (mode === SCORE_ENTRY_MODES.OUTCOMES) {
    const marks = session.score.outcomes || {}
    return present.filter((p) => marks[p.recordedPlayerId] === 'win').map((p) => p.recordedPlayerId)
  }

  return []
}

/**
 * @param {object[]} sessions
 * @param {Array<{ id: string, name?: string, color?: string }>} people
 * @returns {Array<{ personId: string, name: string, color: string | null, credits: number, share: number }>}
 */
export function winShareRows(sessions, people) {
  const creditById = new Map()
  for (const session of sessions || []) {
    for (const id of sessionWinPersonIds(session)) {
      creditById.set(id, (creditById.get(id) || 0) + 1)
    }
  }

  const peopleById = new Map((people || []).map((p) => [p.id, p]))
  let total = 0
  const rows = []
  for (const [personId, credits] of creditById) {
    if (!peopleById.has(personId)) continue
    total += credits
    const person = peopleById.get(personId)
    rows.push({
      personId,
      name: person.name || '',
      color: person.color || null,
      credits,
      share: 0,
    })
  }
  if (total > 0) {
    for (const row of rows) row.share = row.credits / total
  }
  rows.sort((a, b) => b.credits - a.credits || a.name.localeCompare(b.name))
  return rows
}

/**
 * @param {object[]} sessions
 * @param {string} recordedPlayerId
 * @returns {number | null}
 */
export function winPercentageForPerson(sessions, recordedPlayerId) {
  if (!recordedPlayerId) return null
  let complete = 0
  let wins = 0
  for (const session of sessions || []) {
    if (session?.state !== 'complete') continue
    if (!personWasPresent(session, recordedPlayerId)) continue
    complete += 1
    if (sessionWinPersonIds(session).includes(recordedPlayerId)) wins += 1
  }
  if (complete === 0) return null
  return wins / complete
}

/**
 * @param {object[]} sessions
 * @returns {number}
 */
export function playTimeMsFromSessions(sessions) {
  let total = 0
  for (const session of sessions || []) {
    const ms = session?.timerExport?.durationMs
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) total += ms
  }
  return total
}

/**
 * @param {object[]} sessions
 * @param {string} recordedPlayerId
 * @returns {number}
 */
export function bankedTimeMsForPerson(sessions, recordedPlayerId) {
  if (!recordedPlayerId) return 0
  let total = 0
  for (const session of sessions || []) {
    const ms = bankedMsForPerson(session?.timerExport, recordedPlayerId)
    if (typeof ms === 'number' && ms > 0) total += ms
  }
  return total
}

function gameKeyString(game) {
  if (!game || typeof game !== 'object') return null
  if (game.kind === 'catalog' && game.catalogEntryId) return `catalog:${game.catalogEntryId}`
  if (game.kind === 'custom' && game.id) return `custom:${game.id}`
  return null
}

function playCountsByGameKey(sessions, recordedPlayerId = null) {
  const counts = new Map()
  for (const session of sessions || []) {
    if (recordedPlayerId && !personWasPresent(session, recordedPlayerId)) continue
    const key = gameKeyString(session?.game)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

function hIndexFromCounts(counts) {
  const sorted = [...counts.values()].sort((a, b) => b - a)
  let h = 0
  for (let i = 0; i < sorted.length; i += 1) {
    const n = i + 1
    if (sorted[i] >= n) h = n
    else break
  }
  return h
}

/**
 * @param {object[]} sessions
 * @returns {number}
 */
export function hIndexFromSessions(sessions) {
  return hIndexFromCounts(playCountsByGameKey(sessions))
}

/**
 * @param {object[]} sessions
 * @param {string} recordedPlayerId
 * @returns {number}
 */
export function hIndexForPerson(sessions, recordedPlayerId) {
  if (!recordedPlayerId) return 0
  return hIndexFromCounts(playCountsByGameKey(sessions, recordedPlayerId))
}

/**
 * @param {object[]} sessions
 * @param {string} recordedPlayerId
 * @param {{ kind: string, catalogEntryId?: string, id?: string }} gameKey
 * @param {string} sessionId
 * @returns {boolean}
 */
export function isFirstPlayAtGame(sessions, recordedPlayerId, gameKey, sessionId) {
  if (!recordedPlayerId || !sessionId) return false
  const atGame = sessionsForPersonAtGame(sessions, recordedPlayerId, gameKey)
  if (!atGame.length) return false
  let earliest = atGame[0]
  for (const s of atGame) {
    const t = typeof s.createdAt === 'number' ? s.createdAt : Number.POSITIVE_INFINITY
    const et = typeof earliest.createdAt === 'number' ? earliest.createdAt : Number.POSITIVE_INFINITY
    if (t < et) earliest = s
  }
  return earliest.id === sessionId
}

/**
 * @param {object[]} sessions
 * @param {string} recordedPlayerId
 * @param {{ kind: string, catalogEntryId?: string, id?: string }} gameKey
 * @param {object} session
 * @returns {boolean}
 */
export function isPersonalBestInSession(sessions, recordedPlayerId, gameKey, session) {
  if (!session || session.state !== 'complete') return false
  if (normalizeScoreEntryMode(session.score?.mode) !== SCORE_ENTRY_MODES.POINTS) return false
  if (!personWasPresent(session, recordedPlayerId)) return false
  if (isFirstPlayAtGame(sessions, recordedPlayerId, gameKey, session.id)) return false
  const score = session.score?.perPlayer?.[recordedPlayerId]
  if (typeof score !== 'number' || !Number.isFinite(score)) return false
  const best = personalBestForPersonAtGame(sessions, recordedPlayerId, gameKey)
  return best === score
}
