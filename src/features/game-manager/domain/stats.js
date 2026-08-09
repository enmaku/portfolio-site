import { SCORE_ENTRY_MODES } from './playSession.js'

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
    if (s.score?.mode !== SCORE_ENTRY_MODES.PER_PLAYER) continue
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
    if (s.score?.mode !== SCORE_ENTRY_MODES.PER_PLAYER) continue
    const n = s.score.perPlayer?.[recordedPlayerId]
    const durationMs = s.timerExport?.durationMs
    if (typeof n !== 'number' || !Number.isFinite(n)) continue
    if (typeof durationMs !== 'number' || !(durationMs > 0)) continue
    rates.push(n / (durationMs / 60000))
  }
  if (!rates.length) return null
  return rates.reduce((a, b) => a + b, 0) / rates.length
}
