import assert from 'node:assert/strict'
import test from 'node:test'
import { ROOM_CLAIM_RESET_PATHS } from './sessionRoomRtdb.js'

test('ROOM_CLAIM_RESET_PATHS clears stale session payload but not hostPing', () => {
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('ended'))
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('state'))
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('inbox'))
  assert.ok(!ROOM_CLAIM_RESET_PATHS.includes('hostPing'))
})

test('ended marker is cleared on fresh claim via claim reset paths', () => {
  assert.ok(ROOM_CLAIM_RESET_PATHS.includes('ended'))
})
