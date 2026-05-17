import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOM_CLAIM_RESET_PATHS, isRoomMarkedEnded } from './sessionRoomRtdb.js'

test('ROOM_CLAIM_RESET_PATHS matches game-timer claim reset spec', () => {
  assert.deepEqual(ROOM_CLAIM_RESET_PATHS, ['inbox', 'state', 'ended', 'hostVisible'])
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('hostPing'))
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('welcome'))
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('guestOnline'))
})

test('ended marker alone does not block reclaim after stale hostPing', () => {
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('ended'))
  assert.equal(isRoomMarkedEnded(1_700_000_000_000), true)
})

test('isRoomMarkedEnded is false only when ended node is absent', () => {
  assert.equal(isRoomMarkedEnded(null), false)
  assert.equal(isRoomMarkedEnded(undefined), false)
  assert.equal(isRoomMarkedEnded(1_700_000_000_000), true)
})
