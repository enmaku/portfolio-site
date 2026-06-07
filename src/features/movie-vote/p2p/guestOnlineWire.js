const GUEST_REMOVAL_GRACE_MS = 45_000

/**
 * @param {object} deps
 * @param {ReturnType<import('./movieVoteWireState.js').createMovieVoteWireState>} deps.wireState
 * @param {(suffix: string, path: string) => import('firebase/database').DatabaseReference} deps.roomChild
 * @param {(ref: import('firebase/database').DatabaseReference, value: unknown) => Promise<void>} deps.setRtdb
 * @param {(ref: import('firebase/database').DatabaseReference) => import('firebase/database').OnDisconnect} deps.onDisconnect
 * @param {typeof onChildAdded} deps.onChildAdded
 * @param {typeof onValue} deps.onValue
 * @param {(unsub: () => void) => void} deps.trackFeatureUnsub
 * @param {() => boolean} deps.isHostRole
 * @param {() => string} deps.getSessionPhase
 * @param {() => void} deps.tryCompileBallot
 * @param {() => void} deps.tryFinishVoting
 * @param {() => void} deps.hostBroadcastState
 * @param {(participantId: string) => void} deps.removeParticipantFromVote
 * @param {(fn: () => void, ms: number) => ReturnType<typeof setTimeout>} [deps.scheduleTimer]
 * @param {(id: ReturnType<typeof setTimeout>) => void} [deps.cancelTimer]
 */
export function createGuestOnlineWire(deps) {
  const { wireState } = deps
  const {
    stableIdToParticipant,
    activeGuestStableIds,
    guestDrafts,
    pendingRemovalTimers,
  } = wireState
  const scheduleTimer = deps.scheduleTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const cancelTimer = deps.cancelTimer ?? ((id) => clearTimeout(id))
  /**
   * @param {string} suffix
   * @param {string} stableId
   */
  async function markGuestOnline(suffix, stableId) {
    const onlineRef = deps.roomChild(suffix, `guestOnline/${stableId}`)
    await deps.setRtdb(onlineRef, true)
    deps.onDisconnect(onlineRef).set(false)
  }

  /**
   * @param {string} suffix
   * @param {string} stableId
   */
  async function markGuestOffline(suffix, stableId) {
    await deps.setRtdb(deps.roomChild(suffix, `guestOnline/${stableId}`), false).catch(() => {})
  }

  function scheduleParticipantRemoval(pid) {
    if (!guestDrafts.has(pid)) return
    const stableId = [...stableIdToParticipant.entries()].find(([, p]) => p === pid)?.[0]
    if (stableId && activeGuestStableIds.has(stableId)) return
    const existing = pendingRemovalTimers.get(pid)
    if (existing) cancelTimer(existing)
    const t = scheduleTimer(() => {
      pendingRemovalTimers.delete(pid)
      if (stableId && activeGuestStableIds.has(stableId)) return
      guestDrafts.delete(pid)
      if (stableId) {
        stableIdToParticipant.delete(stableId)
        activeGuestStableIds.delete(stableId)
      }
      if (deps.isHostRole() && deps.getSessionPhase() === 'hosting') {
        deps.removeParticipantFromVote(pid)
        deps.tryCompileBallot()
        deps.tryFinishVoting()
        deps.hostBroadcastState()
      }
    }, GUEST_REMOVAL_GRACE_MS)
    pendingRemovalTimers.set(pid, t)
  }

  /**
   * @param {string} pid
   */
  function cancelParticipantRemoval(pid) {
    const t = pendingRemovalTimers.get(pid)
    if (t) {
      cancelTimer(t)
      pendingRemovalTimers.delete(pid)
    }
  }

  /**
   * @param {string} suffix
   */
  function wireHostGuestOnline(suffix) {
    const guestOnlineRef = deps.roomChild(suffix, 'guestOnline')
    deps.trackFeatureUnsub(
      deps.onChildAdded(guestOnlineRef, (snap) => {
        const stableId = snap.key
        if (!stableId) return
        const onlineRef = snap.ref
        deps.trackFeatureUnsub(
          deps.onValue(onlineRef, (onlineSnap) => {
            const pid = stableIdToParticipant.get(stableId)
            if (!pid) return
            if (onlineSnap.val() === true) {
              activeGuestStableIds.add(stableId)
              cancelParticipantRemoval(pid)
            } else {
              activeGuestStableIds.delete(stableId)
              if (!activeGuestStableIds.has(stableId)) scheduleParticipantRemoval(pid)
            }
          }),
        )
      }),
    )
  }

  return {
    markGuestOnline,
    markGuestOffline,
    wireHostGuestOnline,
    scheduleParticipantRemoval,
    cancelParticipantRemoval,
  }
}
