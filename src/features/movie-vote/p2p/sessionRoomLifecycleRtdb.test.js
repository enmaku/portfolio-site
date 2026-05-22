import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { encodeHello, encodeState } from './protocol.js'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'

const REQUIRED_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://test-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abc',
}

/** @param {() => void | Promise<void>} fn */
async function withFirebaseEnv(fn) {
  const saved = {}
  for (const key of Object.keys(REQUIRED_FIREBASE_ENV)) {
    saved[key] = process.env[key]
    process.env[key] = REQUIRED_FIREBASE_ENV[key]
  }
  try {
    await fn()
  } finally {
    for (const key of Object.keys(REQUIRED_FIREBASE_ENV)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

/**
 * @param {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }} ref
 * @returns {string}
 */
function refPath(ref) {
  const parts = []
  let cur = ref
  while (cur) {
    if (cur.key) parts.unshift(cur.key)
    cur = cur.parent ?? null
  }
  return parts.join('/')
}

/**
 * @param {string} dotPath
 * @returns {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }}
 */
function buildRef(dotPath) {
  const parts = dotPath.split('/').filter(Boolean)
  /** @type {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null } | null} */
  let node = null
  for (const part of parts) {
    node = { key: part, parent: node }
  }
  return /** @type {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }} */ (
    node ?? { key: null, parent: null }
  )
}

/**
 * @param {{
 *   getHostPing?: () => unknown,
 *   getEnded?: () => unknown,
 *   getHostClientId?: () => unknown,
 *   getState?: () => unknown,
 *   getWelcome?: () => unknown,
 *   getGuestOnline?: () => unknown,
 * }} [opts]
 * @returns {Promise<{
 *   listeners: Map<string, (snap: { val: () => unknown }) => void>,
 *   sets: Array<{ path: string, value: unknown }>,
 *   removes: Array<{ path: string }>,
 *   emitChildAdded: (parentPath: string, childKey: string) => void,
 *   emitValue: (path: string, value: unknown) => void,
 * }>}
 */
async function installRtdbLifecycleMocks(opts = {}) {
  /** @type {Map<string, (snap: { val: () => unknown }) => void>} */
  const listeners = new Map()
  /** @type {Map<string, Set<(snap: { key: string | null, ref: ReturnType<typeof buildRef> }) => void>>} */
  const childAddedHandlers = new Map()
  /** @type {Array<{ path: string, value: unknown }>} */
  const sets = []
  /** @type {Array<{ path: string }>} */
  const removes = []

  /**
   * @param {string} parentPath
   * @param {string} childKey
   */
  function emitChildAdded(parentPath, childKey) {
    const handlers = childAddedHandlers.get(parentPath)
    if (!handlers?.size) return
    const childPath = `${parentPath}/${childKey}`
    const snap = { key: childKey, ref: buildRef(childPath) }
    for (const handler of handlers) handler(snap)
  }

  /**
   * @param {string} path
   * @param {unknown} value
   */
  function emitValue(path, value) {
    const handler = listeners.get(path)
    if (handler) handler({ val: () => value })
  }

  const actual = await import('firebase/database')

  mock.module('firebase/database', {
    namedExports: {
      ...actual,
      get: async (ref) => {
        if (ref.key === 'hostPing') {
          return {
            val: () => (opts.getHostPing !== undefined ? opts.getHostPing() : Date.now()),
          }
        }
        if (ref.key === 'ended') {
          return { val: () => (opts.getEnded !== undefined ? opts.getEnded() : null) }
        }
        if (ref.key === 'hostClientId') {
          return {
            val: () => (opts.getHostClientId !== undefined ? opts.getHostClientId() : null),
          }
        }
        if (ref.key === 'state') {
          return { val: () => (opts.getState !== undefined ? opts.getState() : null) }
        }
        if (ref.key === 'welcome') {
          return { val: () => (opts.getWelcome !== undefined ? opts.getWelcome() : null) }
        }
        if (ref.key === 'guestOnline') {
          return {
            val: () => (opts.getGuestOnline !== undefined ? opts.getGuestOnline() : null),
          }
        }
        return { val: () => null }
      },
      set: async (ref, value) => {
        sets.push({ path: refPath(ref), value })
      },
      remove: async (ref) => {
        removes.push({ path: refPath(ref) })
      },
      onDisconnect: () => ({
        remove: () => Promise.resolve(),
        set: () => Promise.resolve(),
      }),
      onChildAdded: (ref, cb) => {
        const path = refPath(ref)
        if (!childAddedHandlers.has(path)) childAddedHandlers.set(path, new Set())
        childAddedHandlers.get(path)?.add(cb)
        return () => childAddedHandlers.get(path)?.delete(cb)
      },
      onValue: (ref, cb) => {
        const path = refPath(ref)
        listeners.set(path, cb)
        return () => listeners.delete(path)
      },
    },
  })

  return {
    listeners,
    sets,
    removes,
    childAddedParentPaths: () => [...childAddedHandlers.keys()],
    emitChildAdded,
    emitValue,
  }
}

/**
 * @param {ReturnType<typeof installRtdbLifecycleMocks> extends Promise<infer T> ? T : never} harness
 * @param {string} suffix
 * @param {string} guestStableId
 * @param {unknown} payload
 */
function simulateHostInboxMessage(harness, suffix, guestStableId, payload) {
  const inboxParent = `movieVoteRooms/${suffix}/inbox`
  const childPath = `${inboxParent}/${guestStableId}`
  assert.ok(
    harness.childAddedParentPaths().some((p) => p === inboxParent || p.endsWith('/inbox')),
    `host should wire inbox listener (${harness.childAddedParentPaths().join(', ')})`,
  )
  harness.emitChildAdded(inboxParent, guestStableId)
  assert.ok(
    harness.listeners.has(childPath),
    `host should subscribe to inbox child (${[...harness.listeners.keys()].join(', ')})`,
  )
  harness.emitValue(childPath, payload)
}

/** @param {string} nonce */
async function importSession(nonce) {
  return import(`./session.js?mv-rtdb-lifecycle=${nonce}`)
}

/**
 * @param {ReturnType<typeof useMovieVoteStore>} store
 * @returns {string[]}
 */
function guestParticipantIds(store) {
  return store.participants
    .filter((p) => p.id !== HOST_PARTICIPANT_ID)
    .map((p) => p.id)
}

/** @type {import('../types.js').MovieVotePublicPayload} */
const JOINABLE_SUGGEST_PAYLOAD = buildMovieVotePublicPayload(
  {
    phase: 'suggest',
    readyToVote: false,
    myDraftPicks: [],
    ballotMovies: [],
    ballotOrderIds: [],
    voteProgress: null,
    irvResult: null,
    votingMethod: 'irv',
  },
  new Map(),
)

const rtdbLifecycleTests = { skip: !mock.module }

test(
  'guest hostPing loss after seen ends session and clears room persistence',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom, sessionPhase, sessionSuffix } = await importSession(String(Date.now()))
      setActivePinia(createPinia())
      const room = useMovieVoteRoomSessionStore()

      await joinRoom('ABC123')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')

      const hostPingPath = [...listeners.keys()].find((p) => p.endsWith('hostPing'))
      assert.ok(hostPingPath)
      const onHostPing = listeners.get(hostPingPath)
      assert.ok(onHostPing)
      onHostPing({ val: () => 5_000_000 })
      onHostPing({ val: () => null })

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
      assert.equal(room.suffix, null)
    })
  },
)

test(
  'joinRoom writes guest online signal for stable client',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const stableId = 'MVTESTCLIENT01'
    /** @type {Array<{ path: string, value: unknown }>} */
    const rtdbSets = []

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => stableId,
        deriveStableHostSuffix: () => 'AAAAAA',
      },
    })

    const actualRtdb = await import('../firebase/rtdb.js')
    mock.module('../firebase/rtdb.js', {
      namedExports: {
        ...actualRtdb,
        setRtdb: async (ref, value) => {
          rtdbSets.push({ path: refPath(ref), value })
          return actualRtdb.setRtdb(ref, value)
        },
      },
    })

    await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom } = await importSession(`guest-online-${Date.now()}`)
      setActivePinia(createPinia())
      await joinRoom('JOIN01')

      assert.ok(
        rtdbSets.some(
          (s) => s.path.includes('guestOnline') && s.path.includes(stableId) && s.value === true,
        ),
        'guest establish should mark guestOnline',
      )
    })
  },
)

test(
  'resumeAsHost rejects suffix occupied by another host principal',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const stableId = 'RESUMEHOST01'
    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => stableId,
        deriveStableHostSuffix: () => 'AAAAAA',
      },
    })

    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getHostClientId: () => 'other-host-principal',
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const { resumeAsHost, sessionPhase } = await importSession(`resume-occ-${Date.now()}`)
      setActivePinia(createPinia())
      useMovieVoteRoomSessionStore().setHost('OCCUPY')

      await assert.rejects(() => resumeAsHost('OCCUPY', 1), /Room code in use|Could not resume/)
      assert.equal(sessionPhase.value, 'idle')
    })
  },
)

test(
  'teardownSession clears guest online signal on guest tab',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const stableId = 'TEARDOWNGUEST1'
    /** @type {Array<{ path: string, value: unknown }>} */
    const rtdbSets = []

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => stableId,
        deriveStableHostSuffix: () => 'AAAAAA',
      },
    })

    const actualRtdb = await import('../firebase/rtdb.js')
    mock.module('../firebase/rtdb.js', {
      namedExports: {
        ...actualRtdb,
        setRtdb: async (ref, value) => {
          rtdbSets.push({ path: refPath(ref), value })
          return actualRtdb.setRtdb(ref, value)
        },
      },
    })

    await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom, teardownSession } = await importSession(`teardown-guest-${Date.now()}`)
      setActivePinia(createPinia())
      await joinRoom('TEAR01')
      teardownSession()

      assert.ok(
        rtdbSets.some(
          (s) => s.path.includes('guestOnline') && s.path.includes(stableId) && s.value === false,
        ),
        'guest teardown should mark guestOnline false',
      )
    })
  },
)

test(
  'resumeAsHost reclaims own host room without requiring fresh hostPing',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const stableId = 'RECLAIMHOST01'
    const preservedState = { seq: 4, payload: { phase: 'suggest', participants: [] } }

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => stableId,
        deriveStableHostSuffix: () => 'AAAAAA',
      },
    })

    await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getHostClientId: () => stableId,
      getEnded: () => null,
      getState: () => preservedState,
    })

    await withFirebaseEnv(async () => {
      const { resumeAsHost, sessionPhase } = await importSession(`reclaim-${Date.now()}`)
      setActivePinia(createPinia())
      useMovieVoteRoomSessionStore().setHost('RECLM1')

      const result = await resumeAsHost('RECLM1', 1)
      assert.equal(result.suffix, 'RECLM1')
      assert.equal(sessionPhase.value, 'hosting')
    })
  },
)

test(
  'guest RTDB ended marker clears room persistence',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom, sessionPhase, sessionSuffix } = await importSession(`ended-${Date.now()}`)
      setActivePinia(createPinia())
      const store = useMovieVoteStore()
      const room = useMovieVoteRoomSessionStore()
      store.resetSessionSoft()

      await joinRoom('END123')
      assert.equal(sessionPhase.value, 'guest_connected')

      const endedPath = [...listeners.keys()].find((p) => p.endsWith('ended'))
      assert.ok(endedPath)
      const onEnded = listeners.get(endedPath)
      assert.ok(onEnded)
      onEnded({ val: () => 1_700_000_000_000 })

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
    })
  },
)

test(
  'startAsHost claims idle suffix and clears claim reset paths',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const hostStableId = 'MVHOSTCLAIM01'
    const suffix = 'CLAIM1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const { removes } = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const { startAsHost, sessionPhase } = await importSession(`host-claim-${Date.now()}`)
      setActivePinia(createPinia())

      const result = await startAsHost(3)
      assert.equal(result.suffix, suffix)
      assert.equal(sessionPhase.value, 'hosting')

      for (const child of ROOM_CLAIM_RESET_PATHS) {
        assert.ok(
          removes.some((r) => r.path.endsWith(`/${child}`)),
          `fresh claim should remove ${child}`,
        )
      }
    })
  },
)

test(
  'guest connectivity offline enters reconnecting phase',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom, sessionPhase } = await importSession(`guest-reconn-${Date.now()}`)
      setActivePinia(createPinia())
      await joinRoom('RECONN1')
      assert.equal(sessionPhase.value, 'guest_connected')

      const connectedPath = [...listeners.keys()].find((p) => p.endsWith('connected'))
      assert.ok(connectedPath, 'guest should subscribe to Firebase connected')
      const onConnected = listeners.get(connectedPath)
      assert.ok(onConnected)
      onConnected({ val: () => false })

      assert.equal(sessionPhase.value, 'reconnecting')
    })
  },
)

test(
  'guest hostPing loss before seen keeps session when state is joinable',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const joinableState = encodeState(JOINABLE_SUGGEST_PAYLOAD, 1)
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getState: () => joinableState,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const { joinRoom, sessionPhase, sessionSuffix } = await importSession(
        `hostping-never-${Date.now()}`,
      )
      setActivePinia(createPinia())
      const room = useMovieVoteRoomSessionStore()

      await joinRoom('NOPING')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'NOPING')

      const hostPingPath = [...listeners.keys()].find((p) => p.endsWith('hostPing'))
      assert.ok(hostPingPath)
      const onHostPing = listeners.get(hostPingPath)
      assert.ok(onHostPing)
      onHostPing({ val: () => null })

      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'NOPING')
      assert.equal(room.role, 'guest')
    })
  },
)

test(
  'host drops offline guest from readiness after guestOnline grace',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    mock.timers.enable({ apis: ['setTimeout'] })

    const hostStableId = 'MVHOSTQUOR01'
    const guestStableId = 'MVGUESTQUOR1'
    const suffix = 'QUORUM'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const { startAsHost, movieVoteHostLocalChanged, sessionPhase } = await importSession(
        `quorum-offline-${Date.now()}`,
      )
      setActivePinia(createPinia())
      const store = useMovieVoteStore()

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      movieVoteHostLocalChanged()

      const guestIdsAfterJoin = guestParticipantIds(store)
      assert.equal(guestIdsAfterJoin.length, 1)

      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, false)
      mock.timers.tick(45_000)
      movieVoteHostLocalChanged()

      assert.equal(guestParticipantIds(store).length, 0)
      assert.ok(!guestParticipantIds(store).includes(guestIdsAfterJoin[0]))
    })

    mock.timers.reset()
  },
)

test(
  'host keeps guest when guestOnline returns before removal grace',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    mock.timers.enable({ apis: ['setTimeout'] })

    const hostStableId = 'MVHOSTGRACE1'
    const guestStableId = 'MVGUESTGRACE'
    const suffix = 'GRACE1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const { startAsHost, movieVoteHostLocalChanged, sessionPhase } = await importSession(
        `quorum-grace-${Date.now()}`,
      )
      setActivePinia(createPinia())
      const store = useMovieVoteStore()

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      movieVoteHostLocalChanged()

      const guestPid = guestParticipantIds(store)[0]
      assert.ok(guestPid)

      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, false)
      mock.timers.tick(20_000)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      mock.timers.tick(45_000)
      movieVoteHostLocalChanged()

      assert.deepEqual(guestParticipantIds(store), [guestPid])
    })

    mock.timers.reset()
  },
)

afterEach(async () => {
  mock.timers.reset()
  mock.reset()
})
