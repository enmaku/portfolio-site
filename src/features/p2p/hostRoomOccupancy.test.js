import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HOST_PING_FRESH_MS,
  assertHostRoomClaimable,
  canClaimHostRoom,
  isHostPingFresh,
  isHostPingPresent,
  isReclaimOwnHostRoom,
  isRoomMarkedEnded,
  isRoomOccupiedByOtherHost,
} from './hostRoomOccupancy.js'

test('isRoomMarkedEnded is false only when ended node is absent', () => {
  assert.equal(isRoomMarkedEnded(null), false)
  assert.equal(isRoomMarkedEnded(undefined), false)
  assert.equal(isRoomMarkedEnded(1_700_000_000_000), true)
})

test('isHostPingFresh accepts recent numeric timestamps', () => {
  const now = 1_000_000
  assert.equal(isHostPingFresh(now - 1, now), true)
  assert.equal(isHostPingFresh(now - HOST_PING_FRESH_MS + 1, now), true)
})

test('isHostPingFresh rejects stale, missing, or invalid values', () => {
  const now = 2_000_000
  assert.equal(isHostPingFresh(now - HOST_PING_FRESH_MS, now), false)
  assert.equal(isHostPingFresh(now - HOST_PING_FRESH_MS - 1, now), false)
  assert.equal(isHostPingFresh(null, now), false)
  assert.equal(isHostPingFresh('123', now), false)
  assert.equal(isHostPingFresh(0, now), false)
})

test('isHostPingPresent detects an active host marker', () => {
  assert.equal(isHostPingPresent(1), true)
  assert.equal(isHostPingPresent(null), false)
})

test('isRoomOccupiedByOtherHost uses hostClientId when present', () => {
  const now = 3_000_000
  const oldPing = now - HOST_PING_FRESH_MS - 1
  assert.equal(isRoomOccupiedByOtherHost(oldPing, 'HOST-A', 'HOST-B', now), true)
  assert.equal(isRoomOccupiedByOtherHost(oldPing, 'HOST-A', 'HOST-A', now), false)
  assert.equal(isRoomOccupiedByOtherHost(null, 'HOST-A', 'HOST-B', now), false)
})

test('isRoomOccupiedByOtherHost falls back to ping freshness without hostClientId', () => {
  const now = 4_000_000
  assert.equal(isRoomOccupiedByOtherHost(now - 1, null, 'HOST-A', now), true)
  assert.equal(isRoomOccupiedByOtherHost(now - HOST_PING_FRESH_MS, null, 'HOST-A', now), false)
})

test('canClaimHostRoom allows claim when ended despite fresh hostPing', () => {
  const now = 5_000_000
  const freshPing = now - 1
  assert.equal(canClaimHostRoom(freshPing, null, { nowMs: now, stableClientId: 'GUEST' }), false)
  assert.equal(
    canClaimHostRoom(freshPing, 1_700_000_000_000, { nowMs: now, stableClientId: 'GUEST' }),
    true,
  )
})

test('canClaimHostRoom allows reclaim when hostClientId matches this browser', () => {
  const now = 6_000_000
  const freshPing = now - 1
  assert.equal(
    canClaimHostRoom(freshPing, null, {
      nowMs: now,
      hostClientId: 'CLIENT-ABC',
      stableClientId: 'CLIENT-ABC',
    }),
    true,
  )
  assert.equal(
    canClaimHostRoom(freshPing, null, {
      nowMs: now,
      hostClientId: 'OTHER',
      stableClientId: 'CLIENT-ABC',
    }),
    false,
  )
})

test('canClaimHostRoom allows claim when hostPing is absent', () => {
  const now = 7_000_000
  assert.equal(canClaimHostRoom(null, null, { nowMs: now, stableClientId: 'GUEST' }), true)
})

test('isReclaimOwnHostRoom allows reclaim without hostPing after refresh', () => {
  assert.equal(isReclaimOwnHostRoom('CLIENT-ABC', null, 'CLIENT-ABC'), true)
  assert.equal(isReclaimOwnHostRoom('CLIENT-ABC', 1_700_000_000_000, 'CLIENT-ABC'), false)
  assert.equal(isReclaimOwnHostRoom('OTHER', null, 'CLIENT-ABC'), false)
})

test('isReclaimOwnHostRoom matches game-timer reclaim without requiring hostPing', () => {
  const now = 8_000_000
  const stalePing = now - HOST_PING_FRESH_MS - 1
  assert.equal(isReclaimOwnHostRoom('CLIENT-ABC', null, 'CLIENT-ABC'), true)
  assert.equal(
    canClaimHostRoom(stalePing, null, {
      nowMs: now,
      hostClientId: 'CLIENT-ABC',
      stableClientId: 'CLIENT-ABC',
    }),
    true,
  )
})

test('assertHostRoomClaimable throws when another host occupies suffix', () => {
  const now = 9_000_000
  const freshPing = now - 1
  assert.throws(
    () =>
      assertHostRoomClaimable(freshPing, null, {
        nowMs: now,
        hostClientId: 'OTHER-HOST',
        stableClientId: 'CLIENT-ABC',
      }),
    /Room code in use/,
  )
})

test('assertHostRoomClaimable allows same-principal resume without hostPing', () => {
  assert.doesNotThrow(() =>
    assertHostRoomClaimable(null, null, {
      hostClientId: 'CLIENT-ABC',
      stableClientId: 'CLIENT-ABC',
    }),
  )
})
