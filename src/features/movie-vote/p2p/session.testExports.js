/**
 * Test-only helpers for Movie Vote session facade contract tests.
 * Import from tests only — not from production code.
 */

/**
 * @param {{ getMovieVoteSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getMovieVoteSessionTestWireAccess> }} sessionMod
 * @returns {void}
 */
export function bumpMovieVoteReconnectGenerationForTests(sessionMod) {
  sessionMod.getMovieVoteSessionTestWireAccess().core.bumpReconnectGeneration()
}

/**
 * @param {{ getMovieVoteSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getMovieVoteSessionTestWireAccess> }} sessionMod
 * @returns {void}
 */
export function resetMovieVoteFacadeWireStateForTests(sessionMod) {
  const access = sessionMod.getMovieVoteSessionTestWireAccess()
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
 * @param {{ getMovieVoteSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getMovieVoteSessionTestWireAccess> }} sessionMod
 * @returns {void}
 */
export function resetHostStateBroadcastProbeForTests(sessionMod) {
  sessionMod.getMovieVoteSessionTestWireAccess().setHostStateBroadcastProbe(0)
}

/**
 * @param {{ getMovieVoteSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getMovieVoteSessionTestWireAccess> }} sessionMod
 * @returns {number}
 */
export function drainHostStateBroadcastProbeForTests(sessionMod) {
  const access = sessionMod.getMovieVoteSessionTestWireAccess()
  const n = access.getHostStateBroadcastProbe()
  access.setHostStateBroadcastProbe(0)
  return n
}

/**
 * @param {{ getMovieVoteSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getMovieVoteSessionTestWireAccess> }} sessionMod
 * @param {string} participantId
 * @param {{ picks: import('../types.js').MoviePick[], ready: boolean }} entry
 * @returns {void}
 */
export function setGuestDraftForTests(sessionMod, participantId, entry) {
  sessionMod.getMovieVoteSessionTestWireAccess().seedGuestDraft(participantId, entry)
}

/**
 * @param {{ getMovieVoteSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getMovieVoteSessionTestWireAccess> }} sessionMod
 * @param {string} participantId
 * @returns {boolean | undefined}
 */
export function getGuestDraftReadyForTests(sessionMod, participantId) {
  return sessionMod.getMovieVoteSessionTestWireAccess().getGuestDraftReady(participantId)
}
