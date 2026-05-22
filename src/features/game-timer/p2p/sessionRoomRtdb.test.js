import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'

test('ROOM_CLAIM_RESET_PATHS matches game-timer claim reset spec', () => {
  assert.deepEqual(ROOM_CLAIM_RESET_PATHS, ['inbox', 'state', 'ended', 'hostVisible'])
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('hostPing'))
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('welcome'))
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('guestOnline'))
})

test('ended marker is cleared on fresh claim via claim reset paths', () => {
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('ended'))
})
