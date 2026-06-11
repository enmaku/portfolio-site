/**
 * Firebase RTDB star hub for Movie Vote (`movieVoteRooms/<suffix>`).
 * Typed messages; host aggregates guest drafts and runs the election facade.
 *
 * Production code imports this module only. Tests use `session.testExports.js` and
 * `session.testWireAccess.js` for facade contract helpers.
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
  parseHostVisibility,
  parseState,
  parseWelcome,
} from './protocol.js'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'
import {
  generateRoomSuffix,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from './roomId.js'
import { createGuestInboundWire } from './guestInboundWire.js'
import { createGuestOnlineWire } from './guestOnlineWire.js'
import { createHostInboxWire } from './hostInboxWire.js'
import { createMovieVoteWireState } from './movieVoteWireState.js'
import { registerMovieVoteTestWireAccess } from './session.testWireAccess.js'

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

const wireState = createMovieVoteWireState()
const {
  stableIdToParticipant,
  activeGuestStableIds,
  guestDrafts,
} = wireState

/** @type {Array<() => void>} */
let featureWireUnsubs = []

/** Reactive session UI state for multiplayer (Vue ref; safe to use outside components). */
export const sessionPhase = vueRef(/** @type {import('./types.js').MovieVoteSessionPhase} */ ('idle'))

/** Short user-facing room code while hosting or connected as guest; null when idle. */
export const sessionSuffix = vueRef(/** @type {string | null} */ (null))

/**
 * Monotonic authority `seq` of the last applied host broadcast (guest) or last published
 * state message (host). Wire/sync metadata only — not persisted in Pinia.
 */
export const roomAuthoritySeq = vueRef(0)

/**
 * Guest only: last host-reported tab visibility (`document.visibilityState === 'visible'` on host).
 * Stays `true` when idle / hosting / unknown.
 */
export const remoteHostTabVisible = vueRef(true)

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

function resetMovieVoteWireState() {
  wireState.resetMaps()
  lastSeenSeq = 0
  roomAuthoritySeq.value = 0
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
  roomAuthoritySeq.value = nextSeq
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
  const voterIds = [HOST_PARTICIPANT_ID, ...wireState.onlineGuestParticipantIds()]
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
  store.setElectionOutcome(result)
  hostBroadcastState()
}

/**
 * @param {string} participantId
 * @param {{ picks: import('../types.js').MoviePick[], ready: boolean }} entry
 */
function applyGuestDraftFromInbox(participantId, entry) {
  guestDrafts.set(participantId, entry)
  tryCompileBallot()
  hostBroadcastState()
}

/**
 * @param {string} participantId
 * @param {string[]} ranking
 * @returns {boolean}
 */
function applyGuestVoteFromInbox(participantId, ranking) {
  const store = useMovieVoteStore()
  if (store.phase !== 'voting') return false
  if (!store.voterIds.includes(participantId)) return false
  const valid = new Set(store.ballotOrderIds)
  if (ranking.length !== store.ballotOrderIds.length) return false
  const seen = new Set()
  for (const id of ranking) {
    if (!valid.has(id) || seen.has(id)) return false
    seen.add(id)
  }
  store.mergeGuestVote(participantId, ranking)
  return true
}

function handleGuestHostEnded() {
  notifyP2P('The host ended the room.', 'info')
  core.bumpReconnectGeneration()
  clearRoomPersistence()
  resetLocalStateAfterRoomExit()
}

/** @type {ReturnType<typeof createStarRoomSession>} */
let core

const guestOnlineWire = createGuestOnlineWire({
  wireState,
  roomChild,
  setRtdb,
  onDisconnect,
  onChildAdded,
  onValue,
  trackFeatureUnsub,
  scheduleTimer: (fn, ms) => setTimeout(fn, ms),
  cancelTimer: (id) => clearTimeout(id),
  isHostRole: () => core.isHostRole(),
  getSessionPhase: () => sessionPhase.value,
  tryCompileBallot,
  tryFinishVoting,
  hostBroadcastState,
  removeParticipantFromVote: (pid) => useMovieVoteStore().removeParticipantFromVote(pid),
})

const hostInboxWire = createHostInboxWire({
  wireState,
  roomChild,
  setRtdb,
  getSessionSuffix: () => sessionSuffix.value,
  getNextSeq: () => nextSeq,
  setNextSeq: (n) => {
    nextSeq = n
  },
  buildPublicPayload,
  hostBroadcastState,
  tryFinishVoting,
  cancelParticipantRemoval: guestOnlineWire.cancelParticipantRemoval,
  applyGuestDraft: applyGuestDraftFromInbox,
  applyGuestVote: applyGuestVoteFromInbox,
})

const guestInboundWire = createGuestInboundWire({
  remoteHostTabVisible,
  getLastSeenSeq: () => lastSeenSeq,
  setLastSeenSeq: (n) => {
    lastSeenSeq = n
    roomAuthoritySeq.value = n
  },
  applyPublicPayload: (payload) => handlers.applyPublicPayload(payload),
  onGuestHostEnded: handleGuestHostEnded,
  setMyParticipantId: (id) => useMovieVoteStore().setMyParticipantId(id),
})

export const handleGuestInbound = guestInboundWire.handleGuestInbound

core = createStarRoomSession({
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
  onHostInboxMessage: (stableId, raw) => hostInboxWire.handleHostInboxMessage(stableId, raw),
  onGuestAuthorityMessage: (raw) => guestInboundWire.handleGuestState(raw),
  hydrateHost: hydrateHostFromRtdb,
  subscribeFirebaseConnected: (onOffline) => {
    const connectedRef = dbRef(getMovieVoteDatabase(), '.info/connected')
    return onValue(connectedRef, (snap) => {
      if (snap.val() !== false) return
      onOffline()
    })
  },
})

function destroyWireOnly() {
  const suffix = core.getSuffix()
  const sid = core.getGuestStableId()
  if (!core.isHostRole() && suffix && sid) {
    void guestOnlineWire.markGuestOffline(suffix, sid)
  }

  clearFeatureWireUnsubs()
  resetMovieVoteWireState()
  core.destroyWireOnly()
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
 * @param {string} stableId
 */
function wireGuestWelcome(suffix, stableId) {
  trackFeatureUnsub(
    onValue(roomChild(suffix, `welcome/${stableId}`), (snap) => {
      const raw = snap.val()
      if (raw != null) guestInboundWire.handleGuestWelcome(raw)
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

/**
 * Restore seq, participant slots, and online flags after host reconnect / refresh.
 * @param {string} suffix
 */
async function hydrateHostFromRtdb(suffix) {
  const stateSnap = await get(roomChild(suffix, 'state'))
  const parsed = parseState(stateSnap.val())
  if (parsed) {
    nextSeq = parsed.seq
    roomAuthoritySeq.value = parsed.seq
  }
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
  roomAuthoritySeq.value = 0
  await core.finishHostSession(suffix)
  guestOnlineWire.wireHostGuestOnline(suffix)
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
  roomAuthoritySeq.value = 0
  remoteHostTabVisible.value = true
  await core.establishGuestSession(suffix)
  const stableId = core.getGuestStableId()
  if (!stableId) throw new Error('No active room for that code')
  await guestOnlineWire.markGuestOnline(suffix, stableId)
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
  roomAuthoritySeq.value = 0
}

/** Test-only module instance key for `session.testWireAccess.js`. */
export const MOVIE_VOTE_SESSION_TEST_MODULE_KEY = Symbol('movieVoteSessionTestModuleKey')

registerMovieVoteTestWireAccess(MOVIE_VOTE_SESSION_TEST_MODULE_KEY, () => ({
  core,
  remoteHostTabVisible,
  clearFeatureWireUnsubs,
  resetMovieVoteWireState,
  seedGuestDraft: wireState.seedGuestDraft,
  getGuestDraftReady: wireState.getGuestDraftReady,
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
    roomAuthoritySeq.value = n
  },
  getRoomAuthoritySeq: () => roomAuthoritySeq.value,
  emptyHandlers: () => ({
    applyPublicPayload: () => {},
    onWireTeardown: () => {},
  }),
  setHandlers: (h) => {
    handlers = h
  },
}))

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
