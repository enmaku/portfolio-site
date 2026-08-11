import { HOST_PARTICIPANT_ID } from '../core.js'
import { withGuestQuorum } from '../guestDraft.js'

/**
 * Host-only suggest-phase quorum toggles and guest eject/clear.
 *
 * @param {object} deps
 * @param {ReturnType<import('./movieVoteWireState.js').createMovieVoteWireState>} deps.wireState
 * @param {(suffix: string, path: string) => import('firebase/database').DatabaseReference} deps.roomChild
 * @param {(ref: import('firebase/database').DatabaseReference, value: unknown) => Promise<void>} deps.setRtdb
 * @param {(ref: import('firebase/database').DatabaseReference) => Promise<void>} deps.remove
 * @param {() => string | null} deps.getSessionSuffix
 * @param {() => boolean} deps.isHostRole
 * @param {() => string} deps.getSessionPhase
 * @param {() => {
 *   phase: string,
 *   setMyQuorumRequired: (v: boolean) => void,
 *   setReadyToVote: (v: boolean) => void,
 *   removeParticipantFromVote: (pid: string) => void,
 * }} deps.getStore
 * @param {() => void} deps.tryCompileBallot
 * @param {() => void} deps.hostBroadcastState
 * @param {() => Promise<void>} deps.hostBroadcastStatePersist
 * @param {(participantId: string) => void} deps.cancelParticipantRemoval
 */
export function createHostSeatAdmin(deps) {
  const { guestDrafts, stableIdToParticipant, activeGuestStableIds } = deps.wireState

  function canEditSuggestSeats() {
    if (!deps.isHostRole() || deps.getSessionPhase() !== 'hosting') return false
    return deps.getStore().phase === 'suggest'
  }

  /**
   * @param {string} participantId
   * @returns {Promise<void>}
   */
  async function ejectGuestSeat(participantId) {
    const stableId = [...stableIdToParticipant.entries()].find(([, p]) => p === participantId)?.[0]
    guestDrafts.delete(participantId)
    /** @type {Promise<unknown>[]} */
    const persists = []
    if (stableId) {
      stableIdToParticipant.delete(stableId)
      activeGuestStableIds.delete(stableId)
      const suffix = deps.getSessionSuffix()
      if (suffix) {
        persists.push(deps.setRtdb(deps.roomChild(suffix, `kicked/${stableId}`), true))
        persists.push(deps.remove(deps.roomChild(suffix, `welcome/${stableId}`)))
        // Prevent onChildAdded replay of stale hello/draft after host refresh.
        persists.push(deps.remove(deps.roomChild(suffix, `inbox/${stableId}`)))
        persists.push(deps.remove(deps.roomChild(suffix, `guestOnline/${stableId}`)))
      }
    }
    deps.cancelParticipantRemoval(participantId)
    deps.getStore().removeParticipantFromVote(participantId)
    if (persists.length) {
      await Promise.all(persists.map((p) => p.catch(() => {})))
    }
  }

  /**
   * @param {string} participantId
   * @param {boolean} required
   */
  function setParticipantQuorumRequired(participantId, required) {
    if (!canEditSuggestSeats()) return
    const store = deps.getStore()
    const nextRequired = Boolean(required)
    if (participantId === HOST_PARTICIPANT_ID) {
      store.setMyQuorumRequired(nextRequired)
      if (!nextRequired) store.setReadyToVote(false)
    } else {
      const draft = guestDrafts.get(participantId)
      if (!draft) return
      guestDrafts.set(participantId, withGuestQuorum(draft, nextRequired))
    }
    deps.tryCompileBallot()
    deps.hostBroadcastState()
  }

  /**
   * @param {string} participantId
   * @returns {Promise<void>}
   */
  async function removeGuestParticipant(participantId) {
    if (!canEditSuggestSeats()) return
    if (participantId === HOST_PARTICIPANT_ID) return
    await ejectGuestSeat(participantId)
    deps.tryCompileBallot()
    await deps.hostBroadcastStatePersist()
  }

  async function clearGuestParticipants() {
    if (!canEditSuggestSeats()) return
    await Promise.all([...guestDrafts.keys()].map((pid) => ejectGuestSeat(pid)))
    deps.tryCompileBallot()
    await deps.hostBroadcastStatePersist()
  }

  return {
    setParticipantQuorumRequired,
    removeGuestParticipant,
    clearGuestParticipants,
  }
}
