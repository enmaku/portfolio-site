/**
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionFacadeHostInbox.test.js
 *
 * Host inbox domain wire — guest hello monotonic authority broadcast rebroadcast and
 * guest intent dedupe at the session facade boundary (separate from posture tests).
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { encodeGuestHello, encodeGuestUpdate, parseHostMessage } from './protocol.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const hostInboxTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @type {import('../types.js').GameTimerSyncPayload} */
const HOST_TRUTH = {
  players: [{ id: 'host-p', name: 'Host', color: '#111111' }],
  activePlayerId: 'host-p',
  turnStartedAt: null,
  turnStartedRound: null,
  round: 1,
  playerOrderByRound: { '1': ['host-p'] },
  hardPassEnabled: false,
  hardPassOrderNextRound: false,
  hardPassOrderByRound: {},
}

/**
 * @param {ReturnType<typeof installRtdbLifecycleMocks> extends Promise<infer T> ? T : never} harness
 * @param {string} suffix
 * @param {string} guestStableId
 * @param {unknown} payload
 */
function simulateHostInboxMessage(harness, suffix, guestStableId, payload) {
  const inboxParent = `gameTimerRooms/${suffix}/inbox`
  assert.ok(
    harness.childAddedParentPaths().some((p) => p === inboxParent || p.endsWith('/inbox')),
    `host should wire inbox listener (${harness.childAddedParentPaths().join(', ')})`,
  )
  harness.emitChildAdded(inboxParent, guestStableId)
  const childPath = `${inboxParent}/${guestStableId}`
  assert.ok(
    harness.listeners.has(childPath),
    `host should subscribe to inbox child (${[...harness.listeners.keys()].join(', ')})`,
  )
  harness.emitValue(childPath, payload)
}

/**
 * @param {Array<{ path: string, value: unknown }>} sets
 * @returns {Array<{ seq: number, snapshot: import('../types.js').GameTimerSyncPayload }>}
 */
function parseStateBroadcasts(sets) {
  return sets
    .filter((entry) => entry.path.endsWith('/state'))
    .map((entry) => {
      const parsed = parseHostMessage(entry.value)
      assert.ok(parsed, 'state write must be a host snapshot message')
      return { seq: parsed.seq, snapshot: parsed.snapshot }
    })
}

/**
 * @param {Awaited<ReturnType<typeof importGameTimerSession>>} sessionMod
 */
function bindHostMirrorHandlers(sessionMod) {
  setActivePinia(createPinia())
  /** @type {import('../types.js').GameTimerSyncPayload} */
  let mirror = structuredClone(HOST_TRUTH)
  let applyCount = 0

  sessionMod.bindGameTimerP2PHandlers({
    getSnapshot: () => structuredClone(mirror),
    applySnapshot: (snap) => {
      applyCount += 1
      mirror = structuredClone(snap)
    },
  })

  return {
    get mirror() {
      return mirror
    },
    get applyCount() {
      return applyCount
    },
  }
}

test(
  'guest hello: monotonic authority broadcast rebroadcasts authoritative snapshot with increasing seq',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTHELLO1'
    const guestStableId = 'GTGUESTHELLO'
    const suffix = 'HELLO1'

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
      const sessionMod = await importGameTimerSession(`hello-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const wire = bindHostMirrorHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const broadcastsAfterHostStart = parseStateBroadcasts(harness.sets)
      assert.equal(broadcastsAfterHostStart.length, 1)
      assert.equal(broadcastsAfterHostStart[0].seq, 1)
      assert.equal(broadcastsAfterHostStart[0].snapshot.activePlayerId, 'host-p')
      assert.equal(wire.applyCount, 0)

      const setsBeforeHello = harness.sets.length
      simulateHostInboxMessage(harness, suffix, guestStableId, encodeGuestHello(guestStableId))

      assert.equal(wire.applyCount, 0, 'guest hello must not merge guest snapshot into host mirror')
      const helloBroadcasts = parseStateBroadcasts(harness.sets.slice(setsBeforeHello))
      assert.equal(helloBroadcasts.length, 1)
      assert.ok(
        helloBroadcasts[0].seq > broadcastsAfterHostStart[0].seq,
        'monotonic authority broadcast seq must increase after guest hello',
      )
      assert.equal(helloBroadcasts[0].snapshot.activePlayerId, 'host-p')
    })
  },
)

test(
  'guest intent dedupe at host inbox: one merge and one monotonic authority broadcast within debounce window',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTDEDUP1'
    const guestStableId = 'GTGUESTDEDUP'
    const suffix = 'DEDUP1'

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
      const sessionMod = await importGameTimerSession(`dedupe-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const wire = bindHostMirrorHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const guestFirst = structuredClone(HOST_TRUTH)
      guestFirst.activePlayerId = 'guest-p'
      guestFirst.players = [{ id: 'guest-p', name: 'Guest', color: '#222222' }]
      guestFirst.playerOrderByRound = { '1': ['guest-p'] }

      const guestSecond = structuredClone(guestFirst)
      guestSecond.round = 2

      const intent = { kind: 'selectPlayer', playerId: 'guest-p', sentAt: 1_700_000_000_000 }
      const setsBeforeGuest = harness.sets.length
      const applyBeforeGuest = wire.applyCount

      simulateHostInboxMessage(
        harness,
        suffix,
        guestStableId,
        encodeGuestUpdate(guestFirst, intent),
      )
      simulateHostInboxMessage(
        harness,
        suffix,
        guestStableId,
        encodeGuestUpdate(guestSecond, intent),
      )

      assert.equal(wire.applyCount - applyBeforeGuest, 1, 'duplicate guest intent merges snapshot once')
      assert.equal(wire.mirror.activePlayerId, 'guest-p')
      assert.equal(wire.mirror.round, 1, 'second duplicate must not apply competing snapshot')

      const guestBroadcasts = parseStateBroadcasts(harness.sets.slice(setsBeforeGuest))
      assert.equal(
        guestBroadcasts.length,
        1,
        'duplicate guest intent produces one monotonic authority broadcast',
      )
      assert.ok(guestBroadcasts[0].seq > 1, 'rebroadcast seq must advance past host start')
      assert.equal(guestBroadcasts[0].snapshot.activePlayerId, 'guest-p')
    })
  },
)

afterEach(rtdbAfterEach)
