/**
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionFacadeHostInbox.test.js
 *
 * Host inbox domain wire — guest hello monotonic authority broadcast rebroadcast and
 * scoped-action cooldown at the session facade boundary (separate from posture tests).
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { encodeGuestHello, encodeGuestUpdate, parseHostMessage } from './protocol.js'
import { parseStateBroadcasts, simulateHostInboxMessage } from '../../p2p/test/hostInboxHarness.js'
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

/** @param {Array<{ path: string, value: unknown }>} sets */
function gtStateBroadcasts(sets) {
  return parseStateBroadcasts(sets, parseHostMessage, 'snapshot')
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

      const broadcastsAfterHostStart = gtStateBroadcasts(harness.sets)
      assert.equal(broadcastsAfterHostStart.length, 1)
      assert.equal(broadcastsAfterHostStart[0].seq, 1)
      assert.equal(broadcastsAfterHostStart[0].snapshot.activePlayerId, 'host-p')
      assert.equal(wire.applyCount, 0)

      const setsBeforeHello = harness.sets.length
      simulateHostInboxMessage(harness, 'gameTimerRooms', suffix, guestStableId, encodeGuestHello(guestStableId))

      assert.equal(wire.applyCount, 0, 'guest hello must not merge guest snapshot into host mirror')
      const helloBroadcasts = gtStateBroadcasts(harness.sets.slice(setsBeforeHello))
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
  'scoped cooldown at host inbox: honor then reject with corrective monotonic authority broadcast',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTCOOL1'
    const guestStableId = 'GTGUESTCOOL'
    const suffix = 'COOL1'

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
      const sessionMod = await importGameTimerSession(`cooldown-${Date.now()}`)
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
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestUpdate(guestFirst, intent),
      )
      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestUpdate(guestSecond, intent),
      )

      assert.equal(wire.applyCount - applyBeforeGuest, 1, 'scoped guest honor merges snapshot once')
      assert.equal(wire.mirror.activePlayerId, 'guest-p')
      assert.equal(wire.mirror.round, 1, 'rejected scoped guest must not apply competing snapshot')

      const guestBroadcasts = gtStateBroadcasts(harness.sets.slice(setsBeforeGuest))
      assert.equal(
        guestBroadcasts.length,
        2,
        'scoped honor plus reject produces honor and corrective broadcasts',
      )
      assert.equal(guestBroadcasts[0].snapshot.activePlayerId, 'guest-p')
      assert.equal(guestBroadcasts[1].snapshot.activePlayerId, 'guest-p')
      assert.equal(guestBroadcasts[1].snapshot.round, 1)
      assert.ok(guestBroadcasts[1].seq > guestBroadcasts[0].seq)
    })
  },
)

test(
  'non-scoped guest update during cooldown still merges',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTNSC1'
    const guestStableId = 'GTGUESTNSC'
    const suffix = 'NSC1'

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
      const sessionMod = await importGameTimerSession(`nonscoped-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const wire = bindHostMirrorHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const scopedSnap = structuredClone(HOST_TRUTH)
      scopedSnap.activePlayerId = 'guest-p'
      scopedSnap.players = [
        { id: 'host-p', name: 'Host', color: '#111111' },
        { id: 'guest-p', name: 'Guest', color: '#222222' },
      ]
      scopedSnap.playerOrderByRound = { '1': ['host-p', 'guest-p'] }

      const rosterSnap = structuredClone(scopedSnap)
      rosterSnap.players = [
        { id: 'host-p', name: 'Host', color: '#111111' },
        { id: 'guest-p', name: 'Guest', color: '#222222' },
        { id: 'new-p', name: 'New', color: '#333333' },
      ]
      rosterSnap.playerOrderByRound = { '1': ['host-p', 'guest-p', 'new-p'] }

      const scopedIntent = { kind: 'selectPlayer', playerId: 'guest-p', sentAt: 1 }
      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestUpdate(scopedSnap, scopedIntent),
      )
      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestUpdate(rosterSnap),
      )

      assert.equal(wire.mirror.players.length, 3, 'non-scoped roster update merges during cooldown')
      assert.equal(wire.mirror.players[2].id, 'new-p')
    })
  },
)

test(
  'host local scoped action arms cooldown before competing guest scoped message',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTLOC1'
    const guestStableId = 'GTGUESTLOC'
    const suffix = 'LOC1'

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
      const sessionMod = await importGameTimerSession(`hostlocal-${Date.now()}`)
      const { startAsHost, sessionPhase, broadcastGameTimerSnapshot } = sessionMod
      const wire = bindHostMirrorHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const hostScoped = structuredClone(wire.mirror)
      hostScoped.round = 2
      const setsBefore = harness.sets.length
      const applyBefore = wire.applyCount

      broadcastGameTimerSnapshot(hostScoped, { kind: 'endTurnNext', sentAt: 1 })

      const guestCompeting = structuredClone(hostScoped)
      guestCompeting.activePlayerId = 'other-p'
      guestCompeting.players = [{ id: 'other-p', name: 'Other', color: '#444444' }]
      guestCompeting.playerOrderByRound = { '1': ['other-p'] }

      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestUpdate(guestCompeting, {
          kind: 'selectPlayer',
          playerId: 'other-p',
          sentAt: 2,
        }),
      )

      assert.equal(wire.applyCount, applyBefore, 'guest scoped message rejected after host local honor')
      assert.equal(wire.mirror.round, 1)
      assert.equal(wire.mirror.activePlayerId, 'host-p')

      const broadcasts = gtStateBroadcasts(harness.sets.slice(setsBefore))
      assert.ok(broadcasts.length >= 2, 'host honor and guest reject each publish authority')
    })
  },
)

test(
  'cross-guest scoped race: first honored player wins, second rejected',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTXGN1'
    const guestA = 'GTGUESTXGA'
    const guestB = 'GTGUESTXGB'
    const suffix = 'XGN1'

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
      const sessionMod = await importGameTimerSession(`crossguest-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const wire = bindHostMirrorHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const snapA = structuredClone(HOST_TRUTH)
      snapA.activePlayerId = 'player-a'
      snapA.players = [
        { id: 'host-p', name: 'Host', color: '#111111' },
        { id: 'player-a', name: 'A', color: '#222222' },
        { id: 'player-b', name: 'B', color: '#333333' },
      ]
      snapA.playerOrderByRound = { '1': ['host-p', 'player-a', 'player-b'] }

      const snapB = structuredClone(snapA)
      snapB.activePlayerId = 'player-b'

      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestA,
        encodeGuestUpdate(snapA, { kind: 'selectPlayer', playerId: 'player-a', sentAt: 1 }),
      )
      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestB,
        encodeGuestUpdate(snapB, { kind: 'selectPlayer', playerId: 'player-b', sentAt: 2 }),
      )

      assert.equal(wire.mirror.activePlayerId, 'player-a')
    })
  },
)

test(
  'guest hello during active cooldown still rebroadcasts without merge',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTHOSTHEL2'
    const guestStableId = 'GTGUESTHEL2'
    const suffix = 'HEL2'

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
      const sessionMod = await importGameTimerSession(`hello-cool-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const wire = bindHostMirrorHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const scopedSnap = structuredClone(HOST_TRUTH)
      scopedSnap.activePlayerId = 'guest-p'
      scopedSnap.players = [{ id: 'guest-p', name: 'Guest', color: '#222222' }]
      scopedSnap.playerOrderByRound = { '1': ['guest-p'] }

      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestUpdate(scopedSnap, { kind: 'selectPlayer', playerId: 'guest-p', sentAt: 1 }),
      )
      assert.equal(wire.mirror.activePlayerId, 'guest-p')

      const setsBeforeHello = harness.sets.length
      simulateHostInboxMessage(
        harness,
        'gameTimerRooms',
        suffix,
        guestStableId,
        encodeGuestHello(guestStableId),
      )

      assert.equal(wire.applyCount, 1, 'hello must not merge another guest snapshot')
      const helloBroadcasts = gtStateBroadcasts(harness.sets.slice(setsBeforeHello))
      assert.equal(helloBroadcasts.length, 1)
      assert.equal(helloBroadcasts[0].snapshot.activePlayerId, 'guest-p')
    })
  },
)

afterEach(rtdbAfterEach)
