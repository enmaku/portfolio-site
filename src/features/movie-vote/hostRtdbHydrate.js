import { DEFAULT_VOTING_METHOD } from './votingMethod.js'
import { HOST_PARTICIPANT_ID } from './core.js'
import { createGuestDraft, isQuorumRequired } from './guestDraft.js'
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
 * @param {Map<string, import('./types.js').MovieVoteGuestDraft>} guestDrafts
 * @param {import('./types.js').MovieVoteParticipantSummary[] | undefined} participants
 * @param {Set<string>} [allowIds]
 */
export function seedGuestDraftsFromParticipants(guestDrafts, participants, allowIds) {
  if (!Array.isArray(participants)) return
  for (const p of participants) {
    if (!p || typeof p.id !== 'string' || p.id === HOST_PARTICIPANT_ID) continue
    if (allowIds && !allowIds.has(p.id)) continue
    const prev = guestDrafts.get(p.id)
    guestDrafts.set(
      p.id,
      createGuestDraft({
        picks: prev?.picks ?? [],
        ready: Boolean(p.ready),
        name: typeof p.name === 'string' ? p.name : (prev?.name ?? ''),
        quorumRequired: p.quorumRequired !== false,
      }),
    )
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
 * @param {Map<string, import('./types.js').MovieVoteGuestDraft>} guestDrafts
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
    quorumRequired: isQuorumRequired(host),
  }
}

/**
 * Restore host wire maps + store seat meta from RTDB after reconnect / claim.
 *
 * @param {string} suffix
 * @param {{
 *   get: (ref: import('firebase/database').DatabaseReference) => Promise<{ val: () => unknown }>,
 *   remove: (ref: import('firebase/database').DatabaseReference) => Promise<unknown>,
 *   roomChild: (suffix: string, path: string) => import('firebase/database').DatabaseReference,
 *   parseState: (raw: unknown) => { seq: number, payload: import('./types.js').MovieVotePublicPayload } | null,
 *   parseWelcome: (raw: unknown) => { participantId: string } | null,
 *   wireState: {
 *     stableIdToParticipant: Map<string, string>,
 *     activeGuestStableIds: Set<string>,
 *     guestDrafts: Map<string, import('./types.js').MovieVoteGuestDraft>,
 *   },
 *   applyPublicPayload: (p: import('./types.js').MovieVotePublicPayload) => void,
 *   getVotingMethod: () => string,
 *   applyHostSeatMeta: (meta: { name: string, quorumRequired: boolean }) => void,
 * }} deps
 * @returns {Promise<{ nextSeq: number | null }>}
 */
export async function hydrateHostWireFromRtdb(suffix, deps) {
  const {
    stableIdToParticipant,
    activeGuestStableIds,
    guestDrafts,
  } = deps.wireState

  const stateSnap = await deps.get(deps.roomChild(suffix, 'state'))
  const parsed = deps.parseState(stateSnap.val())
  /** @type {number | null} */
  let nextSeq = null
  if (parsed) {
    nextSeq = parsed.seq
  }
  try {
    applyHostStoreFromRtdbHydrate(parsed, {
      applyPublicPayload: deps.applyPublicPayload,
      votingMethod: deps.getVotingMethod(),
    })
    const hostMeta = hostSeatMetaFromParticipants(parsed?.payload?.participants)
    if (hostMeta) deps.applyHostSeatMeta(hostMeta)
  } catch {
    void 0
  }

  const welcomeSnap = await deps.get(deps.roomChild(suffix, 'welcome'))
  const welcomes = welcomeSnap.val()
  /** @type {Array<{ stableId: string, participantId: string }>} */
  const welcomeEntries = []
  if (welcomes && typeof welcomes === 'object') {
    for (const [stableId, raw] of Object.entries(welcomes)) {
      if (typeof stableId !== 'string') continue
      const welcome = deps.parseWelcome(raw)
      if (!welcome) continue
      welcomeEntries.push({ stableId, participantId: welcome.participantId })
    }
  }

  const planned = planGuestHydrateFromRtdb(welcomeEntries, parsed?.payload?.participants)
  for (const staleStableId of planned.staleWelcomeStableIds) {
    deps.remove(deps.roomChild(suffix, `welcome/${staleStableId}`)).catch(() => {})
  }
  for (const { stableId, participantId } of planned.keep) {
    stableIdToParticipant.set(stableId, participantId)
    if (!guestDrafts.has(participantId)) {
      guestDrafts.set(participantId, createGuestDraft())
    }
  }

  seedGuestDraftsFromParticipants(
    guestDrafts,
    parsed?.payload?.participants,
    planned.keptParticipantIds,
  )
  pruneNamelessGuestDrafts(guestDrafts, stableIdToParticipant)

  const onlineSnap = await deps.get(deps.roomChild(suffix, 'guestOnline'))
  const online = onlineSnap.val()
  if (online && typeof online === 'object') {
    for (const [stableId, isOnline] of Object.entries(online)) {
      if (isOnline === true && stableIdToParticipant.has(stableId)) {
        activeGuestStableIds.add(stableId)
      }
    }
  }

  return { nextSeq }
}
