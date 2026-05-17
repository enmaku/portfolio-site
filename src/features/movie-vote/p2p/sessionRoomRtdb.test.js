import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOM_CLAIM_RESET_PATHS, isRoomMarkedEnded } from './sessionRoomRtdb.js'

test('ROOM_CLAIM_RESET_PATHS clears stale session payload but not hostPing', () => {
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('ended'))
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('state'))
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('inbox'))
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('hostPing'))
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
