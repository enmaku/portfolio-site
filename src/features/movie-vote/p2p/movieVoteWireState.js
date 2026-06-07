/**
 * Per-session host-side guest wire bookkeeping for Movie Vote P2P.
 */

export function createMovieVoteWireState() {
  /** @type {Map<string, string>} */
  const stableIdToParticipant = new Map()

  /** @type {Set<string>} */
  const activeGuestStableIds = new Set()

  /** @type {Map<string, { picks: import('../types.js').MoviePick[], ready: boolean }>} */
  const guestDrafts = new Map()

  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const pendingRemovalTimers = new Map()

  function resetMaps() {
    stableIdToParticipant.clear()
    activeGuestStableIds.clear()
    guestDrafts.clear()
    for (const t of pendingRemovalTimers.values()) clearTimeout(t)
    pendingRemovalTimers.clear()
  }

  /**
   * @param {string} participantId
   * @param {{ picks: import('../types.js').MoviePick[], ready: boolean }} entry
   */
  function seedGuestDraft(participantId, entry) {
    guestDrafts.set(participantId, entry)
  }

  /**
   * @param {string} participantId
   * @returns {boolean | undefined}
   */
  function getGuestDraftReady(participantId) {
    return guestDrafts.get(participantId)?.ready
  }

  function onlineGuestParticipantIds() {
    /** @type {string[]} */
    const out = []
    for (const [stableId, pid] of stableIdToParticipant) {
      if (activeGuestStableIds.has(stableId)) out.push(pid)
    }
    return out
  }

  return {
    stableIdToParticipant,
    activeGuestStableIds,
    guestDrafts,
    pendingRemovalTimers,
    resetMaps,
    seedGuestDraft,
    getGuestDraftReady,
    onlineGuestParticipantIds,
  }
}
