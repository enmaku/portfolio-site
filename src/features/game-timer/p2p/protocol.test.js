import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeForRtdb } from '../firebase/rtdb.js'
import {
  coerceRoundIdMap,
  coerceStringIdList,
  encodeGuestUpdate,
  encodeHostSnapshot,
  isValidSnapshot,
  normalizeSnapshotFromRtdb,
  parseGuestMessage,
  parseHostMessage,
} from './protocol.js'

/** Simulates RTDB dropping keys whose value was written as `null`. */
function stripRtdbNullKeys(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(stripRtdbNullKeys)
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, child] of Object.entries(value)) {
    if (child === null) continue
    out[key] = stripRtdbNullKeys(child)
  }
  return out
}

function baseSnapshot() {
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

test('isValidSnapshot accepts RTDB-shaped snapshot with nullable turn keys omitted', () => {
  const rtdbSnap = stripRtdbNullKeys(sanitizeForRtdb(baseSnapshot()))
  assert.equal(isValidSnapshot(rtdbSnap), true)
  assert.equal(isValidSnapshot(normalizeSnapshotFromRtdb(rtdbSnap)), true)
})

test('coerceStringIdList rebuilds RTDB array maps for hard pass order', () => {
  assert.deepEqual(coerceStringIdList(['a', 'b']), ['a', 'b'])
  assert.deepEqual(coerceStringIdList({ 0: 'p1', 1: 'p2' }), ['p1', 'p2'])
  assert.deepEqual(coerceStringIdList({ 1: 'p2', 0: 'p1' }), ['p1', 'p2'])
})

test('normalizeSnapshotFromRtdb coerces hardPassOrderByRound lists', () => {
  const snap = normalizeSnapshotFromRtdb({
    players: [],
    activePlayerId: null,
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: { 1: { 0: 'a', 1: 'b' } },
    hardPassEnabled: true,
    hardPassOrderNextRound: false,
    hardPassOrderByRound: { 1: { 0: 'p1' } },
  })
  assert.deepEqual(snap.playerOrderByRound['1'], ['a', 'b'])
  assert.deepEqual(snap.hardPassOrderByRound['1'], ['p1'])
  assert.deepEqual(coerceRoundIdMap({ 1: { 0: 'x' } })['1'], ['x'])
})

test('coerceRoundIdMap recovers RTDB sparse array for round-keyed maps', () => {
  const sparse = []
  sparse[1] = ['p1', 'p2']
  assert.deepEqual(coerceRoundIdMap(sparse), { 1: ['p1', 'p2'] })
})

test('coerceRoundIdMap recovers flat player-id array using default round', () => {
  assert.deepEqual(coerceRoundIdMap(['p1', 'p2'], 1), { 1: ['p1', 'p2'] })
  assert.deepEqual(normalizeSnapshotFromRtdb({
    ...baseSnapshot(),
    round: 2,
    hardPassEnabled: true,
    hardPassOrderByRound: ['a', 'b'],
  }).hardPassOrderByRound, { 2: ['a', 'b'] })
})

test('parseHostMessage accepts RTDB state envelope without type discriminator', () => {
  const snap = {
    ...baseSnapshot(),
    players: [
      { id: 'p1', name: 'Ada', color: '#111', bankedMs: 0, bankedMsByRound: {} },
      { id: 'p2', name: 'Bob', color: '#222', bankedMs: 0, bankedMsByRound: {} },
    ],
    activePlayerId: 'p1',
    turnStartedAt: 1_700_000_000_000,
    turnStartedRound: 1,
    playerOrderByRound: { 1: ['p1', 'p2'] },
    hardPassEnabled: false,
    hardPassOrderNextRound: false,
  }
  const asStored = stripRtdbNullKeys(sanitizeForRtdb(encodeHostSnapshot(snap, 3)))
  delete asStored.type

  const parsed = parseHostMessage(asStored)
  assert.ok(parsed)
  assert.equal(parsed.seq, 3)
  assert.equal(parsed.snapshot.activePlayerId, 'p1')
  assert.equal(parsed.snapshot.players.length, 2)
})
