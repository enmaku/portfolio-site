/**
 * PeerJS star topology: one hub peer id (`dperry-gametimer-<suffix>`), guests connect with random ids.
 *
 * If the public PeerJS cloud or STUN is unreliable, you can self-host
 * {@link https://github.com/peers/peerjs-server PeerServer} and point the client at it via `Peer` options,
 * and add TURN for restrictive NATs — still within the PeerJS ecosystem.
 */

import { ref } from 'vue'
import { Notify } from 'quasar'
import Peer from 'peerjs'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import {
  encodeGuestUpdate,
  encodeHostPing,
  encodeHostSnapshot,
  encodeHostVisibility,
  isHostEndedNotice,
  isHostPing,
  MSG_HOST_ENDED,
  parseGuestMessage,
  parseHostMessage,
  parseHostVisibility,
} from './protocol.js'
import {
  fullPeerIdFromSuffix,
  generateRoomSuffix,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from './roomId.js'

/**
 * @typedef {object} GameTimerP2PHandlers
 * @property {() => import('./protocol.js').GameTimerSyncPayload} getSnapshot
 * @property {(snapshot: import('./protocol.js').GameTimerSyncPayload) => void} applySnapshot
 */

/**
 * @typedef {'idle' | 'connecting' | 'reconnecting' | 'hosting' | 'guest_connected'} GameTimerSessionPhase
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

const RECONNECT_MAX_ATTEMPTS = 10
const RECONNECT_BASE_DELAY_MS = 800
const RECONNECT_MAX_DELAY_MS = 5000
const RECONNECT_INITIAL_PAUSE_MS = 1000

/** Reactive session UI state for multiplayer (Vue ref; safe to use outside components). */
export const sessionPhase = ref(/** @type {GameTimerSessionPhase} */ ('idle'))

/** Short user-facing room code while hosting or connected as guest; null when idle. */
export const sessionSuffix = ref(/** @type {string | null} */ (null))

/**
 * Guest only: last host-reported tab visibility (`document.visibilityState === 'visible'` on host).
 * Stays `true` when idle / hosting / unknown.
 */
export const remoteHostTabVisible = ref(true)

const PEER_OPTS = /** @type {const} */ ({
  serialization: 'json',
  reliable: true,
})

/** First connect / resume: allow slow signaling. */
const OPEN_PEER_TIMEOUT_MS = 20000

/** Reconnect loops: fail each try faster so backoff (below) dominates. */
const RECONNECT_PEER_TIMEOUT_MS = 8000

/** Hub → guests while hosting. */
const HEARTBEAT_INTERVAL_MS = 3000

/** Guest: no snapshot or ping from host for this long ⇒ reconnect. */
const HEARTBEAT_STALE_MS = 12_000

/** Guest: how often we check staleness. */
const HEARTBEAT_GUEST_CHECK_MS = 2000

/** @type {ReturnType<typeof setInterval> | null} */
let hostHeartbeatIntervalId = null

/** @type {ReturnType<typeof setInterval> | null} */
let guestHostWatchIntervalId = null

/** @type {(() => void) | null} */
let hostVisibilityTeardown = null

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
  } catch { void 0 }
}

/**
 * Clears persisted host/guest intent from the room session Pinia store.
 * @returns {void}
 */
function clearRoomPersistence() {
  try {
    useGameTimerRoomSessionStore().clear()
  } catch { void 0 }
}

/**
 * Closes PeerJS connections only; phase and suffix are left to the caller.
 * @returns {void}
 */
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

/**
 * @returns {void}
 */
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

/**
 * @param {boolean} visible
 * @returns {void}
 */
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

/**
 * @returns {void}
 */
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

/** @type {number} */
let guestLastHostActivityAt = 0

/**
 * @returns {void}
 */
function touchGuestHostActivity() {
  guestLastHostActivityAt = Date.now()
}

/**
 * @returns {void}
 */
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
    } catch { void 0 }
  }
  hubConnections.clear()
  if (guestHubConn) {
    try {
      guestHubConn.close()
    } catch { void 0 }
    guestHubConn = null
  }
  if (peer && !peer.destroyed) {
    try {
      peer.destroy()
    } catch { void 0 }
  }
  peer = null
  isHost = false
  nextSeq = 0
  lastSeenSeq = 0
}

/**
 * @param {number} attemptAfterFirst Zero-based: delay before attempt 2 uses index 0.
 * @returns {number}
 */
function reconnectDelayMs(attemptAfterFirst) {
  const exp = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** attemptAfterFirst,
    RECONNECT_MAX_DELAY_MS,
  )
  return exp + Math.floor(Math.random() * 400)
}

/**
 * @param {string} [brokerId] When non-empty, open as this broker id (hub). Otherwise random id (guest).
 * @param {number} [timeoutMs=OPEN_PEER_TIMEOUT_MS]
 * @returns {Promise<import('peerjs').Peer>}
 */
function awaitPeerOpen(brokerId, timeoutMs = OPEN_PEER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const pr =
      typeof brokerId === 'string' && brokerId.length > 0 ? new Peer(brokerId) : new Peer()
    const t = window.setTimeout(() => {
      try {
        pr.destroy()
      } catch { void 0 }
      reject(new Error('Peer open timeout'))
    }, timeoutMs)
    pr.on('error', (e) => {
      window.clearTimeout(t)
      try {
        pr.destroy()
      } catch { void 0 }
      reject(e)
    })
    pr.on('open', () => {
      window.clearTimeout(t)
      resolve(pr)
    })
  })
}

/**
 * @param {import('peerjs').Peer} p
 * @returns {void}
 */
function attachHubConnectionHandlers(p) {
  p.on('connection', (conn) => {
    conn.on('open', () => {
      hubConnections.add(conn)
      try {
        const snap = handlers.getSnapshot()
        conn.send(encodeHostSnapshot(snap, ++nextSeq))
        if (typeof document !== 'undefined') {
          conn.send(encodeHostVisibility(document.visibilityState === 'visible'))
        }
      } catch {
        conn.close()
      }
    })
    conn.on('data', (data) => handleHubInbound(conn, data))
    conn.on('close', () => {
      hubConnections.delete(conn)
    })
  })
}

/**
 * @param {import('peerjs').Peer} p
 * @param {string} suffix
 * @returns {void}
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
  try {
    useGameTimerRoomSessionStore().setHost(suffix)
  } catch { void 0 }
}

/**
 * Opens a random guest peer and a DataConnection to the hub id for `suffix`.
 * @param {string} suffix Normalized room suffix.
 * @param {{ peerTimeoutMs?: number }} [opts]
 * @returns {Promise<void>}
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
      } catch { void 0 }
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
    useGameTimerRoomSessionStore().setGuest(suffix)
  } catch { void 0 }
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
 * @param {import('peerjs').DataConnection} conn
 * @param {unknown} raw
 * @returns {void}
 */
function handleHubInbound(conn, raw) {
  const msg = parseGuestMessage(raw)
  if (!msg) return
  try {
    handlers.applySnapshot(msg.snapshot)
  } catch {
    return
  }
  const snap = handlers.getSnapshot()
  const out = encodeHostSnapshot(snap, ++nextSeq)
  for (const c of hubConnections) {
    if (c === conn || !c.open) continue
    c.send(out)
  }
}

/**
 * @param {unknown} raw
 * @returns {void}
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
  const msg = parseHostMessage(raw)
  if (!msg) return
  touchGuestHostActivity()
  if (msg.seq <= lastSeenSeq) return
  lastSeenSeq = msg.seq
  try {
    handlers.applySnapshot(msg.snapshot)
  } catch {
    return
  }
}

/**
 * @param {import('peerjs').Peer} p
 * @returns {void}
 */
function wirePeerErrors(p) {
  p.on('error', () => {
    if (isHost) {
      onHostDisconnected()
    } else {
      onGuestDisconnected()
    }
  })
}

/** Guest hub connection lost (close or peer error); may start silent reconnect. */
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

/** Host peer error; may start silent reconnect. */
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
 * @param {number} gen Captured reconnect generation; superseded when the user leaves or a new disconnect runs.
 * @returns {Promise<void>}
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
 * @param {number} gen Captured reconnect generation; superseded when the user leaves or a new disconnect runs.
 * @returns {Promise<void>}
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
 * Reclaim hosting after refresh (same broker id). Retries if the id is still releasing.
 * @param {string} rawSuffix
 * @param {number} [maxAttempts=10]
 * @returns {Promise<{ suffix: string }>}
 */
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
 * Host a new room; retries if the broker id is already taken.
 * @param {number} [maxAttempts=12]
 * @returns {Promise<{ suffix: string }>}
 */
export async function startAsHost(maxAttempts = 12) {
  reconnectGeneration += 1
  teardownSession()
  sessionPhase.value = 'connecting'

  let lastErr = /** @type {Error | null} */ (null)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = generateRoomSuffix(6)
    const fullId = fullPeerIdFromSuffix(suffix)

    try {
      const p = await awaitPeerOpen(fullId)
      sessionSuffix.value = suffix
      finishHostSession(/** @type {import('peerjs').Peer} */ (p), suffix)
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
  reconnectGeneration += 1
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
 * @param {import('./protocol.js').GameTimerSyncPayload} snapshot
 * @returns {void}
 */
export function broadcastGameTimerSnapshot(snapshot) {
  if (!peer || peer.destroyed) return

  if (isHost) {
    const msg = encodeHostSnapshot(snapshot, ++nextSeq)
    for (const c of hubConnections) {
      if (c.open) c.send(msg)
    }
    return
  }

  if (guestHubConn?.open) {
    guestHubConn.send(encodeGuestUpdate(snapshot))
  }
}

/**
 * Ends the session for this tab: clears phase and suffix, then tears down PeerJS.
 * @returns {void}
 */
export function teardownSession() {
  // Idle first: synchronous connection `close` handlers must not see hosting/guest_connected or they start reconnect.
  sessionPhase.value = 'idle'
  sessionSuffix.value = null
  remoteHostTabVisible.value = true
  destroyWireOnly()
}

/**
 * After {@link teardownSession}: clears the game timer roster (no P2P broadcast; session already idle).
 * @returns {void}
 */
function resetLocalStateAfterRoomExit() {
  teardownSession()
  try {
    useGameTimerStore().clearAllPlayers()
  } catch {
    void 0
  }
}

/**
 * User-initiated exit: notifies guests if hosting, then clears persistence, wire, and local timer state.
 * @returns {void}
 */
export function leaveSession() {
  reconnectGeneration += 1
  clearRoomPersistence()
  if (isHost && sessionPhase.value === 'hosting') {
    const endMsg = { type: MSG_HOST_ENDED }
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

/**
 * @returns {boolean} True when hosting or connected as guest (sync and timers apply).
 */
export function isP2PSessionActive() {
  return sessionPhase.value === 'hosting' || sessionPhase.value === 'guest_connected'
}
