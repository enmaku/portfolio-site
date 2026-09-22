import assert from 'node:assert/strict'
import test from 'node:test'
import {
  encodeDraft,
  encodeVote,
  parseDraft,
  parseVote,
  resetGuestInboxWriteSeqForTests,
} from './protocol.js'

test('parseDraft accepts RTDB payloads that omit empty picks array', () => {
  resetGuestInboxWriteSeqForTests()
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

test('encodeVote consecutive identical rankings produce distinct inbox payloads', () => {
  resetGuestInboxWriteSeqForTests()
  const a = encodeVote('guest-1', ['m-a', 'm-b'])
  const b = encodeVote('guest-1', ['m-a', 'm-b'])
  assert.notDeepEqual(a, b)
  assert.deepEqual(parseVote(a), { participantId: 'guest-1', ranking: ['m-a', 'm-b'] })
  assert.deepEqual(parseVote(b), { participantId: 'guest-1', ranking: ['m-a', 'm-b'] })
})

test('encodeDraft consecutive identical drafts produce distinct inbox payloads', () => {
  resetGuestInboxWriteSeqForTests()
  const a = encodeDraft([], true, 'guest-1')
  const b = encodeDraft([], true, 'guest-1')
  assert.notDeepEqual(a, b)
  assert.deepEqual(parseDraft(a), parseDraft(b))
})
