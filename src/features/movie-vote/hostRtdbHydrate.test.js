import assert from 'node:assert/strict'
import test from 'node:test'
import { HOST_PARTICIPANT_ID } from './core.js'
import {
  applyHostStoreFromRtdbHydrate,
  hostSeatMetaFromParticipants,
  planGuestHydrateFromRtdb,
  pruneNamelessGuestDrafts,
  seedGuestDraftsFromParticipants,
} from './hostRtdbHydrate.js'
import { DEFAULT_VOTING_METHOD } from './votingMethod.js'

test('applyHostStoreFromRtdbHydrate applies public payload when RTDB state exists', () => {
  /** @type {import('./types.js').MovieVotePublicPayload[]} */
  const applied = []
  const store = {
    applyPublicPayload: (p) => applied.push(p),
    votingMethod: 'irv',
  }
  const payload = {
    phase: 'suggest',
    participants: [],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    votingMethod: 'condorcet',
  }
  applyHostStoreFromRtdbHydrate({ payload }, store)
  assert.equal(applied.length, 1)
  assert.equal(applied[0].votingMethod, 'condorcet')
})

test('applyHostStoreFromRtdbHydrate defaults voting method for fresh room', () => {
  const store = {
    applyPublicPayload: () => assert.fail('should not apply payload'),
    votingMethod: 'borda',
  }
  applyHostStoreFromRtdbHydrate(null, store)
  assert.equal(store.votingMethod, DEFAULT_VOTING_METHOD)
})

test('seedGuestDraftsFromParticipants restores name and quorum after host hydrate', () => {
  const guestDrafts = new Map([
    ['g1', { picks: [{ localId: '1', title: 'A', source: 'custom' }], ready: false, name: '', quorumRequired: true }],
  ])
  seedGuestDraftsFromParticipants(
    guestDrafts,
    [
      { id: HOST_PARTICIPANT_ID, name: 'Dave', quorumRequired: true, ready: true, pickCount: 0 },
      { id: 'g1', name: 'Brian', quorumRequired: false, ready: true, pickCount: 1 },
      { id: 'g2', name: 'Sam', quorumRequired: true, ready: false, pickCount: 0 },
    ],
    new Set(['g1', 'g2']),
  )
  assert.equal(guestDrafts.get('g1')?.name, 'Brian')
  assert.equal(guestDrafts.get('g1')?.quorumRequired, false)
  assert.equal(guestDrafts.get('g1')?.ready, false)
  assert.equal(guestDrafts.get('g1')?.picks.length, 1)
  assert.equal(guestDrafts.get('g2')?.name, 'Sam')
  assert.equal(guestDrafts.get('g2')?.quorumRequired, true)
})

test('planGuestHydrateFromRtdb keeps only welcome∩authority seats after eject', () => {
  const planned = planGuestHydrateFromRtdb(
    [
      { stableId: 'S-alive', participantId: 'g-alive' },
      { stableId: 'S-ejected', participantId: 'g-ejected' },
    ],
    [
      { id: HOST_PARTICIPANT_ID, name: 'Host', quorumRequired: true, ready: true, pickCount: 0 },
      { id: 'g-alive', name: 'Alex', quorumRequired: true, ready: false, pickCount: 0 },
      { id: 'g-stale-state', name: 'Ghost', quorumRequired: true, ready: false, pickCount: 0 },
    ],
  )
  assert.deepEqual(planned.keep, [{ stableId: 'S-alive', participantId: 'g-alive' }])
  assert.deepEqual(planned.staleWelcomeStableIds, ['S-ejected'])
  assert.deepEqual([...planned.keptParticipantIds], ['g-alive'])

  const guestDrafts = new Map([
    ['g-alive', { picks: [], ready: false, name: '', quorumRequired: true }],
    ['g-ejected', { picks: [], ready: false, name: 'Old', quorumRequired: true }],
  ])
  seedGuestDraftsFromParticipants(
    guestDrafts,
    [
      { id: 'g-alive', name: 'Alex', quorumRequired: true, ready: false, pickCount: 0 },
      { id: 'g-stale-state', name: 'Ghost', quorumRequired: true, ready: false, pickCount: 0 },
    ],
    planned.keptParticipantIds,
  )
  assert.equal(guestDrafts.has('g-alive'), true)
  assert.equal(guestDrafts.get('g-alive')?.name, 'Alex')
  assert.equal(guestDrafts.has('g-ejected'), false)
  assert.equal(guestDrafts.has('g-stale-state'), false)
})

test('pruneNamelessGuestDrafts drops empty-name seats and mappings', () => {
  const guestDrafts = new Map([
    ['g-ok', { picks: [], ready: false, name: 'Alex', quorumRequired: true }],
    ['g-bad', { picks: [], ready: false, name: '  ', quorumRequired: true }],
  ])
  const stableIdToParticipant = new Map([
    ['S-ok', 'g-ok'],
    ['S-bad', 'g-bad'],
  ])
  pruneNamelessGuestDrafts(guestDrafts, stableIdToParticipant)
  assert.equal(guestDrafts.has('g-ok'), true)
  assert.equal(guestDrafts.has('g-bad'), false)
  assert.equal(stableIdToParticipant.has('S-ok'), true)
  assert.equal(stableIdToParticipant.has('S-bad'), false)
})

test('hostSeatMetaFromParticipants reads host name and quorum', () => {
  const meta = hostSeatMetaFromParticipants([
    { id: HOST_PARTICIPANT_ID, name: 'Dave', quorumRequired: false, ready: true, pickCount: 0 },
  ])
  assert.deepEqual(meta, { name: 'Dave', quorumRequired: false })
})
