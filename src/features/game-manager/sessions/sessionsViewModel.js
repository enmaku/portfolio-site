import {
  SCORE_ENTRY_MODES,
  canCompletePlaySession,
  createPlaySession,
  dropOutPresentPlayer,
  setPlaySessionScore,
  transitionPlaySessionState,
} from '../domain/playSession.js'
import { applyCatalogPickToCollection } from '../collection/collectionViewModel.js'
import { collectionHasCatalogEntry } from '../domain/collection.js'

export { SCORE_ENTRY_MODES, canCompletePlaySession }

/**
 * @param {{ id: string, game: object, presentPlayers?: object[], addToCollection?: boolean }} input
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
 * @param {object} score
 */
export function writePlaySessionScore(session, score) {
  return setPlaySessionScore(session, score)
}

/**
 * @param {object} session
 * @param {string} recordedPlayerId
 */
export function dropPresentPlayer(session, recordedPlayerId) {
  return dropOutPresentPlayer(session, recordedPlayerId)
}

/**
 * @param {object[]} collectionItems
 * @param {object} session
 */
export function maybeAddSessionGameToCollection(collectionItems, session) {
  if (!session.addToCollection) {
    return { items: collectionItems, changed: false }
  }
  const game = session.game
  if (!game) return { items: collectionItems, changed: false }
  if (game.kind === 'catalog') {
    if (collectionHasCatalogEntry(collectionItems, game.catalogEntryId)) {
      return { items: collectionItems, changed: false }
    }
    const { items } = applyCatalogPickToCollection(collectionItems, {
      catalogEntryId: game.catalogEntryId,
      title: game.title,
      thumbnailUrl: game.thumbnailUrl,
      imageUrl: game.imageUrl,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      playingTime: game.playingTime,
    })
    return { items, changed: true }
  }
  if (game.kind === 'custom') {
    if (collectionItems.some((i) => i.kind === 'custom' && i.id === game.id)) {
      return { items: collectionItems, changed: false }
    }
    return { items: [...collectionItems, game], changed: true }
  }
  return { items: collectionItems, changed: false }
}
