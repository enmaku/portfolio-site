/**
 * @import '../types.js'
 * PeerJS star hub for Movie Vote (`dperry-movievote-<suffix>`).
 * Typed messages; host aggregates guest drafts and runs IRV.
 */

import { ref } from 'vue'
import { Notify } from 'quasar'
import Peer from 'peerjs'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { HOST_PARTICIPANT_ID, compileBallotMovies, uniqueTmdbCountInPicks } from '../core.js'
import { runIrv } from '../irv.js'
import { classifyPeerError, isUnavailableIdError } from '../../p2p/errors.js'
import { deriveStableHostSuffix, getStableClientId } from '../../p2p/identity.js'
import { reconnectDelayMs as sharedReconnectDelayMs } from '../../p2p/reconnect.js'
import {
  encodeDraft,
  encodeHello,
  encodeHostPing,
  encodeHostVisibility,
  encodeState,
  encodeVote,
  encodeWelcome,
  isHostEndedNotice,
  isHostPing,
  MSG_MV_HOST_ENDED,
  parseDraft,
  parseHello,
  parseHostVisibility,
  parseState,
  parseVote,
  parseWelcome,
} from './protocol.js'
import {
  fullPeerIdFromSuffix,
  generateAnonymousVoterId,
  generateRoomSuffix,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from './roomId.js'

const STABLE_HOST_SUFFIX_APP = 'movievote'

/** @type {import('peerjs').Peer | null} */
let peer = null

/** @type {Set<import('peerjs').DataConnection>} */
const hubConnections = new Set()

/** @type {import('peerjs').DataConnection | null} */
let guestHubConn = null

let isHost = false

let nextSeq = 0

let lastSeenSeq = 0

let reconnectGeneration = 0

/** @type {Map<import('peerjs').DataConnection, string>} */
const connToParticipant = new Map()

/**
 * Stable client id → participant id.
 *
 * Populated when a guest sends a `hello` message after their `DataConnection`
 * opens, and kept across that guest's reconnects so their existing slot (and
 * any vote they've already cast) is preserved. Entries are cleared only when
 * the host session tears down.
 * @type {Map<string, string>}
 */
const stableIdToParticipant = new Map()

/**
 * Participant id → open DataConnection currently serving that participant.
 * Used to close an orphan connection when the same stable id reconnects.
 * @type {Map<string, import('peerjs').DataConnection>}
 */
const participantToConn = new Map()

/**
 * Guest drafts keyed by participant id (host tab uses store only).
 * @type {Map<string, { picks: import('../types.js').MoviePick[], ready: boolean }>}
 */
const guestDrafts = new Map()

/**
 * Pending participant-removal timers keyed by participant id. Scheduled when a
 * guest's connection closes; cleared when they reconnect within the grace
 * window. See {@link GUEST_REMOVAL_GRACE_MS}.
 * @type {Map<string, ReturnType<typeof setTimeout>>}
 */
const pendingRemovalTimers = new Map()

/** Reactive session UI state for multiplayer (Vue ref; safe to use outside components). */
export const sessionPhase = ref(/** @type {import('./types.js').MovieVoteSessionPhase} */ ('idle'))

/** Short user-facing room code while hosting or connected as guest; null when idle. */
export const sessionSuffix = ref(/** @type {string | null} */ (null))

/**
 * Guest only: last host-reported tab visibility (`document.visibilityState === 'visible'` on host).
 * Stays `true` when idle / hosting / unknown.
 */
export const remoteHostTabVisible = ref(true)

const RECONNECT_MAX_ATTEMPTS = 10
const RECONNECT_BASE_DELAY_MS = 800
const RECONNECT_MAX_DELAY_MS = 5000
const RECONNECT_INITIAL_PAUSE_MS = 1000

const PEER_OPTS = /** @type {const} */ ({
  serialization: 'json',
  reliable: true,
})

const OPEN_PEER_TIMEOUT_MS = 20000
const RECONNECT_PEER_TIMEOUT_MS = 8000
const HEARTBEAT_INTERVAL_MS = 3000
const HEARTBEAT_STALE_MS = 12_000
const HEARTBEAT_GUEST_CHECK_MS = 2000

/**
 * When a guest's `DataConnection` closes, keep their participant slot (drafts,
 * votes, ready flag) around for this long so that a quick reconnect can reuse
 * it. Long enough for brief wifi/bluetooth glitches, short enough that a
 * truly-departed voter doesn't block a room from advancing to the next phase.
 */
const GUEST_REMOVAL_GRACE_MS = 45_000

/** Minimum distinct TMDB titles across the room before anyone can mark ready (matches ballot dedupe). */
const MIN_DISTINCT_SUGGESTIONS_FOR_READY = 2

/** @type {ReturnType<typeof setInterval> | null} */
let hostHeartbeatIntervalId = null

/** @type {ReturnType<typeof setInterval> | null} */
let guestHostWatchIntervalId = null

/** @type {(() => void) | null} */
let hostVisibilityTeardown = null

/** @type {number} */
let guestLastHostActivityAt = 0

/**
 * @param {string} message
 * @param {'positive' | 'negative' | 'warning' | 'info'} [type='info']
 * @param {{ timeout?: number, classes?: string }} [opts]
 * @returns {void}
 */
function notifyP2P(message, type = 'info', opts = {}) {
  const fallback = type === 'negative' ? 4500 : 2800
  const timeout = typeof opts.timeout === 'number' ? opts.timeout : fallback
  const classes = opts.classes ? `mv-notify ${opts.classes}` : 'mv-notify'
  try {
    Notify.create({
      message,
      type,
      position: 'top',
      timeout,
      classes,
    })
  } catch {
    void 0
  }
}

/** Clears persisted host/guest intent from the room session Pinia store. */
function clearRoomPersistence() {
  try {
    useMovieVoteRoomSessionStore().clear()
  } catch {
    void 0
  }
}

function clearHeartbeatAndWatch() {
  if (hostHeartbeatIntervalId !== null) {
    clearInterval(hostHeartbeatIntervalId)
    hostHeartbeatIntervalId = null
  }
  if (guestHostWatchIntervalId !== null) {
    clearInterval(guestHostWatchIntervalId)
    guestHostWatchIntervalId = null
  }
  if (hostVisibilityTeardown) {
    hostVisibilityTeardown()
    hostVisibilityTeardown = null
  }
}

function sendHostHeartbeats() {
  if (!isHost || !peer || peer.destroyed) return
  const msg = encodeHostPing()
  for (const c of hubConnections) {
    if (!c.open) continue
    try {
      c.send(msg)
    } catch {
      void 0
    }
  }
}

function broadcastHostVisibility(visible) {
  if (!isHost || !peer || peer.destroyed) return
  const msg = encodeHostVisibility(visible)
  for (const c of hubConnections) {
    if (!c.open) continue
    try {
      c.send(msg)
    } catch {
      void 0
    }
  }
}

function startHostHeartbeats() {
  if (hostHeartbeatIntervalId !== null) {
    clearInterval(hostHeartbeatIntervalId)
    hostHeartbeatIntervalId = null
  }
  hostHeartbeatIntervalId = window.setInterval(sendHostHeartbeats, HEARTBEAT_INTERVAL_MS)
  sendHostHeartbeats()

  if (typeof document !== 'undefined' && !hostVisibilityTeardown) {
    const onVis = () => {
      const visible = document.visibilityState === 'visible'
      broadcastHostVisibility(visible)
      if (visible) sendHostHeartbeats()
    }
    document.addEventListener('visibilitychange', onVis)
    hostVisibilityTeardown = () => document.removeEventListener('visibilitychange', onVis)
  }
}

function touchGuestHostActivity() {
  guestLastHostActivityAt = Date.now()
}

function startGuestHostWatch() {
  if (guestHostWatchIntervalId !== null) {
    clearInterval(guestHostWatchIntervalId)
    guestHostWatchIntervalId = null
  }
  touchGuestHostActivity()
  guestHostWatchIntervalId = window.setInterval(() => {
    if (sessionPhase.value !== 'guest_connected' || isHost) return
    if (Date.now() - guestLastHostActivityAt > HEARTBEAT_STALE_MS) onGuestDisconnected()
  }, HEARTBEAT_GUEST_CHECK_MS)
}

function destroyWireOnly() {
  clearHeartbeatAndWatch()
  for (const c of hubConnections) {
    try {
      c.close()
    } catch {
      void 0
    }
  }
  hubConnections.clear()
  connToParticipant.clear()
  participantToConn.clear()
  stableIdToParticipant.clear()
  guestDrafts.clear()
  for (const t of pendingRemovalTimers.values()) clearTimeout(t)
  pendingRemovalTimers.clear()
  if (guestHubConn) {
    try {
      guestHubConn.close()
    } catch {
      void 0
    }
    guestHubConn = null
  }
  if (peer && !peer.destroyed) {
    try {
      peer.destroy()
    } catch {
      void 0
    }
  }
  peer = null
  isHost = false
  nextSeq = 0
  lastSeenSeq = 0
}

function reconnectDelayMs(attemptAfterFirst) {
  return sharedReconnectDelayMs(attemptAfterFirst, {
    baseMs: RECONNECT_BASE_DELAY_MS,
    maxMs: RECONNECT_MAX_DELAY_MS,
  })
}

/**
 * @param {string} [brokerId]
 * @param {number} [timeoutMs]
 */
function awaitPeerOpen(brokerId, timeoutMs = OPEN_PEER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const pr =
      typeof brokerId === 'string' && brokerId.length > 0 ? new Peer(brokerId) : new Peer()
    const t = window.setTimeout(() => {
      try {
        pr.destroy()
      } catch {
        void 0
      }
      reject(new Error('Peer open timeout'))
    }, timeoutMs)
    pr.on('error', (e) => {
      window.clearTimeout(t)
      try {
        pr.destroy()
      } catch {
        void 0
      }
      reject(e)
    })
    pr.on('open', () => {
      window.clearTimeout(t)
      resolve(pr)
    })
  })
}

/**
 * @returns {import('../types.js').MovieVotePublicPayload}
 */
function allDraftPicksFlat() {
  const store = useMovieVoteStore()
  const out = [...store.myDraftPicks]
  for (const [, g] of guestDrafts) {
    for (const p of g.picks) out.push(p)
  }
  return out
}

function distinctSuggestedMovieCount() {
  return uniqueTmdbCountInPicks(allDraftPicksFlat())
}

function buildPublicPayload() {
  const store = useMovieVoteStore()
  const participants = [
    {
      id: HOST_PARTICIPANT_ID,
      ready: store.readyToVote,
      pickCount: store.myDraftPicks.length,
    },
  ]
  for (const [id, g] of guestDrafts) {
    participants.push({
      id,
      ready: g.ready,
      pickCount: g.picks.length,
    })
  }
  const suggest = store.phase === 'suggest'
  return {
    phase: store.phase,
    participants,
    ballotMovies: suggest ? null : store.ballotMovies.map((m) => ({ ...m })),
    ballotOrderIds: suggest ? null : [...store.ballotOrderIds],
    voteProgress: store.voteProgress ? { ...store.voteProgress } : null,
    irvResult: store.irvResult,
    uniqueSuggestedMovieCount: suggest ? distinctSuggestedMovieCount() : 0,
  }
}

function hostBroadcastState() {
  if (!isHost || !peer || peer.destroyed) return
  const payload = buildPublicPayload()
  try {
    const st = useMovieVoteStore()
    st.setParticipants(payload.participants)
    st.setUniqueSuggestedMovieCount(
      typeof payload.uniqueSuggestedMovieCount === 'number' ? payload.uniqueSuggestedMovieCount : 0,
    )
  } catch {
    void 0
  }
  const msg = encodeState(payload, ++nextSeq)
  for (const c of hubConnections) {
    if (!c.open) continue
    try {
      c.send(msg)
    } catch {
      void 0
    }
  }
}

function roomHasEnoughDistinctSuggestionsForReady() {
  return distinctSuggestedMovieCount() >= MIN_DISTINCT_SUGGESTIONS_FOR_READY
}

function allParticipantsReady() {
  const store = useMovieVoteStore()
  if (!store.readyToVote) return false
  if (!roomHasEnoughDistinctSuggestionsForReady()) return false
  if (guestDrafts.size < 1) return false
  for (const [, g] of guestDrafts) {
    if (!g.ready) return false
  }
  return true
}

function tryCompileBallot() {
  const store = useMovieVoteStore()
  if (store.phase !== 'suggest') return
  if (!allParticipantsReady()) return

  /** @type {import('../types.js').MoviePick[]} */
  const allPicks = store.myDraftPicks.map((p) => ({ ...p }))
  for (const [, g] of guestDrafts) {
    for (const p of g.picks) allPicks.push({ ...p })
  }
  const movies = compileBallotMovies(allPicks)
  if (movies.length < MIN_DISTINCT_SUGGESTIONS_FOR_READY) {
    notifyP2P('Need at least two different movies before voting.', 'warning')
    return
  }

  const orderIds = movies.map((m) => m.publicId)
  const voterIds = [HOST_PARTICIPANT_ID, ...guestDrafts.keys()]
  store.setVotingState(movies, orderIds, voterIds)
  hostBroadcastState()
}

function tryFinishVoting() {
  const store = useMovieVoteStore()
  if (store.phase !== 'voting') return
  const { voterIds, votesByParticipant, ballotOrderIds } = store
  if (!voterIds.length) return
  for (const id of voterIds) {
    const r = votesByParticipant[id]
    if (!r || r.length !== ballotOrderIds.length) return
  }

  const rankings = voterIds.map((id) => votesByParticipant[id])
  const result = runIrv(rankings, [...ballotOrderIds])
  store.setResults(result)
  hostBroadcastState()
}

/**
 * @param {import('../types.js').MoviePick[]} picks
 */
function normalizePicks(picks) {
  return picks
    .filter(
      (p) =>
        p &&
        typeof p.localId === 'string' &&
        typeof p.tmdbId === 'number' &&
        typeof p.title === 'string',
    )
    .map((p) => ({
      localId: p.localId,
      tmdbId: p.tmdbId,
      title: p.title,
      posterPath: p.posterPath ?? null,
      overview: typeof p.overview === 'string' ? p.overview : '',
      releaseDate: p.releaseDate,
      runtime: typeof p.runtime === 'number' && p.runtime > 0 ? p.runtime : undefined,
    }))
}

/**
 * @param {import('peerjs').DataConnection} conn
 * @param {unknown} raw
 */
function handleHubInbound(conn, raw) {
  const hello = parseHello(raw)
  if (hello) {
    onGuestHello(conn, hello.stableId)
    return
  }

  const store = useMovieVoteStore()
  const expectedPid = connToParticipant.get(conn)
  if (!expectedPid) return

  const draft = parseDraft(raw)
  if (draft) {
    if (draft.participantId !== expectedPid) return
    guestDrafts.set(expectedPid, {
      picks: normalizePicks(draft.picks),
      ready: draft.ready,
    })
    tryCompileBallot()
    hostBroadcastState()
    return
  }

  const vote = parseVote(raw)
  if (vote) {
    if (vote.participantId !== expectedPid) return
    if (store.phase !== 'voting') return
    if (!store.voterIds.includes(expectedPid)) return
    const valid = new Set(store.ballotOrderIds)
    if (vote.ranking.length !== store.ballotOrderIds.length) return
    const seen = new Set()
    for (const id of vote.ranking) {
      if (!valid.has(id) || seen.has(id)) return
      seen.add(id)
    }
    store.mergeGuestVote(expectedPid, vote.ranking)
    hostBroadcastState()
    tryFinishVoting()
  }
}

/**
 * @param {unknown} raw
 */
function handleGuestInbound(raw) {
  if (isHostEndedNotice(raw)) {
    notifyP2P('The host ended the room.', 'info')
    reconnectGeneration += 1
    clearRoomPersistence()
    resetLocalStateAfterRoomExit()
    return
  }
  if (isHostPing(raw)) {
    touchGuestHostActivity()
    return
  }
  const vis = parseHostVisibility(raw)
  if (vis) {
    touchGuestHostActivity()
    remoteHostTabVisible.value = vis.visible
    return
  }
  const welcome = parseWelcome(raw)
  if (welcome) {
    touchGuestHostActivity()
    useMovieVoteStore().setMyParticipantId(welcome.participantId)
    // Re-push our drafts so the host picks them up even if they refreshed and
    // lost all participant state. Cheap; the host is idempotent on incoming
    // draft messages.
    movieVoteGuestPushDraft()
    return
  }
  const st = parseState(raw)
  if (!st) return
  touchGuestHostActivity()
  if (st.seq <= lastSeenSeq) return
  lastSeenSeq = st.seq
  useMovieVoteStore().applyPublicPayload(st.payload)
}

function wirePeerErrors(p) {
  p.on('error', (err) => {
    const severity = classifyPeerError(err)
    if (severity === 'fatal') {
      reconnectGeneration += 1
      clearRoomPersistence()
      const msg =
        err && typeof err === 'object' && 'type' in err
          ? `P2P error: ${/** @type {{type:string}} */ (err).type}`
          : 'P2P error'
      notifyP2P(msg, 'negative')
      teardownSession()
      return
    }
    if (isHost) {
      onHostDisconnected()
    } else {
      onGuestDisconnected()
    }
  })
}

function onGuestDisconnected() {
  if (isHost) return
  if (sessionPhase.value !== 'guest_connected') return

  const suffix = sessionSuffix.value
  if (!suffix) {
    destroyWireOnly()
    sessionPhase.value = 'idle'
    return
  }

  reconnectGeneration += 1
  const gen = reconnectGeneration

  destroyWireOnly()
  sessionPhase.value = 'reconnecting'
  sessionSuffix.value = suffix

  void guestReconnectLoop(suffix, gen)
}

function onHostDisconnected() {
  if (!isHost) return
  if (sessionPhase.value !== 'hosting') return

  const suffix = sessionSuffix.value
  if (!suffix) {
    destroyWireOnly()
    sessionPhase.value = 'idle'
    return
  }

  reconnectGeneration += 1
  const gen = reconnectGeneration

  destroyWireOnly()
  sessionPhase.value = 'reconnecting'
  sessionSuffix.value = suffix

  void hostReconnectLoop(suffix, gen)
}

/**
 * @param {string} suffix
 * @param {number} gen
 */
async function guestReconnectLoop(suffix, gen) {
  await new Promise((r) => setTimeout(r, RECONNECT_INITIAL_PAUSE_MS))
  if (gen !== reconnectGeneration) return

  for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
    if (gen !== reconnectGeneration) return

    if (attempt > 1) {
      notifyP2P(`Reconnecting… attempt ${attempt} of ${RECONNECT_MAX_ATTEMPTS}`, 'warning')
      await new Promise((r) => setTimeout(r, reconnectDelayMs(attempt - 2)))
    }

    if (gen !== reconnectGeneration) return

    try {
      destroyWireOnly()
      await establishGuestSession(suffix, { peerTimeoutMs: RECONNECT_PEER_TIMEOUT_MS })
      if (gen !== reconnectGeneration) {
        leaveSession()
        return
      }
      return
    } catch {
      continue
    }
  }

  if (gen !== reconnectGeneration) return

  clearRoomPersistence()
  notifyP2P('Could not reconnect. Use Host room / Join room to try again.', 'negative')
  teardownSession()
}

/**
 * @param {string} suffix
 * @param {number} gen
 */
async function hostReconnectLoop(suffix, gen) {
  const fullId = fullPeerIdFromSuffix(suffix)
  await new Promise((r) => setTimeout(r, RECONNECT_INITIAL_PAUSE_MS))
  if (gen !== reconnectGeneration) return

  for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
    if (gen !== reconnectGeneration) return

    if (attempt > 1) {
      notifyP2P(`Reconnecting as host… attempt ${attempt} of ${RECONNECT_MAX_ATTEMPTS}`, 'warning')
      await new Promise((r) => setTimeout(r, reconnectDelayMs(attempt - 2)))
    }

    if (gen !== reconnectGeneration) return

    try {
      destroyWireOnly()
      const p = await awaitPeerOpen(fullId, RECONNECT_PEER_TIMEOUT_MS)
      finishHostSession(/** @type {import('peerjs').Peer} */ (p), suffix)
      if (gen !== reconnectGeneration) {
        leaveSession()
        return
      }
      return
    } catch {
      continue
    }
  }

  if (gen !== reconnectGeneration) return

  clearRoomPersistence()
  notifyP2P('Could not restore hosting. Start a new room or try again later.', 'negative')
  teardownSession()
}

/**
 * @param {import('peerjs').Peer} p
 */
function attachHubConnectionHandlers(p) {
  p.on('connection', (conn) => {
    conn.on('open', () => {
      hubConnections.add(conn)
    })
    conn.on('data', (data) => handleHubInbound(conn, data))
    conn.on('close', () => {
      const pid = connToParticipant.get(conn)
      hubConnections.delete(conn)
      connToParticipant.delete(conn)
      if (pid && participantToConn.get(pid) === conn) {
        participantToConn.delete(pid)
        scheduleParticipantRemoval(pid)
      }
      hostBroadcastState()
    })
  })
}

/**
 * Schedule removal of a participant slot after {@link GUEST_REMOVAL_GRACE_MS}
 * unless a matching guest reconnects first. No-op if the slot is already
 * actively connected or already scheduled.
 * @param {string} pid
 */
function scheduleParticipantRemoval(pid) {
  if (!guestDrafts.has(pid)) return
  if (participantToConn.has(pid)) return
  const existing = pendingRemovalTimers.get(pid)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    pendingRemovalTimers.delete(pid)
    if (participantToConn.has(pid)) return
    guestDrafts.delete(pid)
    for (const [sid, mapped] of stableIdToParticipant) {
      if (mapped === pid) {
        stableIdToParticipant.delete(sid)
        break
      }
    }
    if (isHost && sessionPhase.value === 'hosting') {
      useMovieVoteStore().removeParticipantFromVote(pid)
      tryCompileBallot()
      tryFinishVoting()
      hostBroadcastState()
    }
  }, GUEST_REMOVAL_GRACE_MS)
  pendingRemovalTimers.set(pid, t)
}

/**
 * Cancel any pending removal for `pid` (guest is back before the grace period
 * expired).
 * @param {string} pid
 */
function cancelParticipantRemoval(pid) {
  const t = pendingRemovalTimers.get(pid)
  if (t) {
    clearTimeout(t)
    pendingRemovalTimers.delete(pid)
  }
}

/**
 * Completes the hello handshake for a new guest connection by picking (or
 * reusing) the participant slot, wiring up the new conn, dropping any orphan
 * conn that used to serve the same guest, and sending the initial welcome /
 * state bootstrap.
 *
 * @param {import('peerjs').DataConnection} conn
 * @param {string} stableId
 */
function onGuestHello(conn, stableId) {
  if (connToParticipant.has(conn)) return

  const existingPid = stableIdToParticipant.get(stableId)
  const pid = existingPid ?? generateAnonymousVoterId()
  const resumed = Boolean(existingPid)

  if (!existingPid) {
    stableIdToParticipant.set(stableId, pid)
    guestDrafts.set(pid, { picks: [], ready: false })
  } else {
    cancelParticipantRemoval(pid)
  }

  const orphan = participantToConn.get(pid)
  if (orphan && orphan !== conn) {
    try {
      connToParticipant.delete(orphan)
      orphan.close()
    } catch {
      void 0
    }
    hubConnections.delete(orphan)
  }

  connToParticipant.set(conn, pid)
  participantToConn.set(pid, conn)

  try {
    conn.send(encodeWelcome(pid, resumed))
    const payload = buildPublicPayload()
    if (nextSeq < 1) nextSeq = 1
    conn.send(encodeState(payload, nextSeq))
    if (typeof document !== 'undefined') {
      conn.send(encodeHostVisibility(document.visibilityState === 'visible'))
    }
  } catch {
    try {
      conn.close()
    } catch {
      void 0
    }
    return
  }

  if (resumed) {
    hostBroadcastState()
  }
}

/**
 * @param {import('peerjs').Peer} p
 * @param {string} suffix
 */
function finishHostSession(p, suffix) {
  peer = p
  isHost = true
  sessionSuffix.value = suffix
  nextSeq = 0
  lastSeenSeq = 0
  attachHubConnectionHandlers(peer)
  sessionPhase.value = 'hosting'
  wirePeerErrors(peer)
  startHostHeartbeats()
  useMovieVoteStore().setMyParticipantId(HOST_PARTICIPANT_ID)
  try {
    useMovieVoteRoomSessionStore().setHost(suffix)
  } catch {
    void 0
  }
  hostBroadcastState()
}

/**
 * @param {string} suffix
 * @param {{ peerTimeoutMs?: number }} [opts]
 */
async function establishGuestSession(suffix, opts = {}) {
  const peerTimeoutMs = opts.peerTimeoutMs ?? OPEN_PEER_TIMEOUT_MS
  const hubId = fullPeerIdFromSuffix(suffix)
  lastSeenSeq = 0
  const p = await awaitPeerOpen(undefined, peerTimeoutMs)
  peer = /** @type {import('peerjs').Peer} */ (p)
  isHost = false

  const conn = peer.connect(hubId, { ...PEER_OPTS })

  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      try {
        conn.close()
      } catch {
        void 0
      }
      reject(new Error('Connect timeout'))
    }, peerTimeoutMs)
    conn.on('error', (e) => {
      window.clearTimeout(t)
      reject(e)
    })
    conn.on('open', () => {
      window.clearTimeout(t)
      resolve(undefined)
    })
  })

  guestHubConn = conn
  conn.on('data', (data) => handleGuestInbound(data))
  conn.on('close', () => {
    guestHubConn = null
    onGuestDisconnected()
  })

  sessionPhase.value = 'guest_connected'
  wirePeerErrors(peer)
  startGuestHostWatch()

  try {
    conn.send(encodeHello(getStableClientId()))
  } catch {
    void 0
  }

  try {
    useMovieVoteRoomSessionStore().setGuest(suffix)
  } catch {
    void 0
  }
}

export async function resumeAsHost(rawSuffix, maxAttempts = 10) {
  reconnectGeneration += 1
  teardownSession()

  const suffix = normalizeRoomSuffixInput(rawSuffix)
  if (!isValidRoomSuffix(suffix)) {
    clearRoomPersistence()
    sessionPhase.value = 'idle'
    notifyP2P('Invalid saved room code', 'negative')
    throw new Error('Invalid saved room')
  }

  const fullId = fullPeerIdFromSuffix(suffix)
  sessionPhase.value = 'connecting'
  sessionSuffix.value = suffix

  let lastErr = /** @type {Error | null} */ (null)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 350 * attempt))
      notifyP2P(`Still resuming room… attempt ${attempt + 1} of ${maxAttempts}`, 'warning')
    }
    try {
      const p = await awaitPeerOpen(fullId)
      finishHostSession(/** @type {import('peerjs').Peer} */ (p), suffix)
      return { suffix }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  clearRoomPersistence()
  teardownSession()
  notifyP2P(lastErr?.message ?? 'Could not resume room', 'negative')
  throw lastErr ?? new Error('Could not resume room')
}

export function resumeMovieVoteSessionIfNeeded() {
  let rs
  try {
    rs = useMovieVoteRoomSessionStore()
  } catch {
    return
  }
  if (!rs.role || !rs.suffix) return
  if (sessionPhase.value !== 'idle') return
  const { role, suffix } = rs
  if (role === 'host') {
    resumeAsHost(suffix).catch(() => {})
  } else {
    joinRoom(suffix).catch(() => {})
  }
}

export async function startAsHost(maxAttempts = 12) {
  reconnectGeneration += 1
  teardownSession()
  sessionPhase.value = 'connecting'

  const preferredSuffix = deriveStableHostSuffix(STABLE_HOST_SUFFIX_APP, 6)

  let lastErr = /** @type {Error | null} */ (null)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = attempt === 0 ? preferredSuffix : generateRoomSuffix(6)
    const fullId = fullPeerIdFromSuffix(suffix)

    try {
      const p = await awaitPeerOpen(fullId)
      sessionSuffix.value = suffix
      finishHostSession(/** @type {import('peerjs').Peer} */ (p), suffix)
      return { suffix }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt === 0 && !isUnavailableIdError(e)) {
        continue
      }
    }
  }

  teardownSession()
  notifyP2P(lastErr?.message ?? 'Could not create room', 'negative')
  throw lastErr ?? new Error('Could not create room')
}

export async function joinRoom(rawSuffix) {
  reconnectGeneration += 1
  teardownSession()

  const suffix = normalizeRoomSuffixInput(rawSuffix)
  if (!isValidRoomSuffix(suffix)) {
    clearRoomPersistence()
    sessionPhase.value = 'idle'
    notifyP2P('Invalid room code', 'negative')
    throw new Error('Invalid room code')
  }

  const st = useMovieVoteStore()
  st.resetSessionSoft()

  sessionPhase.value = 'connecting'
  sessionSuffix.value = suffix

  try {
    await establishGuestSession(suffix)
  } catch (e) {
    clearRoomPersistence()
    const msg = e instanceof Error ? e.message : String(e)
    teardownSession()
    notifyP2P(msg, 'negative')
    throw e instanceof Error ? e : new Error(msg)
  }
}

export function teardownSession() {
  sessionPhase.value = 'idle'
  sessionSuffix.value = null
  remoteHostTabVisible.value = true
  destroyWireOnly()
}

function resetLocalStateAfterRoomExit() {
  teardownSession()
  try {
    useMovieVoteStore().resetForRoomExit()
  } catch {
    void 0
  }
}

export function leaveSession() {
  reconnectGeneration += 1
  clearRoomPersistence()
  if (isHost && sessionPhase.value === 'hosting') {
    const endMsg = { type: MSG_MV_HOST_ENDED }
    for (const c of hubConnections) {
      if (!c.open) continue
      try {
        c.send(endMsg)
      } catch {
        void 0
      }
    }
  }
  resetLocalStateAfterRoomExit()
}

export function isMovieVoteP2PSessionActive() {
  return sessionPhase.value === 'hosting' || sessionPhase.value === 'guest_connected'
}

/** Host: local draft/ready changed — rebroadcast and maybe compile. */
export function movieVoteHostLocalChanged() {
  if (!isHost || sessionPhase.value !== 'hosting') return
  tryCompileBallot()
  hostBroadcastState()
}

/** Guest: push draft to host */
export function movieVoteGuestPushDraft() {
  if (isHost || !guestHubConn?.open) return
  const store = useMovieVoteStore()
  const pid = store.myParticipantId
  if (!pid) return
  try {
    guestHubConn.send(
      encodeDraft(store.myDraftPicks, store.readyToVote, pid),
    )
  } catch {
    void 0
  }
}

/** Guest: submit ranking */
export function movieVoteGuestSubmitVote(ranking) {
  if (isHost || !guestHubConn?.open) return
  const store = useMovieVoteStore()
  const pid = store.myParticipantId
  if (!pid) return
  try {
    guestHubConn.send(encodeVote(pid, ranking))
  } catch {
    void 0
  }
}

/** Host: after local vote submit */
export function movieVoteHostAfterVoteSubmit() {
  if (!isHost || sessionPhase.value !== 'hosting') return
  hostBroadcastState()
  tryFinishVoting()
}

