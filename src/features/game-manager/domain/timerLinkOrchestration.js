/**
 * Pure decisions for Game Manager ↔ Game Timer link binding.
 */

export const GM_SESSION_QUERY_KEY = 'gmSession'
export const GM_CONTINUE_QUERY_KEY = 'gmContinue'

/**
 * @param {{ active?: boolean, playSessionId?: string | null } | null | undefined} existing
 * @param {string} playSessionId
 * @returns {'begin' | 'resume' | 'takeover'}
 */
export function resolveLinkEntryKind(existing, playSessionId) {
  if (!existing?.active || !existing.playSessionId) return 'begin'
  if (existing.playSessionId === playSessionId) return 'resume'
  return 'takeover'
}

/**
 * @param {'begin' | 'resume' | 'takeover'} kind
 */
export function shouldApplyLaunchSeats(kind) {
  return kind === 'begin' || kind === 'takeover'
}

/**
 * @param {{ isHosting: boolean }} input
 */
export function shouldEndRoomOnTakeover(input) {
  return Boolean(input?.isHosting)
}

/**
 * @param {'local' | 'host' | string | null | undefined} lastSyncPosture
 */
export function shouldAutoHost(lastSyncPosture) {
  return lastSyncPosture === 'host'
}

/**
 * @param {{ playSessionId: string }} input
 * @returns {{ path: string, query: Record<string, string> }}
 */
export function buildGameTimerLinkedRoute({ playSessionId }) {
  return {
    path: '/projects/game-timer',
    query: {
      [GM_SESSION_QUERY_KEY]: playSessionId,
    },
  }
}

/**
 * @param {{ playSessionId: string }} input
 * @returns {{ path: string, query: Record<string, string> }}
 */
export function buildGameManagerScoringRoute({ playSessionId }) {
  return {
    path: '/projects/game-manager',
    query: {
      [GM_CONTINUE_QUERY_KEY]: playSessionId,
    },
  }
}
