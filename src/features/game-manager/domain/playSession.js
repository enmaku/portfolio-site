/** @typedef {'setup' | 'playing' | 'scoring' | 'complete'} PlaySessionState */

export const SCORE_ENTRY_MODES = Object.freeze({
  PER_PLAYER: 'per_player',
  SHARED: 'shared',
  OUTCOME_MARKS: 'outcome_marks',
})

const FORWARD = {
  setup: new Set(['playing', 'scoring']),
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
    addToCollection: input.addToCollection !== false,
    timerExport: null,
  }
}

/**
 * @param {ReturnType<typeof createPlaySession>} session
 */
export function canCompletePlaySession(session) {
  if (!session || session.presentPlayers.length < 1) return false
  const score = session.score
  if (!score?.mode) return false

  if (score.mode === SCORE_ENTRY_MODES.PER_PLAYER) {
    const perPlayer = score.perPlayer || {}
    return session.presentPlayers.every(
      (p) => typeof perPlayer[p.recordedPlayerId] === 'number' && Number.isFinite(perPlayer[p.recordedPlayerId]),
    )
  }

  if (score.mode === SCORE_ENTRY_MODES.SHARED) {
    return typeof score.shared === 'number' && Number.isFinite(score.shared)
  }

  if (score.mode === SCORE_ENTRY_MODES.OUTCOME_MARKS) {
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
  return { ...session, score: { ...score } }
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
