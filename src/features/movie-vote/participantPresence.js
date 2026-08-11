import { HOST_PARTICIPANT_ID } from './core.js'

/**
 * Stamp per-seat online flags for host authority broadcast.
 *
 * @param {import('./types.js').MovieVotePublicPayload} payload
 * @param {{
 *   hostParticipantId?: string,
 *   stableIdToParticipant: Map<string, string>,
 *   activeGuestStableIds: Set<string>,
 * }} opts
 * @returns {import('./types.js').MovieVotePublicPayload}
 */
export function withParticipantPresence(payload, opts) {
  const hostId = opts.hostParticipantId ?? HOST_PARTICIPANT_ID
  /** @type {Map<string, string>} */
  const participantIdToStableId = new Map()
  for (const [stableId, pid] of opts.stableIdToParticipant) {
    participantIdToStableId.set(pid, stableId)
  }
  return {
    ...payload,
    participants: (payload.participants ?? []).map((p) => {
      if (p.id === hostId) return { ...p, online: true }
      const stableId = participantIdToStableId.get(p.id)
      return {
        ...p,
        online: Boolean(stableId && opts.activeGuestStableIds.has(stableId)),
      }
    }),
  }
}
