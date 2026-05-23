import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeDraft, parseDraft } from './protocol.js'

test('parseDraft accepts RTDB payloads that omit empty picks array', () => {
  const rtdbStored = { ...encodeDraft([], true, 'guest-1') }
  delete rtdbStored.picks
  assert.equal('picks' in rtdbStored, false)

  const parsed = parseDraft(rtdbStored)
  assert.ok(parsed)
  assert.equal(parsed.participantId, 'guest-1')
  assert.equal(parsed.ready, true)
  assert.deepEqual(parsed.picks, [])
})

test('parseDraft rejects non-draft messages', () => {
  assert.equal(parseDraft({ type: 'mv-other', participantId: 'g', ready: true }), null)
})
