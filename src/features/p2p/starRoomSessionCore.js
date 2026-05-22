/**
 * Store-agnostic star-room session wire core (Game Timer, Movie Vote).
 */

import {
  assertHostRoomClaimable,
  canClaimHostRoom,
  isHostPingPresent,
  isReclaimOwnHostRoom,
  isRoomMarkedEnded,
} from './hostRoomOccupancy.js'

/**
 * @typedef {'idle' | 'connecting' | 'hosting' | 'guest_connected' | 'reconnecting'} StarRoomSessionPhase
 */

/**
 * @typedef {{ type: 'host_ended_room' }} HostEndedRoomEvent
 * @typedef {{ type: 'host_ping_present', present: boolean }} HostPingPresentEvent
 * @typedef {{ type: 'host_tab_visible', visible: boolean }} HostTabVisibleEvent
 * @typedef {{ type: 'connectivity_offline', role: 'host' | 'guest' }} ConnectivityOfflineEvent
 * @typedef {HostEndedRoomEvent | HostPingPresentEvent | HostTabVisibleEvent | ConnectivityOfflineEvent} StarRoomSessionEvent
 */

/**
 * @typedef {object} StarRoomProtocolAdapter
 * @property {(stableId: string) => unknown} encodeGuestHello
 * @property {(raw: unknown) => { visible: boolean } | null} parseHostVisibility
 * @property {(stateVal: unknown) => boolean} hasGuestJoinableState
 * @property {(visible: boolean) => unknown} encodeHostVisibility
 */

/**
 * @typedef {object} StarRoomRtdbPort
 * @property {(ref: unknown) => Promise<{ val: () => unknown }>} get
 * @property {(ref: unknown, value: unknown) => Promise<void>} set
 * @property {(ref: unknown) => Promise<void>} remove
 * @property {(ref: unknown, cb: (snap: { val: () => unknown }) => void) => () => void} onValue
 * @property {(ref: unknown, cb: (snap: { key: string | null, ref: unknown }) => void) => () => void} onChildAdded
 * @property {(ref: unknown) => { remove: () => Promise<void>, set: (value: unknown) => Promise<void> }} onDisconnect
 */

/**
 * @typedef {object} StarRoomSessionCoreOptions
 * @property {'loose' | 'strict'} guestPresence
 * @property {readonly string[]} claimResetPaths
 * @property {() => string} getStableClientId
 * @property {(suffix: string, path: string) => unknown} roomChild
 * @property {StarRoomRtdbPort} rtdb
 * @property {StarRoomProtocolAdapter} protocolAdapter
 * @property {(phase: StarRoomSessionPhase) => void} onPhaseChange
 * @property {(suffix: string | null) => void} onSuffixChange
 * @property {(event: StarRoomSessionEvent) => void} onSessionEvent
 * @property {(stableId: string, raw: unknown) => void} onHostInboxMessage
 * @property {(raw: unknown) => void} onGuestAuthorityMessage
 * @property {(suffix: string) => Promise<void>} hydrateHost
 * @property {(onOffline: () => void) => () => void} subscribeFirebaseConnected
 * @property {() => number} [now]
 */

/**
 * @param {StarRoomSessionCoreOptions} opts
 */
export function createStarRoomSession(opts) {
  const {
    guestPresence,
    claimResetPaths,
    getStableClientId,
    roomChild,
    rtdb,
    protocolAdapter,
    onPhaseChange,
    onSuffixChange,
    onSessionEvent,
    onHostInboxMessage,
    onGuestAuthorityMessage,
    hydrateHost,
    subscribeFirebaseConnected,
    now = () => Date.now(),
  } = opts

  /** @type {StarRoomSessionPhase} */
  let phase = 'idle'
  /** @type {string | null} */
  let suffix = null
  let isHost = false
  /** @type {string | null} */
  let guestStableId = null
  let reconnectGeneration = 0
  /** @type {Array<() => void>} */
  let wireUnsubs = []
  /** @type {(() => void) | null} */
  let hostVisibilityTeardown = null
  let connectivityUnsub = /** @type {(() => void) | null} */ (null)

  /**
   * @param {StarRoomSessionPhase} next
   */
  function setPhase(next) {
    phase = next
    onPhaseChange(next)
  }

  /**
   * @param {string | null} next
   */
  function setSuffix(next) {
    suffix = next
    onSuffixChange(next)
  }

  /**
   * @param {() => void} unsub
   */
  function trackUnsub(unsub) {
    wireUnsubs.push(unsub)
  }

  function clearHostVisibilityWatch() {
    if (hostVisibilityTeardown) {
      hostVisibilityTeardown()
      hostVisibilityTeardown = null
    }
  }

  function clearWireUnsubs() {
    for (const unsub of wireUnsubs) {
      try {
        unsub()
      } catch {
        void 0
      }
    }
    wireUnsubs = []
  }

  function destroyWireOnly() {
    clearHostVisibilityWatch()
    clearWireUnsubs()
    guestStableId = null
    isHost = false
  }

  /**
   * @param {boolean} visible
   */
  function broadcastHostVisibility(visible) {
    if (!isHost || !suffix) return
    rtdb
      .set(roomChild(suffix, 'hostVisible'), protocolAdapter.encodeHostVisibility(visible))
      .catch(() => {})
  }

  function startHostVisibilityWatch() {
    if (typeof document === 'undefined' || hostVisibilityTeardown) return
    const onVis = () => {
      broadcastHostVisibility(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', onVis)
    hostVisibilityTeardown = () => document.removeEventListener('visibilitychange', onVis)
    broadcastHostVisibility(document.visibilityState === 'visible')
  }

  function wireDatabaseConnectivity() {
    if (connectivityUnsub) return
    connectivityUnsub = subscribeFirebaseConnected(() => {
      if (isHost && phase === 'hosting') onHostDisconnected()
      else if (!isHost && phase === 'guest_connected') onGuestDisconnected()
    })
    trackUnsub(() => {
      if (connectivityUnsub) connectivityUnsub()
      connectivityUnsub = null
    })
  }

  function handleGuestHostEnded() {
    onSessionEvent({ type: 'host_ended_room' })
  }

  /**
   * @param {string} roomSuffix
   */
  async function clearRoomEnded(roomSuffix) {
    await rtdb.remove(roomChild(roomSuffix, 'ended')).catch(() => {})
  }

  /**
   * @param {string} roomSuffix
   */
  async function resetStaleRoomRtdbForClaim(roomSuffix) {
    await Promise.all(
      claimResetPaths.map((path) => rtdb.remove(roomChild(roomSuffix, path)).catch(() => {})),
    )
  }

  /**
   * @param {string} roomSuffix
   */
  async function registerHostOnDisconnect(roomSuffix) {
    try {
      await rtdb.onDisconnect(roomChild(roomSuffix, 'hostPing')).remove()
    } catch {
      void 0
    }
  }

  /**
   * @param {string} roomSuffix
   * @returns {Promise<boolean>}
   */
  async function tryClaimHostRoom(roomSuffix) {
    const stableClientId = getStableClientId()
    const [pingSnap, endedSnap, hostClientSnap] = await Promise.all([
      rtdb.get(roomChild(roomSuffix, 'hostPing')),
      rtdb.get(roomChild(roomSuffix, 'ended')),
      rtdb.get(roomChild(roomSuffix, 'hostClientId')),
    ])
    const pingVal = pingSnap.val()
    const endedVal = endedSnap.val()
    if (
      !canClaimHostRoom(pingVal, endedVal, {
        hostClientId: hostClientSnap.val(),
        stableClientId,
      })
    ) {
      return false
    }

    const reclaimOwn = isReclaimOwnHostRoom(hostClientSnap.val(), endedVal, stableClientId)

    await rtdb.set(roomChild(roomSuffix, 'hostPing'), now())
    await rtdb.set(roomChild(roomSuffix, 'hostClientId'), stableClientId)
    if (!reclaimOwn) {
      await resetStaleRoomRtdbForClaim(roomSuffix)
    }
    return true
  }

  /**
   * @param {string} roomSuffix
   */
  async function assertHostRoomReclaimable(roomSuffix) {
    const stableClientId = getStableClientId()
    const [pingSnap, endedSnap, hostClientSnap] = await Promise.all([
      rtdb.get(roomChild(roomSuffix, 'hostPing')),
      rtdb.get(roomChild(roomSuffix, 'ended')),
      rtdb.get(roomChild(roomSuffix, 'hostClientId')),
    ])
    assertHostRoomClaimable(pingSnap.val(), endedSnap.val(), {
      hostClientId: hostClientSnap.val(),
      stableClientId,
    })
  }

  /**
   * @param {string} roomSuffix
   */
  function wireHostRoom(roomSuffix) {
    wireDatabaseConnectivity()

    const inboxRef = roomChild(roomSuffix, 'inbox')
    trackUnsub(
      rtdb.onChildAdded(inboxRef, (snap) => {
        const stableId = snap.key
        if (!stableId) return
        const itemRef = snap.ref
        trackUnsub(
          rtdb.onValue(itemRef, (itemSnap) => {
            const val = itemSnap.val()
            if (val != null) onHostInboxMessage(stableId, val)
          }),
        )
      }),
    )
  }

  /**
   * @param {string} roomSuffix
   */
  function wireGuestRoom(roomSuffix) {
    wireDatabaseConnectivity()

    trackUnsub(
      rtdb.onValue(roomChild(roomSuffix, 'state'), (snap) => {
        const raw = snap.val()
        if (raw != null) onGuestAuthorityMessage(raw)
      }),
    )

    trackUnsub(
      rtdb.onValue(roomChild(roomSuffix, 'ended'), (snap) => {
        if (isRoomMarkedEnded(snap.val())) handleGuestHostEnded()
      }),
    )

    if (guestPresence === 'loose') {
      trackUnsub(
        rtdb.onValue(roomChild(roomSuffix, 'hostPing'), (snap) => {
          onSessionEvent({ type: 'host_ping_present', present: isHostPingPresent(snap.val()) })
        }),
      )
    }

    trackUnsub(
      rtdb.onValue(roomChild(roomSuffix, 'hostVisible'), (snap) => {
        const vis = protocolAdapter.parseHostVisibility(snap.val())
        if (!vis) return
        onSessionEvent({ type: 'host_tab_visible', visible: vis.visible })
      }),
    )
  }

  /**
   * @param {string} roomSuffix
   */
  async function finishHostSession(roomSuffix) {
    await assertHostRoomReclaimable(roomSuffix)
    await clearRoomEnded(roomSuffix)
    isHost = true
    setSuffix(roomSuffix)
    await hydrateHost(roomSuffix)
    wireHostRoom(roomSuffix)
    setPhase('hosting')
    startHostVisibilityWatch()
    await rtdb.set(roomChild(roomSuffix, 'hostPing'), now())
    await rtdb.set(roomChild(roomSuffix, 'hostClientId'), getStableClientId())
    await registerHostOnDisconnect(roomSuffix)
  }

  /**
   * @param {string} roomSuffix
   */
  async function establishGuestSession(roomSuffix) {
    const [pingSnap, endedSnap, stateSnap] = await Promise.all([
      rtdb.get(roomChild(roomSuffix, 'hostPing')),
      rtdb.get(roomChild(roomSuffix, 'ended')),
      rtdb.get(roomChild(roomSuffix, 'state')),
    ])

    if (isRoomMarkedEnded(endedSnap.val())) {
      throw new Error('No active room for that code')
    }

    const hostPingPresent = isHostPingPresent(pingSnap.val())
    const hasRoomState = protocolAdapter.hasGuestJoinableState(stateSnap.val())
    if (!hostPingPresent && !hasRoomState) {
      throw new Error('No active room for that code')
    }

    guestStableId = getStableClientId()
    isHost = false
    setSuffix(roomSuffix)
    if (guestPresence === 'loose') {
      onSessionEvent({ type: 'host_ping_present', present: hostPingPresent })
    }

    wireGuestRoom(roomSuffix)
    await rtdb.set(
      roomChild(roomSuffix, `inbox/${guestStableId}`),
      protocolAdapter.encodeGuestHello(guestStableId),
    )

    setPhase('guest_connected')
  }

  function onGuestDisconnected() {
    if (isHost) return
    if (phase !== 'guest_connected') return
    if (!suffix) {
      destroyWireOnly()
      setPhase('idle')
      return
    }
    reconnectGeneration += 1
    destroyWireOnly()
    setPhase('reconnecting')
    onSessionEvent({ type: 'connectivity_offline', role: 'guest' })
  }

  function onHostDisconnected() {
    if (!isHost) return
    if (phase !== 'hosting') return
    if (!suffix) {
      destroyWireOnly()
      setPhase('idle')
      return
    }
    reconnectGeneration += 1
    destroyWireOnly()
    setPhase('reconnecting')
    onSessionEvent({ type: 'connectivity_offline', role: 'host' })
  }

  function teardownSession() {
    setPhase('idle')
    setSuffix(null)
    destroyWireOnly()
  }

  function leaveSession() {
    reconnectGeneration += 1
    if (isHost && phase === 'hosting' && suffix) {
      const roomSuffix = suffix
      rtdb.set(roomChild(roomSuffix, 'ended'), now()).catch(() => {})
      rtdb.remove(roomChild(roomSuffix, 'hostPing')).catch(() => {})
    }
    teardownSession()
  }

  return {
    tryClaimHostRoom,
    finishHostSession,
    establishGuestSession,
    destroyWireOnly,
    teardownSession,
    leaveSession,
    onGuestDisconnected,
    onHostDisconnected,
    getPhase: () => phase,
    getSuffix: () => suffix,
    isHostRole: () => isHost,
    getGuestStableId: () => guestStableId,
    getReconnectGeneration: () => reconnectGeneration,
    bumpReconnectGeneration: () => {
      reconnectGeneration += 1
    },
    setPhase,
    setSuffix,
    broadcastHostVisibility,
    startHostVisibilityWatch,
    clearHostVisibilityWatch,
    writeGuestInbox: (payload) => {
      if (!guestStableId || !suffix) return
      rtdb.set(roomChild(suffix, `inbox/${guestStableId}`), payload).catch(() => {})
    },
    writeHostPing: () => {
      if (!isHost || !suffix) return
      rtdb.set(roomChild(suffix, 'hostPing'), now()).catch(() => {})
    },
    writeHostClientId: () => {
      if (!isHost || !suffix) return
      rtdb.set(roomChild(suffix, 'hostClientId'), getStableClientId()).catch(() => {})
    },
  }
}
