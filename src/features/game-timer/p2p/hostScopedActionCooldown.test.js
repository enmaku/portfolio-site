import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HOST_SCOPED_ACTION_COOLDOWN_MS,
  authoritativeSnapshotAfterGuestMessage,
  createHostScopedActionCooldown,
  honorScopedGuestAction,
  hostShouldApplyGuestSnapshot,
  isScopedGuestAction,
} from './hostScopedActionCooldown.js'

test('notifyHonoredScopedAction arms cooldown: scoped guest message rejected inside window', () => {
  const cooldown = createHostScopedActionCooldown()
  const t0 = 1_000_000
  cooldown.notifyHonoredScopedAction(t0)
  assert.equal(cooldown.shouldRejectScopedGuestMessage(t0 + 1), true)
})

test('scoped guest message accepted after cooldown window expires', () => {
  const cooldown = createHostScopedActionCooldown()
  const t0 = 2_000_000
  cooldown.notifyHonoredScopedAction(t0)
  assert.equal(cooldown.shouldRejectScopedGuestMessage(t0 + 10), true)
  assert.equal(
    cooldown.shouldRejectScopedGuestMessage(t0 + HOST_SCOPED_ACTION_COOLDOWN_MS + 1),
    false,
  )
})

test('each honored scoped change restarts cooldown window', () => {
  const cooldown = createHostScopedActionCooldown()
  const t0 = 3_000_000
  cooldown.notifyHonoredScopedAction(t0)
  cooldown.notifyHonoredScopedAction(t0 + 200)
  assert.equal(cooldown.shouldRejectScopedGuestMessage(t0 + 400), true)
})

test('reject check does not extend cooldown window', () => {
  const cooldown = createHostScopedActionCooldown()
  const t0 = 4_000_000
  cooldown.notifyHonoredScopedAction(t0)
  assert.equal(cooldown.shouldRejectScopedGuestMessage(t0 + 100), true)
  assert.equal(cooldown.shouldRejectScopedGuestMessage(t0 + HOST_SCOPED_ACTION_COOLDOWN_MS + 1), false)
})

test('non-scoped guest messages bypass cooldown', () => {
  const cooldown = createHostScopedActionCooldown()
  const t0 = 5_000_000
  cooldown.notifyHonoredScopedAction(t0)
  const parsedNoIntent = { snapshot: {} }
  assert.equal(hostShouldApplyGuestSnapshot(parsedNoIntent, cooldown, t0 + 1), true)
  const parsedAddPlayer = {
    snapshot: {},
    intent: { kind: 'addPlayer', sentAt: t0 },
  }
  assert.equal(hostShouldApplyGuestSnapshot(parsedAddPlayer, cooldown, t0 + 1), true)
})

test('isScopedGuestAction recognizes scoped kinds', () => {
  assert.equal(
    isScopedGuestAction({ kind: 'selectPlayer', playerId: 'p1', sentAt: 1 }),
    true,
  )
  assert.equal(isScopedGuestAction({ kind: 'endTurnNext', sentAt: 1 }), true)
  assert.equal(isScopedGuestAction({ kind: 'addPlayer', sentAt: 1 }), false)
  assert.equal(isScopedGuestAction(null), false)
})

test('honorScopedGuestAction arms cooldown for scoped intent only', () => {
  const cooldown = createHostScopedActionCooldown()
  const t0 = 6_000_000
  honorScopedGuestAction(cooldown, { kind: 'endTurnNext', sentAt: 1 }, t0)
  assert.equal(cooldown.shouldRejectScopedGuestMessage(t0 + 1), true)
  const fresh = createHostScopedActionCooldown()
  honorScopedGuestAction(fresh, undefined, t0)
  assert.equal(fresh.shouldRejectScopedGuestMessage(t0 + 1), false)
  honorScopedGuestAction(fresh, { kind: 'addPlayer', sentAt: 1 }, t0)
  assert.equal(fresh.shouldRejectScopedGuestMessage(t0 + 1), false)
})

test('authoritative path: scoped reject applies snapshot only once; returns rejectedScopedGuest flag', () => {
  const cooldown = createHostScopedActionCooldown()
  let applied = 0
  let state = { n: 0 }
  const snap = (n) => ({ n })
  const apply = (s) => {
    applied++
    state = s
  }
  const get = () => state
  const intent = { kind: 'selectPlayer', playerId: 'p1', sentAt: 0 }
  cooldown.notifyHonoredScopedAction(0)
  const out1 = authoritativeSnapshotAfterGuestMessage(
    { snapshot: snap(1), intent },
    cooldown,
    5,
    apply,
    get,
  )
  assert.equal(applied, 0)
  assert.deepEqual(out1.broadcastSnapshot, { n: 0 })
  assert.equal(out1.appliedGuestSnapshot, false)
  assert.equal(out1.rejectedScopedGuest, true)
})
