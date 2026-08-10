/** @typedef {'setup' | 'playing' | 'scoring' | 'complete'} PlaySessionState */

export const SCORE_ENTRY_MODES = Object.freeze({
  POINTS: 'points',
  OUTCOMES: 'outcomes',
})

const FORWARD = {
  setup: new Set(['playing']),
  playing: new Set(['scoring']),
  scoring: new Set(['complete']),
  complete: new Set([]),
}

/**
 * @param {{ id: string, game: object, presentPlayers?: object[] }} input
 */
export function createPlaySession(input) {
  return {
    id: input.id,
    game: input.game,
    presentPlayers: input.presentPlayers ? [...input.presentPlayers] : [],
    state: /** @type {PlaySessionState} */ ('setup'),
    score: null,
    timerExport: null,
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now(),
  }
}

/**
 * Normalize stored mode strings, including legacy values.
 * @param {string | null | undefined} mode
 * @returns {string | null}
 */
export function normalizeScoreEntryMode(mode) {
  if (mode === SCORE_ENTRY_MODES.POINTS || mode === 'per_player') return SCORE_ENTRY_MODES.POINTS
  if (mode === SCORE_ENTRY_MODES.OUTCOMES || mode === 'outcome_marks') return SCORE_ENTRY_MODES.OUTCOMES
  if (mode === 'shared') return 'shared'
  return mode || null
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 */
export function canCompletePlaySession(session) {
  if (!session || session.presentPlayers.length < 1) return false
  const mode = normalizeScoreEntryMode(session.score?.mode)
  if (!mode) return false
  const score = session.score

  if (mode === SCORE_ENTRY_MODES.POINTS) {
    const perPlayer = score.perPlayer || {}
    return session.presentPlayers.every(
      (p) => typeof perPlayer[p.recordedPlayerId] === 'number' && Number.isFinite(perPlayer[p.recordedPlayerId]),
    )
  }

  if (mode === 'shared') {
    return typeof score.shared === 'number' && Number.isFinite(score.shared)
  }

  if (mode === SCORE_ENTRY_MODES.OUTCOMES) {
    const marks = score.outcomes || {}
    return session.presentPlayers.every((p) => {
      const mark = marks[p.recordedPlayerId]
      return mark === 'win' || mark === 'loss' || mark === 'draw'
    })
  }

  return false
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 * @param {object} score
 */
export function setPlaySessionScore(session, score) {
  const mode = normalizeScoreEntryMode(score?.mode) || score?.mode
  return { ...session, score: { ...score, mode } }
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 * @param {object[]} presentPlayers
 */
export function setPresentPlayers(session, presentPlayers) {
  return { ...session, presentPlayers: [...presentPlayers] }
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 * @param {{ recordedPlayerId: string, name: string, color: string }} player
 */
export function addPresentPlayer(session, player) {
  if (session.presentPlayers.some((p) => p.recordedPlayerId === player.recordedPlayerId)) {
    return session
  }
  return {
    ...session,
    presentPlayers: [...session.presentPlayers, { ...player }],
  }
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 * @param {PlaySessionState} next
 */
export function transitionPlaySessionState(session, next) {
  if (session.state === 'complete' && next === 'scoring') {
    return { ...session, state: 'scoring' }
  }

  const allowed = FORWARD[session.state]
  if (!allowed?.has(next)) {
    throw new Error(`Invalid play session transition from ${session.state} to ${next}`)
  }

  if (next === 'playing' && session.presentPlayers.length < 1) {
    throw new Error('Cannot start playing without at least one present player')
  }

  if (next === 'complete' && !canCompletePlaySession(session)) {
    throw new Error('Cannot complete play session without a full session score')
  }

  return { ...session, state: next }
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 */
export function reopenPlaySessionForScoring(session) {
  return transitionPlaySessionState(session, 'scoring')
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 * @param {string} recordedPlayerId
 */
export function dropOutPresentPlayer(session, recordedPlayerId) {
  const presentPlayers = session.presentPlayers.filter((p) => p.recordedPlayerId !== recordedPlayerId)
  let score = session.score
  if (score?.perPlayer && recordedPlayerId in score.perPlayer) {
    const perPlayer = { ...score.perPlayer }
    delete perPlayer[recordedPlayerId]
    score = { ...score, perPlayer }
  }
  if (score?.outcomes && recordedPlayerId in score.outcomes) {
    const outcomes = { ...score.outcomes }
    delete outcomes[recordedPlayerId]
    score = { ...score, outcomes }
  }
  return { ...session, presentPlayers, score }
}
