/**
 * Run: node --test src/features/movie-vote/p2p/hostInboxWire.test.js
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeDraft, encodeVote } from './protocol.js'
import { createMovieVoteWireState } from './movieVoteWireState.js'
import { createHostInboxWire } from './hostInboxWire.js'

/** @param {object} [overrides] */
function baseDeps(overrides = {}) {
  const wireState = createMovieVoteWireState()
  return {
    wireState,
    roomChild: () => ({}),
    setRtdb: async () => {},
    getSessionSuffix: () => 'ROOM01',
    getNextSeq: () => 1,
    setNextSeq: () => {},
    buildPublicPayload: () => ({ phase: 'suggest', movies: [], ballotOrderIds: [], voterIds: [], votesByParticipant: {}, votingMethod: 'irv' }),
    hostBroadcastState: () => {},
    tryFinishVoting: () => {},
    cancelParticipantRemoval: () => {},
    applyGuestDraft: () => {},
    applyGuestVote: () => false,
    ...overrides,
  }
}

test('handleHostInboxMessage applies guest draft through injected callback', () => {
  /** @type {Array<{ participantId: string, entry: { picks: unknown[], ready: boolean } }>} */
  const applied = []
  const deps = baseDeps({
    applyGuestDraft: (participantId, entry) => applied.push({ participantId, entry }),
  })
  const wire = createHostInboxWire(deps)
  deps.wireState.stableIdToParticipant.set('stable-1', 'guest-1')

  wire.handleHostInboxMessage(
    'stable-1',
    encodeDraft([{ localId: 'p1', title: 'Film', source: 'custom' }], true, 'guest-1'),
  )

  assert.equal(applied.length, 1)
  assert.equal(applied[0]?.participantId, 'guest-1')
  assert.equal(applied[0]?.entry.ready, true)
  assert.equal(applied[0]?.entry.picks[0]?.title, 'Film')
})

test('handleHostInboxMessage broadcasts after accepted guest vote', () => {
  let broadcastCount = 0
  let finishCount = 0
  const deps = baseDeps({
    applyGuestVote: () => true,
    hostBroadcastState: () => {
      broadcastCount += 1
    },
    tryFinishVoting: () => {
      finishCount += 1
    },
  })
  const wire = createHostInboxWire(deps)
  deps.wireState.stableIdToParticipant.set('stable-1', 'guest-1')

  wire.handleHostInboxMessage('stable-1', encodeVote('guest-1', ['m1', 'm2']))

  assert.equal(broadcastCount, 1)
  assert.equal(finishCount, 1)
})

test('handleHostInboxMessage skips broadcast when guest vote rejected', () => {
  let broadcastCount = 0
  let finishCount = 0
  const deps = baseDeps({
    applyGuestVote: () => false,
    hostBroadcastState: () => {
      broadcastCount += 1
    },
    tryFinishVoting: () => {
      finishCount += 1
    },
  })
  const wire = createHostInboxWire(deps)
  deps.wireState.stableIdToParticipant.set('stable-1', 'guest-1')

  wire.handleHostInboxMessage('stable-1', encodeVote('guest-1', ['m1', 'm2']))

  assert.equal(broadcastCount, 0)
  assert.equal(finishCount, 0)
})
