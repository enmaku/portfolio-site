import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GUEST_INTENT_DEBOUNCE_MS,
  authoritativeSnapshotAfterGuestMessage,
  createGuestIntentDeduper,
  hostShouldApplyGuestSnapshot,
  isDebouncedGuestIntentKind,
  isWellFormedGuestIntent,
} from './guestIntentDedupe.js'

test('duplicate selectPlayer same player inside debounce window: second suppressed', () => {
  const deduper = createGuestIntentDeduper()
  const t0 = 1_000_000
  const parsed = (intent) => ({ snapshot: {}, intent })
  const i1 = { kind: 'selectPlayer', playerId: 'p1', sentAt: t0 }
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0), true)
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0 + 10), false)
})

test('duplicate selectPlayer outside debounce window: both apply', () => {
  const deduper = createGuestIntentDeduper()
  const t0 = 2_000_000
  const parsed = (intent) => ({ snapshot: {}, intent })
  const i1 = { kind: 'selectPlayer', playerId: 'p1', sentAt: t0 }
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0), true)
  assert.equal(
    hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0 + GUEST_INTENT_DEBOUNCE_MS + 1),
    true,
  )
})

test('duplicate registerHardPass same player inside window: second suppressed', () => {
  const deduper = createGuestIntentDeduper()
  const t0 = 3_000_000
  const parsed = (intent) => ({ snapshot: {}, intent })
  const i1 = { kind: 'registerHardPass', playerId: 'p1', sentAt: t0 }
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0), true)
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0 + 5), false)
})

test('duplicate registerHardPass outside window: both apply', () => {
  const deduper = createGuestIntentDeduper()
  const t0 = 4_000_000
  const parsed = (intent) => ({ snapshot: {}, intent })
  const i1 = { kind: 'registerHardPass', playerId: 'p1', sentAt: t0 }
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0), true)
  assert.equal(
    hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0 + GUEST_INTENT_DEBOUNCE_MS + 50),
    true,
  )
})

test('deduper uses shared window constant by default', () => {
  const deduper = createGuestIntentDeduper()
  const boundary = GUEST_INTENT_DEBOUNCE_MS - 1
  const t0 = 0
  const parsed = (intent) => ({ snapshot: {}, intent })
  const i1 = { kind: 'selectPlayer', playerId: 'x', sentAt: t0 }
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0), true)
  assert.equal(hostShouldApplyGuestSnapshot(parsed(i1), deduper, t0 + boundary), false)
})

test('messages without debounced intent always apply', () => {
  const deduper = createGuestIntentDeduper()
  const parsed = { snapshot: {} }
  assert.equal(hostShouldApplyGuestSnapshot(parsed, deduper, 0), true)
  assert.equal(hostShouldApplyGuestSnapshot(parsed, deduper, 1), true)
})

test('well-formed intent helper', () => {
  assert.equal(isWellFormedGuestIntent(null), false)
  assert.equal(
    isWellFormedGuestIntent({ kind: 'selectPlayer', playerId: 'a', sentAt: 1 }),
    true,
  )
  assert.equal(
    isWellFormedGuestIntent({ kind: 'registerHardPass', playerId: 'a', sentAt: 1 }),
    true,
  )
  assert.equal(isWellFormedGuestIntent({ kind: 'selectPlayer', playerId: '', sentAt: 1 }), false)
  assert.equal(isWellFormedGuestIntent({ kind: 'endTurnNext', playerId: 'a', sentAt: 1 }), false)
})

test('debounced kind guard', () => {
  assert.equal(isDebouncedGuestIntentKind({ kind: 'selectPlayer', playerId: 'a', sentAt: 1 }), true)
  assert.equal(
    isDebouncedGuestIntentKind({ kind: 'registerHardPass', playerId: 'a', sentAt: 1 }),
    true,
  )
})

test('authoritative path: duplicate intent applies snapshot only once; still returns getSnapshot', () => {
  const deduper = createGuestIntentDeduper()
  let applied = 0
  let state = { n: 0 }
  const snap = (n) => ({ n })
  const apply = (s) => {
    applied++
    state = s
  }
  const get = () => state
  const intent = { kind: 'selectPlayer', playerId: 'p1', sentAt: 0 }
  const out1 = authoritativeSnapshotAfterGuestMessage({ snapshot: snap(1), intent }, deduper, 0, apply, get)
  const out2 = authoritativeSnapshotAfterGuestMessage({ snapshot: snap(2), intent }, deduper, 5, apply, get)
  assert.equal(applied, 1)
  assert.deepEqual(out1.broadcastSnapshot, { n: 1 })
  assert.deepEqual(out2.broadcastSnapshot, { n: 1 })
  assert.equal(out1.appliedGuestSnapshot, true)
  assert.equal(out2.appliedGuestSnapshot, false)
})
