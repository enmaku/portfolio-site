import {
  encodeWelcome,
  encodeNameRejected,
  parseDraft,
  parseHello,
  parseVote,
  encodeHostVisibility,
} from './protocol.js'
import { generateAnonymousVoterId } from './roomId.js'
import { normalizeCustomTitle, HOST_PARTICIPANT_ID } from '../core.js'
import { createGuestDraft } from '../guestDraft.js'
import {
  isParticipantNameTaken,
  normalizeParticipantName,
} from '../participantName.js'

/**
 * @param {import('../types.js').MoviePick[]} picks
 */
function normalizePicks(picks) {
  const out = []
  for (const p of picks) {
    if (!p || typeof p.localId !== 'string' || typeof p.title !== 'string') continue
    const title = p.title.trim()
    if (!title) continue

    const explicitSource = p.source === 'tmdb' || p.source === 'custom' ? p.source : null
    const source = explicitSource ?? (typeof p.tmdbId === 'number' ? 'tmdb' : 'custom')

    if (source === 'tmdb' && typeof p.tmdbId !== 'number') continue

    out.push({
      localId: p.localId,
      source,
      tmdbId: source === 'tmdb' ? p.tmdbId : null,
      customKey: source === 'custom' ? (p.customKey || normalizeCustomTitle(title)) : undefined,
      title,
      posterPath: p.posterPath ?? null,
      overview: typeof p.overview === 'string' ? p.overview : '',
      releaseDate: p.releaseDate,
      runtime: typeof p.runtime === 'number' && p.runtime > 0 ? p.runtime : undefined,
    })
  }
  return out
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./movieVoteWireState.js').createMovieVoteWireState>} deps.wireState
 * @param {(suffix: string, path: string) => import('firebase/database').DatabaseReference} deps.roomChild
 * @param {(ref: import('firebase/database').DatabaseReference, value: unknown) => Promise<void>} deps.setRtdb
 * @param {() => string | null} deps.getSessionSuffix
 * @param {() => void} deps.hostBroadcastState
 * @param {() => Promise<void>} deps.hostBroadcastStatePersist
 * @param {() => void} deps.tryFinishVoting
 * @param {(pid: string) => void} deps.cancelParticipantRemoval
 * @param {(participantId: string, entry: { picks: import('../types.js').MoviePick[], ready: boolean }) => void} deps.applyGuestDraft Inbox may author picks/ready only
 * @param {(participantId: string, ranking: string[]) => boolean} deps.applyGuestVote
 * @param {() => string} deps.getHostParticipantName
 * @param {(stableId: string) => void} deps.clearGuestKick
 */
export function createHostInboxWire(deps) {
  const {
    stableIdToParticipant,
    activeGuestStableIds,
    guestDrafts,
  } = deps.wireState

  function seatsForNameCheck() {
    /** @type {{ id: string, name: string }[]} */
    const seats = [{ id: HOST_PARTICIPANT_ID, name: deps.getHostParticipantName() }]
    for (const [pid, g] of guestDrafts) {
      seats.push({ id: pid, name: typeof g.name === 'string' ? g.name : '' })
    }
    return seats
  }

  /**
   * @param {string} suffix
   */
  function publishHostVisible(suffix) {
    if (typeof document === 'undefined') return
    deps
      .setRtdb(
        deps.roomChild(suffix, 'hostVisible'),
        encodeHostVisibility(document.visibilityState === 'visible'),
      )
      .catch(() => {})
  }

  /**
   * @param {string} stableId
   * @param {unknown} raw
   * @returns {string | null}
   */
  function bindStableIdFromGuestPayload(stableId, raw) {
    const existing = stableIdToParticipant.get(stableId)
    if (existing) return existing

    const draft = parseDraft(raw)
    const pid = draft?.participantId ?? parseVote(raw)?.participantId
    if (!pid) return null
    // Only hello may allocate seats. Orphan inbox drafts after eject/refresh must not
    // mint empty-name guests.
    if (!guestDrafts.has(pid)) return null

    stableIdToParticipant.set(stableId, pid)
    deps.cancelParticipantRemoval(pid)
    return pid
  }

  /**
   * @param {string} stableId
   * @param {string} [participantName]
   */
  async function onGuestHello(stableId, participantName = '') {
    const existingPid = stableIdToParticipant.get(stableId)
    const suffix = deps.getSessionSuffix()
    if (!suffix) return

    const welcomeRef = deps.roomChild(suffix, `welcome/${stableId}`)
    // Allow rejoin after host eject — clear residual kick marker before welcoming.
    deps.clearGuestKick(stableId)

    if (existingPid) {
      deps.cancelParticipantRemoval(existingPid)
      activeGuestStableIds.add(stableId)
      deps.setRtdb(welcomeRef, encodeWelcome(existingPid, true)).catch(() => {})
      publishHostVisible(suffix)
      await deps.hostBroadcastStatePersist()
      return
    }

    const name = normalizeParticipantName(participantName)
    if (!name) return
    if (isParticipantNameTaken(name, seatsForNameCheck())) {
      deps.setRtdb(welcomeRef, encodeNameRejected('taken')).catch(() => {})
      return
    }

    const pid = generateAnonymousVoterId()
    stableIdToParticipant.set(stableId, pid)
    guestDrafts.set(pid, createGuestDraft({ name, quorumRequired: true }))
    activeGuestStableIds.add(stableId)

    deps.setRtdb(welcomeRef, encodeWelcome(pid, false)).catch(() => {})
    publishHostVisible(suffix)
    await deps.hostBroadcastStatePersist()
  }

  /**
   * @param {string} stableId
   * @param {unknown} raw
   */
  function handleHostInboxMessage(stableId, raw) {
    const hello = parseHello(raw)
    if (hello) {
      if (hello.stableId !== stableId) return
      void onGuestHello(stableId, hello.participantName)
      return
    }

    const expectedPid = bindStableIdFromGuestPayload(stableId, raw)
    if (!expectedPid) return

    const draft = parseDraft(raw)
    if (draft) {
      if (draft.participantId !== expectedPid) return
      deps.applyGuestDraft(expectedPid, {
        picks: normalizePicks(draft.picks),
        ready: draft.ready,
      })
      return
    }

    const vote = parseVote(raw)
    if (vote) {
      if (vote.participantId !== expectedPid) return
      if (deps.applyGuestVote(expectedPid, vote.ranking)) {
        deps.hostBroadcastState()
        deps.tryFinishVoting()
      }
    }
  }

  return { handleHostInboxMessage, onGuestHello }
}
