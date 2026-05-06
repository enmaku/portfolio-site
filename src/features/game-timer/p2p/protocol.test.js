import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeGuestUpdate, isValidSnapshot, parseGuestMessage } from './protocol.js'

function baseSnapshot() {
  return {
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  }
}

test('snapshot accepts missing or numeric totalGameStartedAt', () => {
  assert.equal(isValidSnapshot(baseSnapshot()), true)
  assert.equal(isValidSnapshot({ ...baseSnapshot(), totalGameStartedAt: null }), true)
  assert.equal(isValidSnapshot({ ...baseSnapshot(), totalGameStartedAt: 1234 }), true)
})

test('snapshot rejects invalid totalGameStartedAt type', () => {
  assert.equal(isValidSnapshot({ ...baseSnapshot(), totalGameStartedAt: '1234' }), false)
})

test('guest update round-trips optional intent', () => {
  const snap = baseSnapshot()
  const intent = { kind: 'selectPlayer', playerId: 'p1', sentAt: 99 }
  const wire = encodeGuestUpdate(snap, intent)
  const parsed = parseGuestMessage(wire)
  assert.ok(parsed)
  assert.deepEqual(parsed.snapshot, snap)
  assert.deepEqual(parsed.intent, intent)
})

test('parseGuestMessage drops malformed intent but keeps snapshot', () => {
  const snap = baseSnapshot()
  const parsed = parseGuestMessage({
    type: 'gt-u',
    snapshot: snap,
    intent: { kind: 'selectPlayer', playerId: '', sentAt: 1 },
  })
  assert.ok(parsed)
  assert.deepEqual(parsed.snapshot, snap)
  assert.equal(parsed.intent, undefined)
})
