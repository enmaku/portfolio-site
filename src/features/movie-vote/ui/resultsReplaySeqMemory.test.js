import assert from 'node:assert/strict'
import test from 'node:test'
import { readLastReplayedSeq, rememberReplayedSeq } from './resultsReplaySeqMemory.js'

function mockStorage() {
  /** @type {Record<string, string>} */
  const data = {}
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

test('rememberReplayedSeq persists per room suffix', () => {
  const storage = mockStorage()
  rememberReplayedSeq('ABC123', 5, storage)
  assert.equal(readLastReplayedSeq('ABC123', storage), 5)
  assert.equal(readLastReplayedSeq('OTHER', storage), null)
})

test('readLastReplayedSeq returns null for invalid stored value', () => {
  const storage = mockStorage()
  storage.setItem('mv-results-replay-seq:BAD', 'nope')
  assert.equal(readLastReplayedSeq('BAD', storage), null)
})

test('rememberReplayedSeq ignores invalid seq', () => {
  const storage = mockStorage()
  rememberReplayedSeq('ABC', 0, storage)
  rememberReplayedSeq('ABC', -1, storage)
  rememberReplayedSeq('', 5, storage)
  assert.equal(readLastReplayedSeq('ABC', storage), null)
})
