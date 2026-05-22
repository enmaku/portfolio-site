import assert from 'node:assert/strict'
import test from 'node:test'
import { createStarRoomSession } from './starRoomSessionCore.js'

/**
 * @param {Record<string, unknown>} [seed]
 */
function createFakeRtdb(seed = {}) {
  /** @type {Map<string, unknown>} */
  const data = new Map(Object.entries(seed))
  /** @type {Map<string, Set<(snap: { val: () => unknown }) => void>>} */
  const valueListeners = new Map()
  /** @type {Map<string, { remove?: () => Promise<void>, set?: (v: unknown) => Promise<void> }>} */
  const onDisconnectHandlers = new Map()

  /**
   * @param {string} path
   */
  function emitValue(path) {
    const cbs = valueListeners.get(path)
    if (!cbs) return
    const snap = { val: () => (data.has(path) ? data.get(path) : null) }
    for (const cb of cbs) cb(snap)
  }

  /**
   * @param {string} suffix
   * @param {string} child
   */
  function roomPath(suffix, child) {
    return `rooms/${suffix}/${child}`
  }

  /**
   * @param {string} suffix
   * @param {string} child
   */
  function roomRef(suffix, child) {
    return { path: roomPath(suffix, child), key: child }
  }

  return {
    data,
    onDisconnectHandlers,
    roomRef,
    /**
     * @param {string} path
     */
    async triggerOnDisconnect(path) {
      const h = onDisconnectHandlers.get(path)
      if (!h) return
      if (h.remove) await h.remove()
      if (h.set) await h.set(Date.now())
    },
    port: {
      /**
       * @param {{ path: string }} ref
       */
      async get(ref) {
        return { val: () => (data.has(ref.path) ? data.get(ref.path) : null) }
      },
      /**
       * @param {{ path: string }} ref
       * @param {unknown} value
       */
      async set(ref, value) {
        data.set(ref.path, value)
        emitValue(ref.path)
      },
      /**
       * @param {{ path: string }} ref
       */
      async remove(ref) {
        data.delete(ref.path)
        emitValue(ref.path)
      },
      /**
       * @param {{ path: string }} ref
       * @param {(snap: { val: () => unknown }) => void} cb
       */
      onValue(ref, cb) {
        const path = ref.path
        if (!valueListeners.has(path)) valueListeners.set(path, new Set())
        valueListeners.get(path).add(cb)
        cb({ val: () => (data.has(path) ? data.get(path) : null) })
        return () => valueListeners.get(path)?.delete(cb)
      },
      /**
       * @param {{ path: string }} ref
       */
      onChildAdded() {
        return () => {}
      },
      /**
       * @param {{ path: string }} ref
       */
      onDisconnect(ref) {
        const path = ref.path
        const handler = {
          remove: () => {
            onDisconnectHandlers.set(path, {
              remove: async () => {
                data.delete(path)
                emitValue(path)
              },
            })
            return Promise.resolve()
          },
          set: (v) => {
            const value = v
            onDisconnectHandlers.set(path, {
              set: async () => {
                data.set(path, value)
                emitValue(path)
              },
            })
            return Promise.resolve()
          },
        }
        return handler
      },
    },
    /**
     * @param {string} suffix
     * @param {string} child
     */
    roomChild(suffix, child) {
      return roomRef(suffix, child)
    },
  }
}

/**
 * @param {Partial<import('./starRoomSessionCore.js').StarRoomSessionCoreOptions>} [overrides]
 */
function createLooseSession(overrides = {}) {
  const fake = createFakeRtdb()
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []

  const session = createStarRoomSession({
    guestPresence: 'loose',
    claimResetPaths: ['inbox', 'state', 'ended', 'hostVisible'],
    getStableClientId: () => 'host-client-a',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ type: 'hello', stableId: id }),
      parseHostVisibility: (raw) =>
        raw && typeof raw === 'object' && 'visible' in raw
          ? { visible: Boolean(/** @type {{ visible: unknown }} */ (raw).visible) }
          : null,
      hasGuestJoinableState: (stateVal) =>
        stateVal != null && typeof stateVal === 'object' && 'seq' in stateVal,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => events.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
    now: () => 1_000_000,
    ...overrides,
  })

  return { session, fake, events }
}

test('tryClaimHostRoom rejects when suffix occupied by another host', async () => {
  const { session, fake } = createLooseSession()
  const suffix = 'ABC123'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 999_999)
  fake.data.set(fake.roomRef(suffix, 'hostClientId').path, 'other-host')

  const ok = await session.tryClaimHostRoom(suffix)
  assert.equal(ok, false)
})

test('tryClaimHostRoom clears claim reset paths on fresh claim', async () => {
  const { session, fake } = createLooseSession({ getStableClientId: () => 'new-host' })
  const suffix = 'NEW001'
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 1 })
  fake.data.set(fake.roomRef(suffix, 'ended').path, 1)
  fake.data.set(fake.roomRef(suffix, 'hostVisible').path, { visible: false })

  assert.equal(await session.tryClaimHostRoom(suffix), true)
  assert.equal(fake.data.has(fake.roomRef(suffix, 'state').path), false)
  assert.equal(fake.data.has(fake.roomRef(suffix, 'ended').path), false)
  assert.ok(fake.data.has(fake.roomRef(suffix, 'hostPing').path))
  assert.equal(fake.data.get(fake.roomRef(suffix, 'hostClientId').path), 'new-host')
})

test('tryClaimHostRoom preserves payload on host reclaim', async () => {
  const { session, fake } = createLooseSession({ getStableClientId: () => 'host-client-a' })
  const suffix = 'RECLM1'
  fake.data.set(fake.roomRef(suffix, 'hostClientId').path, 'host-client-a')
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 9, snapshot: { ok: true } })

  assert.equal(await session.tryClaimHostRoom(suffix), true)
  assert.deepEqual(fake.data.get(fake.roomRef(suffix, 'state').path), {
    seq: 9,
    snapshot: { ok: true },
  })
})

test('finishHostSession rejects when occupancy guard fails', async () => {
  const { session, fake } = createLooseSession()
  const suffix = 'OCCUPY'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 999_999)
  fake.data.set(fake.roomRef(suffix, 'hostClientId').path, 'rival-host')

  await assert.rejects(() => session.finishHostSession(suffix), /Room code in use/)
})

test('finishHostSession registers host abrupt disconnect handlers', async () => {
  const { session, fake } = createLooseSession()
  const suffix = 'DISC01'
  await session.finishHostSession(suffix)

  assert.ok(fake.onDisconnectHandlers.has(fake.roomRef(suffix, 'hostPing').path))
  assert.ok(fake.onDisconnectHandlers.has(fake.roomRef(suffix, 'ended').path))

  await fake.triggerOnDisconnect(fake.roomRef(suffix, 'hostPing').path)
  await fake.triggerOnDisconnect(fake.roomRef(suffix, 'ended').path)

  assert.equal(fake.data.has(fake.roomRef(suffix, 'hostPing').path), false)
  assert.ok(fake.data.has(fake.roomRef(suffix, 'ended').path))
})

test('loose guest observes ended but not teardown on hostPing removal', async () => {
  const fake = createFakeRtdb()
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []
  const session = createStarRoomSession({
    guestPresence: 'loose',
    claimResetPaths: [],
    getStableClientId: () => 'guest-1',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: (v) => v != null,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => events.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
  })

  const suffix = 'GUEST1'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 500)
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 1 })

  await session.establishGuestSession(suffix)
  assert.equal(session.getPhase(), 'guest_connected')

  await fake.port.set(fake.roomRef(suffix, 'ended'), 1_700_000_000_000)
  assert.ok(events.some((e) => e.type === 'host_ended_room'))

  events.length = 0
  await fake.port.remove(fake.roomRef(suffix, 'hostPing'))
  assert.ok(events.some((e) => e.type === 'host_ping_present' && e.present === false))
  assert.ok(!events.some((e) => e.type === 'host_ended_room'))
  assert.equal(session.getPhase(), 'guest_connected')
})

test('establishGuestSession rejects ended or empty room', async () => {
  const { session, fake } = createLooseSession({ getStableClientId: () => 'guest-x' })
  const suffix = 'EMPTY1'
  fake.data.set(fake.roomRef(suffix, 'ended').path, 1)

  await assert.rejects(
    () => session.establishGuestSession(suffix),
    /No active room/,
  )

  fake.data.delete(fake.roomRef(suffix, 'ended').path)
  await assert.rejects(
    () => session.establishGuestSession(suffix),
    /No active room/,
  )
})

test('connectivity offline moves guest to reconnecting', async () => {
  /** @type {() => void} */
  let offlineCb = () => {}
  const fake = createFakeRtdb()
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []
  const session = createStarRoomSession({
    guestPresence: 'loose',
    claimResetPaths: [],
    getStableClientId: () => 'guest-1',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: () => true,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => events.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: (cb) => {
      offlineCb = cb
      return () => {}
    },
  })

  const suffix = 'RCONN1'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 1)
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 1 })
  await session.establishGuestSession(suffix)
  offlineCb()

  assert.equal(session.getPhase(), 'reconnecting')
  assert.ok(events.some((e) => e.type === 'connectivity_offline' && e.role === 'guest'))
})

test('host leaveSession marks ended and clears hostPing', async () => {
  const { session, fake } = createLooseSession()
  const suffix = 'LEAVE1'
  await session.finishHostSession(suffix)
  session.leaveSession()

  assert.ok(fake.data.has(fake.roomRef(suffix, 'ended').path))
  assert.equal(fake.data.has(fake.roomRef(suffix, 'hostPing').path), false)
  assert.equal(session.getPhase(), 'idle')
})

test('finishHostSession resumes host reclaim without clearing state', async () => {
  const { session, fake } = createLooseSession({ getStableClientId: () => 'host-client-a' })
  const suffix = 'RESUME1'
  fake.data.set(fake.roomRef(suffix, 'hostClientId').path, 'host-client-a')
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 3, snapshot: { ok: true } })
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 1)

  await session.finishHostSession(suffix)

  assert.equal(session.getPhase(), 'hosting')
  assert.deepEqual(fake.data.get(fake.roomRef(suffix, 'state').path), {
    seq: 3,
    snapshot: { ok: true },
  })
})

test('loose guest receives host_ended_room after host abrupt disconnect', async () => {
  const fake = createFakeRtdb()
  const suffix = 'ABRUPT'
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const guestEvents = []

  const host = createStarRoomSession({
    guestPresence: 'loose',
    claimResetPaths: ['inbox', 'state', 'ended', 'hostVisible'],
    getStableClientId: () => 'host-client-a',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: (v) => v != null,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: () => {},
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
    now: () => 2_000_000,
  })

  await host.finishHostSession(suffix)

  const guest = createStarRoomSession({
    guestPresence: 'loose',
    claimResetPaths: [],
    getStableClientId: () => 'guest-1',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: (v) => v != null,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => guestEvents.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
  })

  await guest.establishGuestSession(suffix)
  guestEvents.length = 0

  await fake.triggerOnDisconnect(fake.roomRef(suffix, 'hostPing').path)
  await fake.triggerOnDisconnect(fake.roomRef(suffix, 'ended').path)

  assert.ok(guestEvents.some((e) => e.type === 'host_ended_room'))
  assert.equal(guest.getPhase(), 'guest_connected')
})

test('connectivity offline moves host to reconnecting', async () => {
  /** @type {() => void} */
  let offlineCb = () => {}
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []
  const { session } = createLooseSession({
    subscribeFirebaseConnected: (cb) => {
      offlineCb = cb
      return () => {}
    },
    onSessionEvent: (e) => events.push(e),
  })

  await session.finishHostSession('HOSTOFF')
  offlineCb()

  assert.equal(session.getPhase(), 'reconnecting')
  assert.ok(events.some((e) => e.type === 'connectivity_offline' && e.role === 'host'))
})

/**
 * @param {Partial<import('./starRoomSessionCore.js').StarRoomSessionCoreOptions>} [overrides]
 */
function createStrictSession(overrides = {}) {
  return createLooseSession({ guestPresence: 'strict', ...overrides })
}

test('strict guest ends room when hostPing clears after it was seen', async () => {
  const fake = createFakeRtdb()
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []
  const session = createStarRoomSession({
    guestPresence: 'strict',
    claimResetPaths: [],
    getStableClientId: () => 'guest-strict',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: (v) => v != null,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => events.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
  })

  const suffix = 'STRICT1'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 900)
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 1 })

  await session.establishGuestSession(suffix)
  events.length = 0

  await fake.port.remove(fake.roomRef(suffix, 'hostPing'))
  assert.ok(events.some((e) => e.type === 'host_ended_room'))
  assert.ok(!events.some((e) => e.type === 'host_ping_present'))
})

test('strict finishHostSession rejects occupied suffix on resume', async () => {
  const { session, fake } = createStrictSession({ getStableClientId: () => 'resume-host' })
  const suffix = 'RESUME2'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 999_999)
  fake.data.set(fake.roomRef(suffix, 'hostClientId').path, 'other-host')

  await assert.rejects(() => session.finishHostSession(suffix), /Room code in use/)
})

test('strict guest ignores hostPing loss before ping was ever seen', async () => {
  const fake = createFakeRtdb()
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []
  const session = createStarRoomSession({
    guestPresence: 'strict',
    claimResetPaths: [],
    getStableClientId: () => 'guest-strict',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: (v) => v != null,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => events.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
  })

  const suffix = 'STRICT0'
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 1 })

  await session.establishGuestSession(suffix)
  events.length = 0

  await fake.port.remove(fake.roomRef(suffix, 'hostPing'))
  assert.ok(!events.some((e) => e.type === 'host_ended_room'))
  assert.equal(session.getPhase(), 'guest_connected')
})

test('destroyWireOnly resets strict hostPing seen tracking for re-establish', async () => {
  const fake = createFakeRtdb()
  /** @type {import('./starRoomSessionCore.js').StarRoomSessionEvent[]} */
  const events = []
  const session = createStarRoomSession({
    guestPresence: 'strict',
    claimResetPaths: [],
    getStableClientId: () => 'guest-strict',
    roomChild: fake.roomChild,
    rtdb: fake.port,
    protocolAdapter: {
      encodeGuestHello: (id) => ({ hello: id }),
      parseHostVisibility: () => null,
      hasGuestJoinableState: (v) => v != null,
      encodeHostVisibility: (visible) => ({ visible }),
    },
    onPhaseChange: () => {},
    onSuffixChange: () => {},
    onSessionEvent: (e) => events.push(e),
    onHostInboxMessage: () => {},
    onGuestAuthorityMessage: () => {},
    hydrateHost: async () => {},
    subscribeFirebaseConnected: () => () => {},
  })

  const suffix = 'STRICT2'
  fake.data.set(fake.roomRef(suffix, 'hostPing').path, 900)
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 1 })

  await session.establishGuestSession(suffix)
  await fake.port.remove(fake.roomRef(suffix, 'hostPing'))
  assert.ok(events.some((e) => e.type === 'host_ended_room'))

  events.length = 0
  session.destroyWireOnly()
  fake.data.set(fake.roomRef(suffix, 'state').path, { seq: 2 })

  await session.establishGuestSession(suffix)
  events.length = 0
  await fake.port.remove(fake.roomRef(suffix, 'hostPing'))
  assert.ok(!events.some((e) => e.type === 'host_ended_room'))
})
