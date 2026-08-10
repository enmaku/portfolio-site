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
    getHostParticipantName: () => 'Host',
    clearGuestKick: () => {},
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

test('orphan inbox draft does not mint an empty-name guest seat', () => {
  /** @type {unknown[]} */
  const applied = []
  const deps = baseDeps({
    applyGuestDraft: (...args) => applied.push(args),
  })
  const wire = createHostInboxWire(deps)

  wire.handleHostInboxMessage(
    'stable-orphan',
    encodeDraft([{ localId: 'p1', title: 'Film', source: 'custom' }], true, 'ghost-pid'),
  )

  assert.equal(applied.length, 0)
  assert.equal(deps.wireState.guestDrafts.size, 0)
  assert.equal(deps.wireState.stableIdToParticipant.size, 0)
})

test('hello without a participant name does not allocate a seat', () => {
  const deps = baseDeps()
  const wire = createHostInboxWire(deps)

  wire.onGuestHello('stable-noname', '   ')

  assert.equal(deps.wireState.guestDrafts.size, 0)
  assert.equal(deps.wireState.stableIdToParticipant.has('stable-noname'), false)
})

test('onGuestHello clears prior kick marker so ejected guests can rejoin', () => {
  /** @type {string[]} */
  const cleared = []
  const deps = baseDeps({
    clearGuestKick: (stableId) => cleared.push(stableId),
  })
  const wire = createHostInboxWire(deps)

  wire.onGuestHello('stable-rejoin', 'Brian')

  assert.deepEqual(cleared, ['stable-rejoin'])
  assert.equal(deps.wireState.stableIdToParticipant.has('stable-rejoin'), true)
})
