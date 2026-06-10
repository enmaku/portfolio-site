import assert from 'node:assert/strict'
import test from 'node:test'
import { SCOPED_GUEST_INTENT_KINDS } from './protocol.js'
import { guestIntentForAction } from './gameTimerPiniaBridge.js'

test('guestIntentForAction returns well-formed intent for each scoped sync action', () => {
  const sentAt = 42
  for (const kind of SCOPED_GUEST_INTENT_KINDS) {
    const args =
      kind === 'selectPlayer' || kind === 'registerHardPass' || kind === 'undoHardPass'
        ? ['p1']
        : []
    const intent = guestIntentForAction(kind, args, sentAt)
    assert.ok(intent, kind)
    assert.equal(intent.kind, kind)
    assert.equal(intent.sentAt, sentAt)
    if ('playerId' in intent) {
      assert.equal(intent.playerId, 'p1')
    }
  }
})

test('guestIntentForAction returns undefined for non-scoped sync actions', () => {
  assert.equal(guestIntentForAction('addPlayer', ['Ada'], 1), undefined)
})
