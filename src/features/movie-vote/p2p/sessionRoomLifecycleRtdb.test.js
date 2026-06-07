/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionRoomLifecycleRtdb.test.js
 *
 * Uses dynamic `importSession` so RTDB mocks apply before `session.js` loads; host
 * participant reconciliation still calls `outbound.hostLocalChanged()` where session
 * has no matching store action (guest hello / guestOnline), not removed sync exports.
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { encodeHello, encodeState, MSG_MV_DRAFT } from './protocol.js'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'
import { installRtdbLifecycleMocks, withFirebaseEnv, refPath, importMovieVoteSession, createRtdbLifecycleAfterEach } from './sessionRtdbLifecycleHarness.js'

const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

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
  return importMovieVoteSession(nonce)
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

/**
 * Store + same `bindMovieVoteP2PHandlers` contract as the Pinia plugin, on the
 * session module instance loaded by `importSession` (must not import the bridge
 * before mocks — it would bind a different session copy).
 * @param {Awaited<ReturnType<typeof importSession>>} sessionMod
 */
async function installLifecyclePinia(sessionMod) {
  const { createApp } = await import('vue')
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMovieVoteStore()
  const outbound = sessionMod.bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      store.applyPublicPayload(payload)
    },
    onWireTeardown: () => {},
  })
  const app = createApp({ render: () => null })
  app.use(pinia)
  return { store, outbound }
}

/** Host suggest sync via outbound wire (replaces removed host sync exports). */
function hostSyncParticipantsFromRoom(outbound) {
  outbound.hostLocalChanged()
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
  'strict guest does not wire hostPing and stays connected with room persistence',
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
      assert.equal(
        [...listeners.keys()].some((p) => p.endsWith('hostPing')),
        false,
        'strict guest should not subscribe to hostPing',
      )

      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'ABC123')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'ABC123')
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
  'strict guest joins without hostPing when state is joinable',
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
      assert.equal(
        [...listeners.keys()].some((p) => p.endsWith('hostPing')),
        false,
        'strict guest should not subscribe to hostPing',
      )
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
      const sessionMod = await importSession(`quorum-offline-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = await installLifecyclePinia(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const guestIdsAfterJoin = guestParticipantIds(store)
      assert.equal(guestIdsAfterJoin.length, 1)

      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, false)
      mock.timers.tick(45_000)
      hostSyncParticipantsFromRoom(outbound)

      assert.equal(guestParticipantIds(store).length, 0)
      assert.ok(!guestParticipantIds(store).includes(guestIdsAfterJoin[0]))
    })

    mock.timers.reset()
  },
)

test(
  'host enters voting when guest signals ready with zero picks (RTDB omits empty picks)',
  rtdbLifecycleTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTZERO1'
    const guestStableId = 'MVGUESTZERO1'
    const suffix = 'ZERO01'

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
      const sessionMod = await importSession(`zero-picks-ready-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = await installLifecyclePinia(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      store.addDraftPick({
        localId: 'h1',
        source: 'custom',
        tmdbId: null,
        customKey: 'alpha',
        title: 'Alpha',
        posterPath: null,
        overview: '',
      })
      store.addDraftPick({
        localId: 'h2',
        source: 'custom',
        tmdbId: null,
        customKey: 'beta',
        title: 'Beta',
        posterPath: null,
        overview: '',
      })

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const guestPid = guestParticipantIds(store)[0]
      assert.ok(guestPid)

      simulateHostInboxMessage(harness, suffix, guestStableId, {
        v: 1,
        type: MSG_MV_DRAFT,
        participantId: guestPid,
        ready: true,
      })

      store.setReadyToVote(true)
      hostSyncParticipantsFromRoom(outbound)

      assert.equal(store.phase, 'voting')
      assert.ok(store.voterIds.includes(HOST_PARTICIPANT_ID))
      assert.ok(store.voterIds.includes(guestPid))
      assert.equal(store.voterIds.length, 2)
      assert.equal(store.voteProgress?.total, 2)
    })
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
      const sessionMod = await importSession(`quorum-grace-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = await installLifecyclePinia(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const guestPid = guestParticipantIds(store)[0]
      assert.ok(guestPid)

      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, false)
      mock.timers.tick(20_000)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      mock.timers.tick(45_000)
      hostSyncParticipantsFromRoom(outbound)

      assert.deepEqual(guestParticipantIds(store), [guestPid])
    })

    mock.timers.reset()
  },
)

afterEach(rtdbAfterEach)
