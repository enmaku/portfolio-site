/**
 * @import '../types.js'
 * Firebase RTDB star hub for Movie Vote (`movieVoteRooms/<suffix>`).
 * Typed messages; host aggregates guest drafts and runs the election facade.
 */

import { ref as vueRef } from 'vue'
import { Notify } from 'quasar'
import {
  child,
  get,
  onChildAdded,
  onDisconnect,
  onValue,
  ref as dbRef,
  remove,
} from 'firebase/database'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { getMovieVoteDatabase, movieVoteRoomRef, setRtdb } from '../firebase/rtdb.js'
import { createStarRoomSession } from '../../p2p/starRoomSessionCore.js'
import {
  HOST_PARTICIPANT_ID,
  compileBallotMovies,
  normalizeCustomTitle,
  uniqueMoviesInPicks,
} from '../core.js'
import { buildMovieVotePublicPayload, clearGuestDraftReadyFlags } from '../publicPayload.js'
import { applyHostStoreFromRtdbHydrate } from '../hostRtdbHydrate.js'
import { runElection } from '../election.js'
import {
  runGuestStarReconnectLoop,
  runHostStarReconnectLoop,
} from '../../p2p/starRoomShell.js'
import { deriveStableHostSuffix, getStableClientId } from '../../p2p/identity.js'
import {
  encodeDraft,
  encodeHello,
  encodeHostVisibility,
  encodeState,
  encodeVote,
  encodeWelcome,
  isHostEndedNotice,
  isHostPing,
  parseDraft,
  parseHello,
  parseHostVisibility,
  parseState,
  parseVote,
  parseWelcome,
} from './protocol.js'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'
import {
  generateAnonymousVoterId,
  generateRoomSuffix,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from './roomId.js'

const STABLE_HOST_SUFFIX_APP = 'movievote'

/**
 * @typedef {object} MovieVoteP2PHandlers
 * @property {(payload: import('../types.js').MovieVotePublicPayload) => void} applyPublicPayload
 * @property {() => void} onWireTeardown
 */

/** @type {MovieVoteP2PHandlers} */
let handlers = {
  applyPublicPayload: () => {},
  onWireTeardown: () => {},
}

let nextSeq = 0

let lastSeenSeq = 0

/**
 * Stable client id → participant id.
 * @type {Map<string, string>}
 */
const stableIdToParticipant = new Map()

/**
 * Stable ids currently marked online under `guestOnline/`.
 * @type {Set<string>}
 */
const activeGuestStableIds = new Set()

/**
 * Guest drafts keyed by participant id (host tab uses store only).
 * @type {Map<string, { picks: import('../types.js').MoviePick[], ready: boolean }>}
 */
const guestDrafts = new Map()

/**
 * @type {Map<string, ReturnType<typeof setTimeout>>}
 */
const pendingRemovalTimers = new Map()

/** @type {Array<() => void>} */
let featureWireUnsubs = []

/** Reactive session UI state for multiplayer (Vue ref; safe to use outside components). */
export const sessionPhase = vueRef(/** @type {import('./types.js').MovieVoteSessionPhase} */ ('idle'))

/** Short user-facing room code while hosting or connected as guest; null when idle. */
export const sessionSuffix = vueRef(/** @type {string | null} */ (null))

/**
 * Guest only: last host-reported tab visibility (`document.visibilityState === 'visible'` on host).
 * Stays `true` when idle / hosting / unknown.
 */
export const remoteHostTabVisible = vueRef(true)

const GUEST_REMOVAL_GRACE_MS = 45_000

const MIN_DISTINCT_SUGGESTIONS_FOR_READY = 2

/**
 * @returns {string | null} null when every gate passes
 */
function allParticipantsReadyReason() {
  const store = useMovieVoteStore()
  if (!store.readyToVote) return 'host_not_ready'
  const distinct = distinctSuggestedMovieCount()
  if (distinct < MIN_DISTINCT_SUGGESTIONS_FOR_READY) {
    return `distinct_movies_${distinct}_lt_${MIN_DISTINCT_SUGGESTIONS_FOR_READY}`
  }
  if (guestDrafts.size < 1) return 'no_guest_drafts'
  for (const [pid, g] of guestDrafts) {
    const stableId = [...stableIdToParticipant.entries()].find(([, p]) => p === pid)?.[0]
    if (stableId && !activeGuestStableIds.has(stableId)) continue
    if (!g.ready) return `guest_not_ready:${pid}`
  }
  const hasOnlineGuest = [...stableIdToParticipant.entries()].some(
    ([stableId]) => activeGuestStableIds.has(stableId) && stableIdToParticipant.get(stableId) !== HOST_PARTICIPANT_ID,
  )
  if (!hasOnlineGuest) return 'no_online_guests'
  return null
}

/** Guest participant ids with a stable id currently marked online. */
function onlineGuestParticipantIds() {
  /** @type {string[]} */
  const out = []
  for (const [stableId, pid] of stableIdToParticipant) {
    if (activeGuestStableIds.has(stableId)) out.push(pid)
  }
  return out
}

/**
 * @param {string} suffix
 * @param {string} path
 */
function roomChild(suffix, path) {
  return child(movieVoteRoomRef(suffix), path)
}

const rtdbPort = {
  get,
  set: (ref, value) => setRtdb(ref, value),
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
}

const core = createStarRoomSession({
  guestPresence: 'strict',
  claimResetPaths: ROOM_CLAIM_RESET_PATHS,
  getStableClientId,
  roomChild,
  rtdb: rtdbPort,
  protocolAdapter: {
    encodeGuestHello: encodeHello,
    parseHostVisibility,
    hasGuestJoinableState: (stateVal) => parseState(stateVal) != null,
    encodeHostVisibility,
  },
  onPhaseChange: (phase) => {
    sessionPhase.value = phase
  },
  onSuffixChange: (s) => {
    sessionSuffix.value = s
  },
  onSessionEvent: (event) => {
    if (event.type === 'host_ended_room') {
      handleGuestHostEnded()
      return
    }
    if (event.type === 'host_tab_visible') {
      remoteHostTabVisible.value = event.visible
      return
    }
    if (event.type === 'connectivity_offline') {
      const suffix = core.getSuffix()
      if (!suffix) return
      if (event.role === 'guest') {
        void guestReconnectLoop(suffix, core.getReconnectGeneration())
      } else {
        void hostReconnectLoop(suffix, core.getReconnectGeneration())
      }
    }
  },
  onHostInboxMessage: (stableId, raw) => handleHostInboxMessage(stableId, raw),
  onGuestAuthorityMessage: (raw) => handleGuestState(raw),
  hydrateHost: hydrateHostFromRtdb,
  subscribeFirebaseConnected: (onOffline) => {
    const connectedRef = dbRef(getMovieVoteDatabase(), '.info/connected')
    return onValue(connectedRef, (snap) => {
      if (snap.val() !== false) return
      onOffline()
    })
  },
})

/**
 * @param {() => void} unsub
 */
function trackFeatureUnsub(unsub) {
  featureWireUnsubs.push(unsub)
}

function clearFeatureWireUnsubs() {
  for (const unsub of featureWireUnsubs) {
    try {
      unsub()
    } catch {
      void 0
    }
  }
  featureWireUnsubs = []
}

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

function clearRoomPersistence() {
  try {
    useMovieVoteRoomSessionStore().clear()
  } catch {
    void 0
  }
}

/**
 * @param {string} suffix
 * @param {string} stableId
 */
async function markGuestOnline(suffix, stableId) {
  const onlineRef = roomChild(suffix, `guestOnline/${stableId}`)
  await setRtdb(onlineRef, true)
  onDisconnect(onlineRef).set(false)
}

/**
 * @param {string} suffix
 * @param {string} stableId
 */
async function markGuestOffline(suffix, stableId) {
  await setRtdb(roomChild(suffix, `guestOnline/${stableId}`), false).catch(() => {})
}

function destroyWireOnly() {
  const suffix = core.getSuffix()
  const sid = core.getGuestStableId()
  if (!core.isHostRole() && suffix && sid) {
    void markGuestOffline(suffix, sid)
  }

  clearFeatureWireUnsubs()
  stableIdToParticipant.clear()
  activeGuestStableIds.clear()
  guestDrafts.clear()
  for (const t of pendingRemovalTimers.values()) clearTimeout(t)
  pendingRemovalTimers.clear()
  lastSeenSeq = 0
  core.destroyWireOnly()
}

function allDraftPicksFlat() {
  const store = useMovieVoteStore()
  const out = [...store.myDraftPicks]
  for (const [, g] of guestDrafts) {
    for (const p of g.picks) out.push(p)
  }
  return out
}

function distinctSuggestedMovieCount() {
  return uniqueMoviesInPicks(allDraftPicksFlat())
}

function buildPublicPayload() {
  const store = useMovieVoteStore()
  return buildMovieVotePublicPayload(store, guestDrafts)
}

let hostStateBroadcastProbe = 0

function hostBroadcastState() {
  if (!core.isHostRole() || !sessionSuffix.value) return
  hostStateBroadcastProbe += 1
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
  setRtdb(roomChild(sessionSuffix.value, 'state'), msg).catch(() => {})
}

function tryCompileBallot() {
  const store = useMovieVoteStore()
  if (store.phase !== 'suggest') return
  if (allParticipantsReadyReason()) return

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
  const voterIds = [HOST_PARTICIPANT_ID, ...onlineGuestParticipantIds()]
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
  const result = runElection(store.votingMethod, rankings, [...ballotOrderIds])
  store.setResults(result)
  hostBroadcastState()
}

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
 * Re-attach stable id → participant after host tab refresh (inbox may hold draft/vote, not hello).
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

  stableIdToParticipant.set(stableId, pid)
  if (!guestDrafts.has(pid)) {
    guestDrafts.set(pid, { picks: [], ready: false })
  }
  cancelParticipantRemoval(pid)
  return pid
}

/**
 * @param {string} stableId
 * @param {unknown} raw
 */
function handleHostInboxMessage(stableId, raw) {
  const hello = parseHello(raw)
  if (hello) {
    if (hello.stableId !== stableId) return
    onGuestHello(stableId)
    return
  }

  const expectedPid = bindStableIdFromGuestPayload(stableId, raw)
  if (!expectedPid) return

  const store = useMovieVoteStore()
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

function handleGuestHostEnded() {
  notifyP2P('The host ended the room.', 'info')
  core.bumpReconnectGeneration()
  clearRoomPersistence()
  resetLocalStateAfterRoomExit()
}

/**
 * @param {unknown} raw
 */
function handleGuestWelcome(raw) {
  const welcome = parseWelcome(raw)
  if (!welcome) return
  useMovieVoteStore().setMyParticipantId(welcome.participantId)
}

/**
 * Dispatches inbound hub state on the guest (sequenced public payload).
 * @param {unknown} raw
 * @returns {void}
 */
function handleGuestState(raw) {
  const st = parseState(raw)
  if (!st) return
  if (st.seq <= lastSeenSeq) return
  lastSeenSeq = st.seq
  try {
    handlers.applyPublicPayload(st.payload)
  } catch {
    return
  }
}

/**
 * Dispatches inbound hub messages on the guest: room ended, ping, visibility, welcome, or sequenced state.
 * @param {unknown} raw
 * @returns {void}
 */
export function handleGuestInbound(raw) {
  if (isHostEndedNotice(raw)) {
    handleGuestHostEnded()
    return
  }
  if (isHostPing(raw)) {
    return
  }
  const vis = parseHostVisibility(raw)
  if (vis) {
    remoteHostTabVisible.value = vis.visible
    return
  }
  if (parseWelcome(raw)) {
    handleGuestWelcome(raw)
    return
  }
  handleGuestState(raw)
}

/**
 * @typedef {object} MovieVoteP2POutboundSync
 * @property {() => void} hostLocalChanged
 * @property {() => void} hostResetToSuggest
 * @property {() => void} hostVotingMethodChanged
 * @property {() => void} guestPushDraft
 * @property {(ranking: string[]) => void} guestSubmitVote
 * @property {() => void} hostAfterVoteSubmit
 */

/** @type {MovieVoteP2POutboundSync} */
const movieVoteP2POutboundSync = {
  hostLocalChanged() {
    if (!core.isHostRole() || sessionPhase.value !== 'hosting') return
    tryCompileBallot()
    hostBroadcastState()
  },
  hostResetToSuggest() {
    if (!core.isHostRole() || sessionPhase.value !== 'hosting') return
    clearGuestDraftReadyFlags(guestDrafts)
    hostBroadcastState()
  },
  hostVotingMethodChanged() {
    if (!core.isHostRole() || sessionPhase.value !== 'hosting') return
    hostBroadcastState()
  },
  guestPushDraft() {
    if (core.isHostRole()) return
    const store = useMovieVoteStore()
    const pid = store.myParticipantId
    if (!pid) return
    core.writeGuestInbox(encodeDraft(store.myDraftPicks, store.readyToVote, pid))
  },
  guestSubmitVote(ranking) {
    if (core.isHostRole()) return
    const store = useMovieVoteStore()
    const pid = store.myParticipantId
    if (!pid) return
    core.writeGuestInbox(encodeVote(pid, ranking))
  },
  hostAfterVoteSubmit() {
    if (sessionPhase.value !== 'hosting') return
    hostBroadcastState()
    tryFinishVoting()
  },
}

/**
 * Installed once by the Pinia bridge; supplies public payload apply and wire teardown for the session.
 * @param {Partial<MovieVoteP2PHandlers>} h
 * @returns {MovieVoteP2POutboundSync}
 */
export function bindMovieVoteP2PHandlers(h) {
  handlers = { ...handlers, ...h }
  return movieVoteP2POutboundSync
}

/**
 * @param {string} suffix
 */
function wireHostGuestOnline(suffix) {
  const guestOnlineRef = roomChild(suffix, 'guestOnline')
  trackFeatureUnsub(
    onChildAdded(guestOnlineRef, (snap) => {
      const stableId = snap.key
      if (!stableId) return
      const onlineRef = snap.ref
      trackFeatureUnsub(
        onValue(onlineRef, (onlineSnap) => {
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

/**
 * @param {string} suffix
 * @param {string} stableId
 */
function wireGuestWelcome(suffix, stableId) {
  trackFeatureUnsub(
    onValue(roomChild(suffix, `welcome/${stableId}`), (snap) => {
      const raw = snap.val()
      if (raw != null) handleGuestWelcome(raw)
    }),
  )
}

/**
 * @param {string} suffix
 * @param {number} gen
 */
function guestReconnectLoop(suffix, gen) {
  return runGuestStarReconnectLoop({
    gen,
    getReconnectGeneration: () => core.getReconnectGeneration(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    notifyReconnectingGuest: (attempt, max) =>
      notifyP2P(`Reconnecting… attempt ${attempt} of ${max}`, 'warning'),
    destroyWireOnly,
    establishGuest: () => establishGuestSession(suffix),
    clearRoomPersistence,
    notifyGuestReconnectFailed: () =>
      notifyP2P('Could not reconnect. Use Host room / Join room to try again.', 'negative'),
    teardownSession,
  })
}

/**
 * @param {string} suffix
 * @param {number} gen
 */
function hostReconnectLoop(suffix, gen) {
  return runHostStarReconnectLoop({
    gen,
    getReconnectGeneration: () => core.getReconnectGeneration(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    notifyReconnectingHost: (attempt, max) =>
      notifyP2P(`Reconnecting as host… attempt ${attempt} of ${max}`, 'warning'),
    destroyWireOnly,
    establishHost: () => finishHostSession(suffix),
    clearRoomPersistence,
    notifyHostReconnectFailed: () =>
      notifyP2P('Could not restore hosting. Start a new room or try again later.', 'negative'),
    teardownSession,
  })
}

function scheduleParticipantRemoval(pid) {
  if (!guestDrafts.has(pid)) return
  const stableId = [...stableIdToParticipant.entries()].find(([, p]) => p === pid)?.[0]
  if (stableId && activeGuestStableIds.has(stableId)) return
  const existing = pendingRemovalTimers.get(pid)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    pendingRemovalTimers.delete(pid)
    if (stableId && activeGuestStableIds.has(stableId)) return
    guestDrafts.delete(pid)
    if (stableId) {
      stableIdToParticipant.delete(stableId)
      activeGuestStableIds.delete(stableId)
    }
    if (core.isHostRole() && sessionPhase.value === 'hosting') {
      useMovieVoteStore().removeParticipantFromVote(pid)
      tryCompileBallot()
      tryFinishVoting()
      hostBroadcastState()
    }
  }, GUEST_REMOVAL_GRACE_MS)
  pendingRemovalTimers.set(pid, t)
}

function cancelParticipantRemoval(pid) {
  const t = pendingRemovalTimers.get(pid)
  if (t) {
    clearTimeout(t)
    pendingRemovalTimers.delete(pid)
  }
}

/**
 * @param {string} stableId
 */
function onGuestHello(stableId) {
  const existingPid = stableIdToParticipant.get(stableId)
  const pid = existingPid ?? generateAnonymousVoterId()
  const resumed = Boolean(existingPid)

  if (!existingPid) {
    stableIdToParticipant.set(stableId, pid)
    guestDrafts.set(pid, { picks: [], ready: false })
  } else {
    cancelParticipantRemoval(pid)
  }

  activeGuestStableIds.add(stableId)

  const suffix = sessionSuffix.value
  if (!suffix) return

  const welcomeRef = roomChild(suffix, `welcome/${stableId}`)
  setRtdb(welcomeRef, encodeWelcome(pid, resumed)).catch(() => {})

  const payload = buildPublicPayload()
  if (nextSeq < 1) nextSeq = 1
  setRtdb(roomChild(suffix, 'state'), encodeState(payload, nextSeq)).catch(() => {})

  if (typeof document !== 'undefined') {
    setRtdb(roomChild(suffix, 'hostVisible'), encodeHostVisibility(document.visibilityState === 'visible')).catch(
      () => {},
    )
  }

  if (resumed) hostBroadcastState()
}

/**
 * Restore seq, participant slots, and online flags after host reconnect / refresh.
 * @param {string} suffix
 */
async function hydrateHostFromRtdb(suffix) {
  const stateSnap = await get(roomChild(suffix, 'state'))
  const parsed = parseState(stateSnap.val())
  if (parsed) nextSeq = parsed.seq
  try {
    applyHostStoreFromRtdbHydrate(parsed, {
      applyPublicPayload: (p) => handlers.applyPublicPayload(p),
      votingMethod: useMovieVoteStore().votingMethod,
    })
  } catch {
    void 0
  }

  const welcomeSnap = await get(roomChild(suffix, 'welcome'))
  const welcomes = welcomeSnap.val()
  if (welcomes && typeof welcomes === 'object') {
    for (const [stableId, raw] of Object.entries(welcomes)) {
      if (typeof stableId !== 'string') continue
      const welcome = parseWelcome(raw)
      if (!welcome) continue
      stableIdToParticipant.set(stableId, welcome.participantId)
      if (!guestDrafts.has(welcome.participantId)) {
        guestDrafts.set(welcome.participantId, { picks: [], ready: false })
      }
    }
  }

  const onlineSnap = await get(roomChild(suffix, 'guestOnline'))
  const online = onlineSnap.val()
  if (online && typeof online === 'object') {
    for (const [stableId, isOnline] of Object.entries(online)) {
      if (isOnline === true) activeGuestStableIds.add(stableId)
    }
  }
}

/**
 * @param {string} suffix
 */
async function finishHostSession(suffix) {
  nextSeq = 0
  lastSeenSeq = 0
  await core.finishHostSession(suffix)
  wireHostGuestOnline(suffix)
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
 */
async function establishGuestSession(suffix) {
  lastSeenSeq = 0
  remoteHostTabVisible.value = true
  await core.establishGuestSession(suffix)
  const stableId = core.getGuestStableId()
  if (!stableId) throw new Error('No active room for that code')
  await markGuestOnline(suffix, stableId)
  wireGuestWelcome(suffix, stableId)
  try {
    useMovieVoteRoomSessionStore().setGuest(suffix)
  } catch {
    void 0
  }
}

export async function resumeAsHost(rawSuffix, maxAttempts = 10) {
  core.bumpReconnectGeneration()
  teardownSession()

  const suffix = normalizeRoomSuffixInput(rawSuffix)
  if (!isValidRoomSuffix(suffix)) {
    clearRoomPersistence()
    sessionPhase.value = 'idle'
    notifyP2P('Invalid saved room code', 'negative')
    throw new Error('Invalid saved room')
  }

  sessionPhase.value = 'connecting'
  sessionSuffix.value = suffix

  let lastErr = /** @type {Error | null} */ (null)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 350 * attempt))
      notifyP2P(`Still resuming room… attempt ${attempt + 1} of ${maxAttempts}`, 'warning')
    }
    try {
      await finishHostSession(suffix)
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

/**
 * @returns {string[]}
 */
function hostStartSuffixOrder() {
  const preferred = deriveStableHostSuffix(STABLE_HOST_SUFFIX_APP, 6)
  const order = [preferred]
  try {
    const saved = useMovieVoteRoomSessionStore().suffix
    const norm = saved ? normalizeRoomSuffixInput(saved) : ''
    if (norm && isValidRoomSuffix(norm) && norm !== preferred) order.push(norm)
  } catch {
    void 0
  }
  return order
}

export async function startAsHost(maxAttempts = 12) {
  core.bumpReconnectGeneration()
  teardownSession()
  sessionPhase.value = 'connecting'

  const fixedSuffixes = hostStartSuffixOrder()

  let lastErr = /** @type {Error | null} */ (null)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix =
      attempt < fixedSuffixes.length ? fixedSuffixes[attempt] : generateRoomSuffix(6)

    try {
      if (!(await core.tryClaimHostRoom(suffix))) {
        lastErr = new Error('Room code in use')
        continue
      }
      sessionSuffix.value = suffix
      await finishHostSession(suffix)
      return { suffix }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  teardownSession()
  notifyP2P(lastErr?.message ?? 'Could not create room', 'negative')
  throw lastErr ?? new Error('Could not create room')
}

export async function joinRoom(rawSuffix) {
  core.bumpReconnectGeneration()
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

/**
 * Ends the session for this tab: clears phase and suffix, then tears down RTDB listeners.
 * Does not reset `nextSeq` or handler bindings — use `session.testExports.js` when reusing
 * one module instance in tests.
 * @returns {void}
 */
export function teardownSession() {
  remoteHostTabVisible.value = true
  destroyWireOnly()
  core.setPhase('idle')
  core.setSuffix(null)
}

/**
 * Test-only wire access for `session.testExports.js`. Do not import from production code.
 * @returns {{
 *   core: ReturnType<typeof createStarRoomSession>,
 *   remoteHostTabVisible: typeof remoteHostTabVisible,
 *   clearFeatureWireUnsubs: typeof clearFeatureWireUnsubs,
 *   stableIdToParticipant: typeof stableIdToParticipant,
 *   activeGuestStableIds: typeof activeGuestStableIds,
 *   guestDrafts: typeof guestDrafts,
 *   pendingRemovalTimers: typeof pendingRemovalTimers,
 *   getHostStateBroadcastProbe: () => number,
 *   setHostStateBroadcastProbe: (n: number) => void,
 *   getNextSeq: () => number,
 *   setNextSeq: (n: number) => void,
 *   getLastSeenSeq: () => number,
 *   setLastSeenSeq: (n: number) => void,
 *   emptyHandlers: () => MovieVoteP2PHandlers,
 *   setHandlers: (h: MovieVoteP2PHandlers) => void,
 * }}
 */
export function getMovieVoteSessionTestWireAccess() {
  return {
    core,
    remoteHostTabVisible,
    clearFeatureWireUnsubs,
    stableIdToParticipant,
    activeGuestStableIds,
    guestDrafts,
    pendingRemovalTimers,
    getHostStateBroadcastProbe: () => hostStateBroadcastProbe,
    setHostStateBroadcastProbe: (n) => {
      hostStateBroadcastProbe = n
    },
    getNextSeq: () => nextSeq,
    setNextSeq: (n) => {
      nextSeq = n
    },
    getLastSeenSeq: () => lastSeenSeq,
    setLastSeenSeq: (n) => {
      lastSeenSeq = n
    },
    emptyHandlers: () => ({
      applyPublicPayload: () => {},
      onWireTeardown: () => {},
    }),
    setHandlers: (h) => {
      handlers = h
    },
  }
}

function resetLocalStateAfterRoomExit() {
  teardownSession()
  try {
    handlers.onWireTeardown()
  } catch {
    void 0
  }
  try {
    useMovieVoteStore().resetForRoomExit()
  } catch {
    void 0
  }
}

export function leaveSession() {
  core.bumpReconnectGeneration()
  if (core.isHostRole() && core.getPhase() === 'hosting' && core.getSuffix()) {
    const suffix = core.getSuffix()
    setRtdb(roomChild(suffix, 'ended'), Date.now()).catch(() => {})
    remove(roomChild(suffix, 'hostPing')).catch(() => {})
    try {
      useMovieVoteRoomSessionStore().clearHostRole()
    } catch {
      clearRoomPersistence()
    }
  } else {
    clearRoomPersistence()
  }
  resetLocalStateAfterRoomExit()
}

export function isMovieVoteP2PSessionActive() {
  return sessionPhase.value === 'hosting' || sessionPhase.value === 'guest_connected'
}
