/**
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionFacadeReconnect.test.js
 *
 * Star-room shell reconnect integration at the Game Timer session facade — teardown
 * ordering and persistence/posture outcomes only (no Quasar Notify assertions).
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { encodeHostSnapshot } from './protocol.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const facadeReconnectTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/**
 * @param {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null }} ref
 * @returns {string[]}
 */
function collectRefPath(ref) {
  /** @type {string[]} */
  const parts = []
  let cur = ref
  while (cur) {
    if (cur.key) parts.unshift(cur.key)
    cur = /** @type {{ key?: string | null, parent?: { key?: string | null, parent?: unknown } | null } | null } */ (
      cur.parent ?? null
    )
  }
  return parts
}

/** @type {Awaited<ReturnType<typeof importGameTimerSession>> | null} */
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
      guestSessionForShellHook?.bumpGameTimerReconnectGenerationForTests()
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
 * @param {Awaited<ReturnType<typeof importGameTimerSession>>} sessionMod
 * @returns {{ getSnapshot: () => import('../types.js').GameTimerSyncPayload, applied: import('../types.js').GameTimerSyncPayload[] }}
 */
function bindFakeHandlers(sessionMod) {
  /** @type {import('../types.js').GameTimerSyncPayload} */
  const snapshot = {
    players: [{ id: 'p1', name: 'Host', color: '#111111' }],
    activePlayerId: 'p1',
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  }
  /** @type {import('../types.js').GameTimerSyncPayload[]} */
  const applied = []
  sessionMod.bindGameTimerP2PHandlers({
    getSnapshot: () => snapshot,
    applySnapshot: (s) => {
      applied.push(s)
    },
  })
  return { getSnapshot: () => snapshot, applied }
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

test(
  'superseded guest reconnect loop tears down wire only and keeps join persistence',
  facadeReconnectTests,
  async () => {
    mock.reset()
    guestSessionForShellHook = null
    realGuestStarReconnectLoop = null
    realHostStarReconnectLoop = null
    await installGuestReconnectShellHook()

    const harness = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`supersede-guest-${Date.now()}`)
      guestSessionForShellHook = sessionMod
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      bindFakeHandlers(sessionMod)

      setActivePinia(createPinia())
      const room = useGameTimerRoomSessionStore()

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

    const hostStableId = 'GTHOSTRCV01'
    const guestStableId = 'GTGUESTRCV1'
    const suffix = 'HRECV1'
    let clientId = hostStableId

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => clientId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const joinableState = encodeHostSnapshot(
      {
        players: [{ id: 'p1', name: 'Host', color: '#111111' }],
        activePlayerId: 'p1',
        turnStartedAt: null,
        turnStartedRound: null,
        round: 1,
        playerOrderByRound: {},
      },
      1,
    )

    await installHostReconnectShellHook()

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getHostClientId: () => hostStableId,
      getEnded: () => null,
      getState: () => joinableState,
    })

    await withFirebaseEnv(async () => {
      const hostPinia = createPinia()
      setActivePinia(hostPinia)

      const hostMod = await importGameTimerSession(`host-recover-${Date.now()}`)
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

      const guestMod = await importGameTimerSession(`guest-recover-${Date.now()}`)
      bindFakeHandlers(guestMod)
      const { joinRoom, sessionPhase: guestPhase, sessionSuffix: guestSuffix } = guestMod
      const guestRoom = useGameTimerRoomSessionStore()

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
  'host reclaim applies preserved snapshot and continues broadcast seq from RTDB',
  facadeReconnectTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTRECLAIM01'
    const suffix = 'RECLM1'
    /** @type {import('../types.js').GameTimerSyncPayload} */
    const preservedSnapshot = {
      players: [
        { id: 'p1', name: 'Host', color: '#111111' },
        { id: 'p2', name: 'Guest', color: '#222222' },
      ],
      activePlayerId: 'p2',
      turnStartedAt: 1_700_000_000_000,
      turnStartedRound: 2,
      round: 2,
      playerOrderByRound: { 1: ['p1', 'p2'], 2: ['p2', 'p1'] },
    }
    const preservedState = encodeHostSnapshot(preservedSnapshot, 5)

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
            path: [...collectRefPath(ref)].join('/'),
            value: /** @type {{ seq?: number }} */ (value),
          })
        },
      },
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`reclaim-seq-${Date.now()}`)
      const { resumeAsHost, sessionPhase, broadcastGameTimerSnapshot } = sessionMod
      const { getSnapshot, applied } = bindFakeHandlers(sessionMod)

      setActivePinia(createPinia())
      useGameTimerRoomSessionStore().setHost(suffix)

      const result = await resumeAsHost(suffix, 1)
      assert.equal(result.suffix, suffix)
      assert.equal(sessionPhase.value, 'hosting')
      assert.equal(applied.length, 1)
      assert.equal(applied[0].activePlayerId, preservedSnapshot.activePlayerId)
      assert.equal(applied[0].round, preservedSnapshot.round)
      assert.deepEqual(applied[0].players, preservedSnapshot.players)

      const resumePublish = broadcastSets.find((s) => s.path.endsWith('/state'))
      assert.ok(resumePublish, 'host reclaim should publish hydrated authoritative state')
      assert.equal(
        resumePublish.value.seq,
        6,
        'first publish after reclaim should continue from RTDB seq',
      )

      broadcastSets.length = 0
      broadcastGameTimerSnapshot(getSnapshot())

      const nextPublish = broadcastSets.find((s) => s.path.endsWith('/state'))
      assert.ok(nextPublish, 'host broadcast should write authoritative state')
      assert.equal(nextPublish.value.seq, 7, 'subsequent broadcast should monotonically advance seq')
    })
  },
)

afterEach(rtdbAfterEach)
