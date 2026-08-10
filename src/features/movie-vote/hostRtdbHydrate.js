import { DEFAULT_VOTING_METHOD } from './votingMethod.js'
import { HOST_PARTICIPANT_ID } from './core.js'
import { normalizeParticipantName } from './participantName.js'

/**
 * Apply RTDB room state to the host store after hydrate (reconnect or fresh claim).
 *
 * @param {{ payload: import('./types.js').MovieVotePublicPayload } | null} parsed
 * @param {{ applyPublicPayload: (p: import('./types.js').MovieVotePublicPayload) => void, votingMethod: string }} store
 */
export function applyHostStoreFromRtdbHydrate(parsed, store) {
  if (parsed) {
    store.applyPublicPayload(parsed.payload)
    return
  }
  store.votingMethod = DEFAULT_VOTING_METHOD
}

/**
 * Guest seats survive host refresh only when still listed in authority state *and*
 * still mapped via welcome (eject may leave one side stale).
 *
 * @param {Array<{ stableId: string, participantId: string }>} welcomeEntries
 * @param {import('./types.js').MovieVoteParticipantSummary[] | undefined} participants
 * @returns {{
 *   keep: Array<{ stableId: string, participantId: string }>,
 *   staleWelcomeStableIds: string[],
 *   keptParticipantIds: Set<string>,
 * }}
 */
export function planGuestHydrateFromRtdb(welcomeEntries, participants) {
  /** @type {Set<string>} */
  const authorityIds = new Set()
  if (Array.isArray(participants)) {
    for (const p of participants) {
      if (p && typeof p.id === 'string' && p.id !== HOST_PARTICIPANT_ID) {
        authorityIds.add(p.id)
      }
    }
  }

  /** @type {Array<{ stableId: string, participantId: string }>} */
  const keep = []
  /** @type {string[]} */
  const staleWelcomeStableIds = []
  /** @type {Set<string>} */
  const keptParticipantIds = new Set()

  for (const entry of welcomeEntries) {
    if (!entry || typeof entry.stableId !== 'string' || typeof entry.participantId !== 'string') {
      continue
    }
    if (authorityIds.has(entry.participantId)) {
      keep.push({ stableId: entry.stableId, participantId: entry.participantId })
      keptParticipantIds.add(entry.participantId)
    } else {
      staleWelcomeStableIds.push(entry.stableId)
    }
  }

  return { keep, staleWelcomeStableIds, keptParticipantIds }
}

/**
 * Restore guest draft name / quorum / ready from the authority participants list
 * after host refresh (welcome hydrate alone leaves empty names).
 * When `allowIds` is set, only those participant ids are seeded (welcome∩state).
 *
 * @param {Map<string, { picks: import('./types.js').MoviePick[], ready: boolean, name?: string, quorumRequired?: boolean }>} guestDrafts
 * @param {import('./types.js').MovieVoteParticipantSummary[] | undefined} participants
 * @param {Set<string>} [allowIds]
 */
export function seedGuestDraftsFromParticipants(guestDrafts, participants, allowIds) {
  if (!Array.isArray(participants)) return
  for (const p of participants) {
    if (!p || typeof p.id !== 'string' || p.id === HOST_PARTICIPANT_ID) continue
    if (allowIds && !allowIds.has(p.id)) continue
    const prev = guestDrafts.get(p.id)
    guestDrafts.set(p.id, {
      picks: prev?.picks ?? [],
      ready: Boolean(p.ready),
      name: typeof p.name === 'string' ? p.name : (prev?.name ?? ''),
      quorumRequired: p.quorumRequired !== false,
    })
  }
  if (allowIds) {
    for (const id of [...guestDrafts.keys()]) {
      if (!allowIds.has(id)) guestDrafts.delete(id)
    }
  }
}

/**
 * Empty-name guest seats are an error state — drop them and their stableId mappings.
 *
 * @param {Map<string, { picks: import('./types.js').MoviePick[], ready: boolean, name?: string, quorumRequired?: boolean }>} guestDrafts
 * @param {Map<string, string>} [stableIdToParticipant]
 */
export function pruneNamelessGuestDrafts(guestDrafts, stableIdToParticipant) {
  for (const [pid, g] of [...guestDrafts.entries()]) {
    if (normalizeParticipantName(g?.name ?? '')) continue
    guestDrafts.delete(pid)
    if (!stableIdToParticipant) continue
    for (const [stableId, mapped] of [...stableIdToParticipant.entries()]) {
      if (mapped === pid) stableIdToParticipant.delete(stableId)
    }
  }
}

/**
 * @param {import('./types.js').MovieVoteParticipantSummary[] | undefined} participants
 * @returns {{ name: string, quorumRequired: boolean } | null}
 */
export function hostSeatMetaFromParticipants(participants) {
  if (!Array.isArray(participants)) return null
  const host = participants.find((p) => p && p.id === HOST_PARTICIPANT_ID)
  if (!host) return null
  return {
    name: typeof host.name === 'string' ? host.name : '',
    quorumRequired: host.quorumRequired !== false,
  }
}
