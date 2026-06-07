/**
 * Run: node --test src/features/game-timer/p2p/sessionFacadeDomainWire.test.js
 *
 * Guest inbound monotonic authority broadcast on snapshot messages — domain wire only
 * (not connection posture; see posture contract tests separately).
 */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { encodeHostSnapshot, MSG_HOST_SNAPSHOT } from './protocol.js'
import * as sessionMod from './session.js'
import {
  bindGameTimerP2PHandlers,
  broadcastGameTimerSnapshot,
  handleGuestInbound,
  sessionSuffix,
  teardownSession,
} from './session.js'
import { resetGameTimerP2PWireStateForTests } from './session.testExports.js'

/** @returns {GameTimerSyncPayload} */
function baseSnapshot(overrides = {}) {
  return {
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
    hardPassEnabled: false,
    hardPassOrderNextRound: false,
    hardPassOrderByRound: {},
    ...overrides,
  }
}

/** @param {string} playerId @param {number} [round] @returns {GameTimerSyncPayload} */
function snapshotWithActivePlayer(playerId, round = 1) {
  return baseSnapshot({
    players: [{ id: playerId, name: playerId, color: '#111111' }],
    activePlayerId: playerId,
    round,
    playerOrderByRound: { [String(round)]: [playerId] },
  })
}

function bindFakeMirrorHandlers() {
  /** @type {GameTimerSyncPayload | null} */
  let mirror = null
  let applyCount = 0

  bindGameTimerP2PHandlers({
    getSnapshot: () => mirror ?? baseSnapshot(),
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
    /** Simulates local mirror drift without host authority (e.g. reconnect fork). */
    setLocalFork(snap) {
      mirror = structuredClone(snap)
    },
  }
}

test('guest inbound snapshot applies only when seq strictly increases', () => {
  const wire = bindFakeMirrorHandlers()
  const snapA = snapshotWithActivePlayer('p-a')
  const snapB = snapshotWithActivePlayer('p-b', 2)

  handleGuestInbound(encodeHostSnapshot(snapA, 1))
  assert.equal(wire.applyCount, 1)
  assert.equal(wire.mirror?.activePlayerId, 'p-a')

  handleGuestInbound(encodeHostSnapshot(snapB, 1))
  assert.equal(wire.applyCount, 1, 'equal seq must not re-apply')
  assert.equal(wire.mirror?.activePlayerId, 'p-a')

  handleGuestInbound(encodeHostSnapshot(snapB, 2))
  assert.equal(wire.applyCount, 2)
  assert.equal(wire.mirror?.activePlayerId, 'p-b')
  assert.equal(wire.mirror?.round, 2)
})

test('guest inbound snapshot ignores regressive seq without changing mirror', () => {
  const wire = bindFakeMirrorHandlers()
  const authoritative = snapshotWithActivePlayer('host-truth', 3)

  handleGuestInbound(encodeHostSnapshot(authoritative, 5))
  assert.equal(wire.applyCount, 1)

  wire.setLocalFork(snapshotWithActivePlayer('local-fork'))

  handleGuestInbound(encodeHostSnapshot(snapshotWithActivePlayer('stale-host'), 3))
  assert.equal(wire.applyCount, 1, 'regressive seq is a no-op on applySnapshot')
  assert.equal(wire.mirror?.activePlayerId, 'local-fork')

  handleGuestInbound(encodeHostSnapshot(authoritative, 5))
  assert.equal(wire.applyCount, 1, 'duplicate max seq is still ignored')
  assert.equal(wire.mirror?.activePlayerId, 'local-fork')
})

test('guest inbound snapshot ignores invalid and malformed wire shapes', () => {
  const wire = bindFakeMirrorHandlers()
  const valid = encodeHostSnapshot(snapshotWithActivePlayer('kept'), 1)

  handleGuestInbound(valid)
  assert.equal(wire.applyCount, 1)

  const malformed = [
    null,
    'not-an-object',
    {},
    { type: MSG_HOST_SNAPSHOT, seq: 0, snapshot: baseSnapshot() },
    { type: MSG_HOST_SNAPSHOT, seq: 1 },
    { type: MSG_HOST_SNAPSHOT, seq: 1, snapshot: { round: 'bad', players: [] } },
    { type: 'gt-wrong', seq: 2, snapshot: baseSnapshot() },
  ]

  for (const raw of malformed) {
    handleGuestInbound(raw)
  }

  assert.equal(wire.applyCount, 1, 'malformed host snapshots must not touch mirror handlers')
  assert.equal(wire.mirror?.activePlayerId, 'kept')
})

test('guest reconnect coherence: authoritative broadcast overwrites local mirror fork', () => {
  const wire = bindFakeMirrorHandlers()
  const beforeDisconnect = snapshotWithActivePlayer('host-seat', 1)

  handleGuestInbound(encodeHostSnapshot(beforeDisconnect, 1))
  assert.equal(wire.mirror?.activePlayerId, 'host-seat')

  wire.setLocalFork(snapshotWithActivePlayer('guest-fork', 1))

  const afterReconnect = snapshotWithActivePlayer('host-seat-resumed', 2)
  handleGuestInbound(encodeHostSnapshot(afterReconnect, 2))

  assert.equal(wire.applyCount, 2)
  assert.equal(wire.mirror?.activePlayerId, 'host-seat-resumed')
  assert.equal(wire.mirror?.round, 2)
})

test('guest broadcastGameTimerSnapshot does not promote local state as mirror truth', () => {
  const wire = bindFakeMirrorHandlers()
  const hostTruth = snapshotWithActivePlayer('host-authority', 1)

  handleGuestInbound(encodeHostSnapshot(hostTruth, 1))
  assert.equal(wire.applyCount, 1)

  sessionSuffix.value = 'WIRE01'
  const localOnly = snapshotWithActivePlayer('guest-local-fork', 9)
  broadcastGameTimerSnapshot(localOnly, {
    kind: 'selectPlayer',
    playerId: 'guest-local-fork',
    sentAt: Date.now(),
  })

  assert.equal(wire.applyCount, 1, 'guest outbound snapshot must not call applySnapshot')
  assert.equal(wire.mirror?.activePlayerId, 'host-authority')
  assert.equal(wire.mirror?.round, 1)
})

afterEach(() => {
  teardownSession()
  resetGameTimerP2PWireStateForTests(sessionMod)
})
