/**
 * Test-only helpers for Movie Vote session facade contract tests.
 * Import from tests only — not from production code.
 */

import { getMovieVoteSessionTestWireAccess } from './session.testWireAccess.js'

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {ReturnType<typeof getMovieVoteSessionTestWireAccess>}
 */
function wireAccess(sessionMod) {
  return /** @type {ReturnType<typeof getMovieVoteSessionTestWireAccess>} */ (
    getMovieVoteSessionTestWireAccess(sessionMod.MOVIE_VOTE_SESSION_TEST_MODULE_KEY)
  )
}

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {void}
 */
export function bumpMovieVoteReconnectGenerationForTests(sessionMod) {
  wireAccess(sessionMod).core.bumpReconnectGeneration()
}

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {void}
 */
export function resetMovieVoteFacadeWireStateForTests(sessionMod) {
  const access = wireAccess(sessionMod)
  access.remoteHostTabVisible.value = true
  access.clearFeatureWireUnsubs()
  access.resetMovieVoteWireState()
  access.setNextSeq(0)
  access.setHostStateBroadcastProbe(0)
  access.core.destroyWireOnly()
  access.core.setPhase('idle')
  access.core.setSuffix(null)
  access.setHandlers(access.emptyHandlers())
}

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {void}
 */
export function resetHostStateBroadcastProbeForTests(sessionMod) {
  wireAccess(sessionMod).setHostStateBroadcastProbe(0)
}

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {number}
 */
export function drainHostStateBroadcastProbeForTests(sessionMod) {
  const access = wireAccess(sessionMod)
  const n = access.getHostStateBroadcastProbe()
  access.setHostStateBroadcastProbe(0)
  return n
}

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @param {string} participantId
 * @param {{ picks: import('../types.js').MoviePick[], ready: boolean }} entry
 * @returns {void}
 */
export function setGuestDraftForTests(sessionMod, participantId, entry) {
  wireAccess(sessionMod).seedGuestDraft(participantId, entry)
}

/**
 * @param {{ MOVIE_VOTE_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @param {string} participantId
 * @returns {boolean | undefined}
 */
export function getGuestDraftReadyForTests(sessionMod, participantId) {
  return wireAccess(sessionMod).getGuestDraftReady(participantId)
}
