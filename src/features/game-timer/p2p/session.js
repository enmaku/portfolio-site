/**
 * Firebase RTDB star hub for Game Timer (`gameTimerRooms/<suffix>`).
 *
 * Production code imports this module only. Tests use `session.testExports.js` and
 * `session.testWireAccess.js` for facade contract helpers.
 */

import { ref } from 'vue'
import { Notify } from 'quasar'
import {
  child,
  get,
  onChildAdded,
  onValue,
  onDisconnect,
  ref as dbRef,
  remove,
} from 'firebase/database'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { getGameTimerDatabase, gameTimerRoomRef, setRtdb } from '../firebase/rtdb.js'
import {
  runGuestStarReconnectLoop,
  runHostStarReconnectLoop,
} from '../../p2p/starRoomShell.js'
import { createStarRoomSession } from '../../p2p/starRoomSessionCore.js'
import { deriveStableHostSuffix, getStableClientId } from '../../p2p/identity.js'
import {
  encodeGuestHello,
  encodeGuestUpdate,
  encodeHostSnapshot,
  encodeHostVisibility,
  isHostEndedNotice,
  isHostPing,
  isRecord,
  MSG_GUEST_UPDATE,
  parseGuestHello,
  parseGuestMessage,
  parseHostMessage,
  parseHostVisibility,
} from './protocol.js'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'
import {
  generateRoomSuffix,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from './roomId.js'
import {
  authoritativeSnapshotAfterGuestMessage,
  createGuestIntentDeduper,
} from './guestIntentDedupe.js'
import { registerGameTimerTestWireAccess } from './session.testWireAccess.js'

const STABLE_HOST_SUFFIX_APP = 'gametimer'

/** @type {ReturnType<typeof createGuestIntentDeduper>} */
let hostGuestIntentDeduper = createGuestIntentDeduper()

/**
 * @typedef {object} GameTimerP2PHandlers
 * @property {() => GameTimerSyncPayload} getSnapshot
 * @property {(snapshot: GameTimerSyncPayload) => void} applySnapshot
 */

/** @type {GameTimerP2PHandlers} */
let handlers = {
  getSnapshot: () => ({
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  }),
  applySnapshot: () => {},
}

let nextSeq = 0

let lastSeenSeq = 0

/** Reactive session UI state for multiplayer (Vue ref; safe to use outside components). */
export const sessionPhase = ref(/** @type {GameTimerSessionPhase} */ ('idle'))

/** Short user-facing room code while hosting or connected as guest; null when idle. */
export const sessionSuffix = ref(/** @type {string | null} */ (null))

/**
 * Guest only: last host-reported tab visibility (`document.visibilityState === 'visible'` on host).
 * Stays `true` when idle / hosting / unknown.
 */
export const remoteHostTabVisible = ref(true)

/**
 * Guest only: host has an active `hostPing` in RTDB (tab connected as host).
 * Stays `true` when idle / hosting / unknown.
 */
export const remoteHostPresent = ref(true)

/**
 * @param {string} suffix
 * @param {string} path
 */
function roomChild(suffix, path) {
  return child(gameTimerRoomRef(suffix), path)
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
  guestPresence: 'loose',
  claimResetPaths: ROOM_CLAIM_RESET_PATHS,
  getStableClientId,
  roomChild,
  rtdb: rtdbPort,
  protocolAdapter: {
    encodeGuestHello,
    parseHostVisibility,
    hasGuestJoinableState: (stateVal) => parseHostMessage(stateVal) != null,
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
    if (event.type === 'host_ping_present') {
      remoteHostPresent.value = event.present
      return
    }
    if (event.type === 'host_tab_visible') {
      remoteHostTabVisible.value = event.visible
      return
    }
    if (event.type === 'connectivity_offline') {
      if (event.role === 'guest') {
        const suffix = core.getSuffix()
        if (suffix) void guestReconnectLoop(suffix, core.getReconnectGeneration())
      } else {
        const suffix = core.getSuffix()
        if (suffix) void hostReconnectLoop(suffix, core.getReconnectGeneration())
      }
    }
  },
  onHostInboxMessage: (stableId, raw) => handleHostInboxMessage(stableId, raw),
  onGuestAuthorityMessage: (raw) => handleGuestInbound(raw),
  hydrateHost: hydrateHostFromRtdb,
  subscribeFirebaseConnected: (onOffline) => {
    const connectedRef = dbRef(getGameTimerDatabase(), '.info/connected')
    return onValue(connectedRef, (snap) => {
      if (snap.val() !== false) return
      onOffline()
    })
  },
})

/**
 * @param {string} message
 * @param {'positive' | 'negative' | 'warning' | 'info'} [type='info']
 * @param {{ timeout?: number, classes?: string }} [opts]
 * @returns {void}
 */
function notifyP2P(message, type = 'info', opts = {}) {
  const fallback = type === 'negative' ? 4500 : 2800
  const timeout = typeof opts.timeout === 'number' ? opts.timeout : fallback
  const classes = opts.classes ? `gt-notify ${opts.classes}` : 'gt-notify'
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
    useGameTimerRoomSessionStore().clear()
  } catch {
    void 0
  }
}

function resetHostGuestWireState() {
  nextSeq = 0
  lastSeenSeq = 0
  hostGuestIntentDeduper = createGuestIntentDeduper()
}

function destroyWireOnly() {
  resetHostGuestWireState()
  core.destroyWireOnly()
}

function hostPublishSnapshot(snapshot) {
  if (!core.isHostRole() || !sessionSuffix.value) return
  const msg = encodeHostSnapshot(snapshot, ++nextSeq)
  setRtdb(roomChild(sessionSuffix.value, 'state'), msg).catch(() => {})
}

/**
 * @param {string} stableId
 */
function onGuestHello(stableId) {
  if (!core.isHostRole() || !sessionSuffix.value) return
  void stableId
  try {
    hostPublishSnapshot(handlers.getSnapshot())
  } catch {
    void 0
  }
}

/**
 * @param {string} stableId
 * @param {unknown} raw
 */
function handleHostInboxMessage(stableId, raw) {
  const hello = parseGuestHello(raw)
  if (hello) {
    if (hello.stableId !== stableId) return
    onGuestHello(stableId)
    return
  }

  const msg = parseGuestMessage(raw)
  if (!msg) {
    if (
      isRecord(raw) &&
      raw.type === MSG_GUEST_UPDATE &&
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.DEV
    ) {
      console.warn('[gameTimer P2P] invalid guest update ignored')
    }
    return
  }

  const now = Date.now()
  /** @type {{ broadcastSnapshot: GameTimerSyncPayload, appliedGuestSnapshot: boolean } | null} */
  let mergeResult = null
  try {
    mergeResult = authoritativeSnapshotAfterGuestMessage(
      msg,
      hostGuestIntentDeduper,
      now,
      (s) => handlers.applySnapshot(s),
      () => handlers.getSnapshot(),
    )
    if (
      !mergeResult.appliedGuestSnapshot &&
      msg.intent &&
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.DEV
    ) {
      console.debug('[gameTimer P2P] suppressed duplicate guest intent', msg.intent.kind)
    }
  } catch {
    return
  }

  // Guest hello still publishes via onGuestHello above; only rebroadcast when an update intent applied.
  if (mergeResult.appliedGuestSnapshot) {
    hostPublishSnapshot(mergeResult.broadcastSnapshot)
  }
}

function handleGuestHostEnded() {
  notifyP2P('The host ended the room.', 'info')
  core.bumpReconnectGeneration()
  clearRoomPersistence()
  teardownSession()
}

/**
 * @param {string} suffix
 */
async function hydrateHostFromRtdb(suffix) {
  const stateSnap = await get(roomChild(suffix, 'state'))
  const parsed = parseHostMessage(stateSnap.val())
  if (!parsed) return
  nextSeq = parsed.seq
  try {
    handlers.applySnapshot(parsed.snapshot)
  } catch {
    void 0
  }
}

/**
 * @param {string} suffix
 */
async function finishHostSession(suffix) {
  resetHostGuestWireState()
  await core.finishHostSession(suffix)
  try {
    useGameTimerRoomSessionStore().setHost(suffix)
  } catch {
    void 0
  }
  hostPublishSnapshot(handlers.getSnapshot())
}

/**
 * @param {string} suffix
 */
async function establishGuestSession(suffix) {
  lastSeenSeq = 0
  remoteHostTabVisible.value = true
  await core.establishGuestSession(suffix)
  try {
    useGameTimerRoomSessionStore().setGuest(suffix)
  } catch {
    void 0
  }
}

/**
 * Installed once by the Pinia bridge; supplies snapshot read/apply for the wire.
 * @param {Partial<GameTimerP2PHandlers>} h
 * @returns {void}
 */
export function bindGameTimerP2PHandlers(h) {
  handlers = { ...handlers, ...h }
}

/**
 * Dispatches inbound hub messages on the guest: room ended, ping, visibility, or sequenced snapshot.
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
  const msg = parseHostMessage(raw)
  if (!msg) {
    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.DEV &&
      isRecord(raw) &&
      typeof raw.seq === 'number'
    ) {
      console.warn('[gameTimer P2P] ignored host state update (invalid or incomplete snapshot)')
    }
    return
  }
  if (msg.seq <= lastSeenSeq) return
  lastSeenSeq = msg.seq
  try {
    handlers.applySnapshot(msg.snapshot)
  } catch {
    return
  }
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
 * @returns {string[]}
 */
function hostStartSuffixOrder() {
  const preferred = deriveStableHostSuffix(STABLE_HOST_SUFFIX_APP, 6)
  const order = [preferred]
  try {
    const saved = useGameTimerRoomSessionStore().suffix
    const norm = saved ? normalizeRoomSuffixInput(saved) : ''
    if (norm && isValidRoomSuffix(norm) && norm !== preferred) order.push(norm)
  } catch {
    void 0
  }
  return order
}

/**
 * Reclaim hosting after refresh (same room suffix). Retries on transient failures.
 * @param {string} rawSuffix
 * @param {number} [maxAttempts=10]
 * @returns {Promise<{ suffix: string }>}
 */
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

/**
 * After navigation or first paint: resume host or guest from persisted {@link useGameTimerRoomSessionStore}.
 * No-op if Pinia is unavailable, nothing persisted, or `sessionPhase` is not `idle`.
 * @returns {void}
 */
export function resumeP2PSessionIfNeeded() {
  let rs
  try {
    rs = useGameTimerRoomSessionStore()
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
 * Host a new room; retries if the suffix is already claimed.
 * @param {number} [maxAttempts=12]
 * @returns {Promise<{ suffix: string }>}
 */
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

/**
 * Join an existing room by short suffix (user-facing code).
 * @param {string} rawSuffix
 * @returns {Promise<void>}
 */
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
 * Push current snapshot to peers (after a local store mutation).
 * @param {GameTimerSyncPayload} snapshot
 * @param {{ kind: 'selectPlayer' | 'registerHardPass', playerId: string, sentAt: number } | undefined} [intent] guest → host only
 * @returns {void}
 */
export function broadcastGameTimerSnapshot(snapshot, intent) {
  const suffix = sessionSuffix.value
  if (!suffix) return

  if (core.isHostRole()) {
    hostPublishSnapshot(snapshot)
    return
  }

  const guestId = core.getGuestStableId()
  if (guestId) {
    core.writeGuestInbox(encodeGuestUpdate(snapshot, intent))
  }
}

/**
 * Ends the session for this tab: clears phase and suffix, then tears down RTDB listeners.
 * Does not reset host/guest seq counters or handler bindings — use `session.testExports.js`
 * when reusing one module instance in tests.
 * @returns {void}
 */
export function teardownSession() {
  remoteHostTabVisible.value = true
  remoteHostPresent.value = true
  core.teardownSession()
}

/** @returns {import('../types.js').GameTimerSyncPayload} */
function emptyGameTimerSnapshot() {
  return {
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  }
}

/** Test-only module instance key for `session.testWireAccess.js`. */
export const GAME_TIMER_SESSION_TEST_MODULE_KEY = Symbol('gameTimerSessionTestModuleKey')

registerGameTimerTestWireAccess(GAME_TIMER_SESSION_TEST_MODULE_KEY, () => ({
  core,
  remoteHostTabVisible,
  remoteHostPresent,
  resetHostGuestWireState,
  emptyHandlers: () => ({
    getSnapshot: () => emptyGameTimerSnapshot(),
    applySnapshot: () => {},
  }),
  setHandlers: (h) => {
    handlers = h
  },
}))

/**
 * User-initiated exit: signals guests via RTDB if hosting, clears persisted room role, then tears down.
 * Does not clear the game timer roster; explicit UI reset or a successful join snapshot still do.
 * @returns {void}
 */
export function leaveSession() {
  clearRoomPersistence()
  core.leaveSession()
}

/**
 * True while this tab is the room hub or a connected guest (store sync is active).
 * @returns {boolean}
 */
export function isP2PSessionActive() {
  return sessionPhase.value === 'hosting' || sessionPhase.value === 'guest_connected'
}
