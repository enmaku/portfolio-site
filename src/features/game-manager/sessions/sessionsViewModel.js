import {
  SCORE_ENTRY_MODES,
  addPresentPlayer,
  attachTimerExport,
  canCompletePlaySession,
  createPlaySession,
  dropOutPresentPlayer,
  normalizeScoreEntryMode,
  setPlaySessionScore,
  setPresentPlayers,
  transitionPlaySessionState,
} from '../domain/playSession.js'

export { SCORE_ENTRY_MODES, canCompletePlaySession, normalizeScoreEntryMode }

/**
 * @param {{ id: string, game: object, presentPlayers?: object[] }} input
 */
export function startPlaySessionDraft(input) {
  return createPlaySession(input)
}

/**
 * @param {object} session
 * @param {string} nextState
 */
export function movePlaySession(session, nextState) {
  return transitionPlaySessionState(session, nextState)
}

/**
 * @param {object} session
 * @param {unknown} timerExport
 * @param {{ newId?: () => string }} [options]
 */
export function applyTimerExport(session, timerExport, options) {
  return attachTimerExport(session, timerExport, options)
}

/**
 * @param {object} session
 * @param {object} score
 */
export function writePlaySessionScore(session, score) {
  return setPlaySessionScore(session, score)
}

/**
 * @param {object} session
 * @param {object[]} presentPlayers
 */
export function replacePresentPlayers(session, presentPlayers) {
  return setPresentPlayers(session, presentPlayers)
}

/**
 * @param {object} session
 * @param {{ recordedPlayerId: string, name: string, color: string }} player
 */
export function includePresentPlayer(session, player) {
  return addPresentPlayer(session, player)
}

/**
 * @param {object} session
 * @param {string} recordedPlayerId
 */
export function dropPresentPlayer(session, recordedPlayerId) {
  return dropOutPresentPlayer(session, recordedPlayerId)
}

/**
 * Map a collection shelf item to the play session game reference.
 * @param {object} item
 */
export function gameRefFromCollectionItem(item) {
  if (!item) return null
  if (item.kind === 'catalog') {
    return {
      kind: 'catalog',
      catalogEntryId: item.catalogEntryId,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl ?? null,
      imageUrl: item.imageUrl ?? null,
      minPlayers: item.minPlayers ?? null,
      maxPlayers: item.maxPlayers ?? null,
      playingTime: item.playingTime ?? null,
      yearPublished: item.yearPublished ?? null,
    }
  }
  if (item.kind === 'custom') {
    return {
      kind: 'custom',
      id: item.id,
      title: item.title,
    }
  }
  return null
}
