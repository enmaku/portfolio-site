/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionFacadeReconnect.test.js
 *
 * Star-room shell reconnect integration at the Movie Vote session facade — teardown
 * ordering and persistence/posture outcomes only (no Quasar Notify assertions).
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'
import { encodeState } from './protocol.js'
import {
  createRtdbLifecycleAfterEach,
  importMovieVoteSession,
  installRtdbLifecycleMocks,
  refPath,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const facadeReconnectTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @type {Awaited<ReturnType<typeof importMovieVoteSession>> | null} */
let guestSessionForShellHook = null

/** @type {typeof import('../../p2p/starRoomShell.js').runGuestStarReconnectLoop | null} */
let realGuestStarReconnectLoop = null

/** @type {typeof import('../../p2p/starRoomShell.js').runHostStarReconnectLoop | null} */
let realHostStarReconnectLoop = null

/**
 * @param {() => boolean} condition
 * @param {string} label
 * @returns {Promise<void>}
 */
async function waitForPhase(condition, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`timed out waiting for ${label}`)
}

/**
 * @param {() => string} readPhase
 * @returns {Promise<void>}
 */
async function waitForReconnectExhaustion(readPhase) {
  const deadline = Date.now() + 3_000
  while (readPhase() !== 'idle' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

/**
 * @param {import('../../p2p/starRoomShell.js').StarRoomGuestReconnectHandlers} h
 * @returns {Promise<void>}
 */
async function runGuestReconnectWithSupersedeHook(h) {
  assert.ok(realGuestStarReconnectLoop)
  return realGuestStarReconnectLoop({
    ...h,
    sleep: async () => {},
    establishGuest: async () => {
      await h.establishGuest()
      guestSessionForShellHook?.bumpMovieVoteReconnectGenerationForTests()
    },
  })
}

/**
 * @param {import('../../p2p/starRoomShell.js').StarRoomHostReconnectHandlers} h
 * @returns {Promise<void>}
 */
async function runHostReconnectWithoutBackoff(h) {
  assert.ok(realHostStarReconnectLoop)
  return realHostStarReconnectLoop({
    ...h,
    sleep: async () => {},
  })
}

/**
 * @returns {Promise<void>}
 */
async function installGuestReconnectShellHook() {
  const shellActual = await import('../../p2p/starRoomShell.js')
  realGuestStarReconnectLoop = shellActual.runGuestStarReconnectLoop
  realHostStarReconnectLoop = shellActual.runHostStarReconnectLoop
  mock.module('../../p2p/starRoomShell.js', {
    namedExports: {
      ...shellActual,
      runGuestStarReconnectLoop: runGuestReconnectWithSupersedeHook,
      runHostStarReconnectLoop: shellActual.runHostStarReconnectLoop,
    },
  })
}

/**
 * @returns {Promise<void>}
 */
async function installFastGuestReconnectShell() {
  const shellActual = await import('../../p2p/starRoomShell.js')
  mock.module('../../p2p/starRoomShell.js', {
    namedExports: {
      ...shellActual,
      runGuestStarReconnectLoop: (h) =>
        shellActual.runGuestStarReconnectLoop({ ...h, sleep: async () => {} }),
    },
  })
}

/**
 * @returns {Promise<void>}
 */
async function installHostReconnectShellHook() {
  const shellActual = await import('../../p2p/starRoomShell.js')
  if (!realGuestStarReconnectLoop) {
    realGuestStarReconnectLoop = shellActual.runGuestStarReconnectLoop
    realHostStarReconnectLoop = shellActual.runHostStarReconnectLoop
  }
  mock.module('../../p2p/starRoomShell.js', {
    namedExports: {
      ...shellActual,
      runGuestStarReconnectLoop: realGuestStarReconnectLoop,
      runHostStarReconnectLoop: runHostReconnectWithoutBackoff,
    },
  })
}

/**
 * @param {Awaited<ReturnType<typeof importMovieVoteSession>>} sessionMod
 * @returns {{ applied: import('../types.js').MovieVotePublicPayload[] }}
 */
function bindFakeHandlers(sessionMod) {
  /** @type {import('../types.js').MovieVotePublicPayload[]} */
  const applied = []
  sessionMod.bindMovieVoteP2PHandlers({
    applyPublicPayload: (p) => {
      applied.push(p)
    },
    onWireTeardown: () => {},
  })
  return { applied }
}

/**
 * @param {Map<string, (snap: { val: () => unknown }) => void>} listeners
 * @returns {(connected: boolean) => void}
 */
function getConnectedEmitter(listeners) {
  const connectedPath = [...listeners.keys()].find((p) => p.endsWith('connected'))
  assert.ok(connectedPath, 'session should subscribe to Firebase .info/connected')
  const onConnected = listeners.get(connectedPath)
  assert.ok(onConnected)
  return (connected) => onConnected({ val: () => connected })
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

const JOINABLE_HOST_STATE = encodeState(JOINABLE_SUGGEST_PAYLOAD, 1)

test(
  'superseded guest reconnect loop tears down wire only and keeps join persistence',
  facadeReconnectTests,
  async () => {
    mock.reset()
    guestSessionForShellHook = null
    realGuestStarReconnectLoop = null
    realHostStarReconnectLoop = null
    await installGuestReconnectShellHook()

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`supersede-guest-${Date.now()}`)
      guestSessionForShellHook = sessionMod
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      bindFakeHandlers(sessionMod)

      setActivePinia(createPinia())
      const room = useMovieVoteRoomSessionStore()

      await joinRoom('SUP001')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'SUP001')

      const emitConnected = getConnectedEmitter(harness.listeners)
      emitConnected(false)
      assert.equal(sessionPhase.value, 'reconnecting')

      await waitForPhase(() => sessionPhase.value === 'idle', 'superseded loop unwind')

      assert.equal(room.role, 'guest', 'superseded unwind must not clear join persistence')
      assert.equal(room.suffix, 'SUP001')
      assert.equal(
        harness.sets.some((s) => s.path.endsWith('/ended')),
        false,
        'superseded guest loop must not broadcast deliberate room end',
      )
      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
    })
  },
)

test(
  'host reconnect recovery does not end room for connected guests',
  facadeReconnectTests,
  async () => {
    mock.reset()
    realGuestStarReconnectLoop = null
    realHostStarReconnectLoop = null

    const hostStableId = 'MVHOSTRCV01'
    const guestStableId = 'MVGUESTRCV1'
    const suffix = 'HRECV1'
    let clientId = hostStableId

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => clientId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    await installHostReconnectShellHook()

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getHostClientId: () => hostStableId,
      getEnded: () => null,
      getState: () => JOINABLE_HOST_STATE,
    })

    await withFirebaseEnv(async () => {
      const hostPinia = createPinia()
      setActivePinia(hostPinia)

      const hostMod = await importMovieVoteSession(`host-recover-${Date.now()}`)
      bindFakeHandlers(hostMod)
      const { startAsHost, sessionPhase: hostPhase } = hostMod

      await startAsHost(3)
      assert.equal(hostPhase.value, 'hosting')

      const connectedPath = [...harness.listeners.keys()].find((p) => p.endsWith('connected'))
      assert.ok(connectedPath)
      const hostOnConnected = harness.listeners.get(connectedPath)
      assert.ok(hostOnConnected)

      clientId = guestStableId
      const guestPinia = createPinia()
      setActivePinia(guestPinia)

      const guestMod = await importMovieVoteSession(`guest-recover-${Date.now()}`)
      bindFakeHandlers(guestMod)
      const { joinRoom, sessionPhase: guestPhase, sessionSuffix: guestSuffix } = guestMod
      const guestRoom = useMovieVoteRoomSessionStore()

      await joinRoom(suffix)
      assert.equal(guestPhase.value, 'guest_connected')
      assert.equal(guestRoom.role, 'guest')

      setActivePinia(hostPinia)
      hostOnConnected({ val: () => false })
      assert.equal(hostPhase.value, 'reconnecting')

      await waitForPhase(() => hostPhase.value === 'hosting', 'host reconnect recovery')

      setActivePinia(guestPinia)
      assert.equal(guestPhase.value, 'guest_connected')
      assert.equal(guestSuffix.value, suffix)
      assert.equal(guestRoom.role, 'guest')
      assert.equal(
        harness.sets.some((s) => s.path.endsWith('/ended')),
        false,
        'host reconnect recovery must not write deliberate room end',
      )
    })
  },
)

test(
  'host reclaim applies preserved payload and continues broadcast seq from RTDB',
  facadeReconnectTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVRECLAIM01'
    const suffix = 'RECLM1'
    /** @type {import('../types.js').MovieVotePublicPayload} */
    const preservedPayload = buildMovieVotePublicPayload(
      {
        phase: 'voting',
        readyToVote: true,
        myDraftPicks: [
          {
            localId: 'h1',
            source: 'custom',
            tmdbId: null,
            customKey: 'alpha',
            title: 'Alpha',
            posterPath: null,
            overview: '',
          },
        ],
        ballotMovies: [
          {
            publicId: 'm-alpha',
            source: 'custom',
            tmdbId: null,
            customKey: 'alpha',
            title: 'Alpha',
            posterPath: null,
            overview: '',
          },
          {
            publicId: 'm-beta',
            source: 'custom',
            tmdbId: null,
            customKey: 'beta',
            title: 'Beta',
            posterPath: null,
            overview: '',
          },
        ],
        ballotOrderIds: ['m-alpha', 'm-beta'],
        voteProgress: { submitted: 1, total: 2 },
        irvResult: null,
        votingMethod: 'irv',
      },
      new Map([['guest-1', { picks: [], ready: true }]]),
    )
    const preservedState = encodeState(preservedPayload, 5)

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getHostClientId: () => hostStableId,
      getEnded: () => null,
      getState: () => preservedState,
    })

    /** @type {Array<{ path: string, value: { seq?: number } }>} */
    const broadcastSets = []
    const actualRtdb = await import('../firebase/rtdb.js')
    mock.module('../firebase/rtdb.js', {
      namedExports: {
        ...actualRtdb,
        setRtdb: async (ref, value) => {
          broadcastSets.push({
            path: refPath(ref),
            value: /** @type {{ seq?: number }} */ (value),
          })
        },
      },
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`reclaim-seq-${Date.now()}`)
      const { resumeAsHost, sessionPhase, bindMovieVoteP2PHandlers } = sessionMod
      const { applied } = bindFakeHandlers(sessionMod)
      const outbound = bindMovieVoteP2PHandlers({})

      setActivePinia(createPinia())
      useMovieVoteRoomSessionStore().setHost(suffix)

      const result = await resumeAsHost(suffix, 1)
      assert.equal(result.suffix, suffix)
      assert.equal(sessionPhase.value, 'hosting')
      assert.equal(applied.length, 1)
      assert.equal(applied[0].phase, preservedPayload.phase)
      assert.equal(applied[0].voteProgress?.submitted, preservedPayload.voteProgress?.submitted)
      assert.deepEqual(applied[0].ballotOrderIds, preservedPayload.ballotOrderIds)

      const resumePublish = broadcastSets.find((s) => s.path.endsWith('/state'))
      assert.ok(resumePublish, 'host reclaim should publish hydrated authoritative state')
      assert.equal(
        resumePublish.value.seq,
        6,
        'first publish after reclaim should continue from RTDB seq',
      )

      broadcastSets.length = 0
      outbound.hostLocalChanged()

      const nextPublish = broadcastSets.find((s) => s.path.endsWith('/state'))
      assert.ok(nextPublish, 'host broadcast should write authoritative state')
      assert.equal(nextPublish.value.seq, 7, 'subsequent broadcast should monotonically advance seq')
    })
  },
)

test(
  'fatal reconnect exhaustion clears persistence and returns tab to idle',
  facadeReconnectTests,
  async () => {
    mock.reset()

    mock.module('../../p2p/starRoomReconnectDelay.js', {
      namedExports: {
        starRoomReconnectDelayMs: () => 5,
      },
    })
    mock.module('../../p2p/starRoomTiming.js', {
      namedExports: {
        RECONNECT_MAX_ATTEMPTS: 3,
        RECONNECT_INITIAL_PAUSE_MS: 5,
        RECONNECT_BASE_DELAY_MS: 5,
        RECONNECT_MAX_DELAY_MS: 5,
      },
    })

    await installFastGuestReconnectShell()

    const actualRtdb = await import('../firebase/rtdb.js')
    mock.module('../firebase/rtdb.js', {
      namedExports: { ...actualRtdb },
    })

    let roomJoinable = true
    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => (roomJoinable ? Date.now() : null),
      getState: () => (roomJoinable ? JOINABLE_HOST_STATE : null),
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`fatal-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      bindFakeHandlers(sessionMod)

      setActivePinia(createPinia())
      const room = useMovieVoteRoomSessionStore()

      await joinRoom('FATAL1')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'FATAL1')

      roomJoinable = false
      getConnectedEmitter(harness.listeners)(false)
      assert.equal(sessionPhase.value, 'reconnecting')

      await waitForReconnectExhaustion(() => sessionPhase.value)

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
      assert.equal(room.suffix, null)
    })
  },
)

afterEach(rtdbAfterEach)
