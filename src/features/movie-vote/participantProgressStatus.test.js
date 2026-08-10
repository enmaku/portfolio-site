import assert from 'node:assert/strict'
import test from 'node:test'
import { participantProgressStatus } from './participantProgressStatus.js'

test('suggest: movie_edit grey until picks exist', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 0, ready: false, quorumRequired: true }),
    { icon: 'movie_edit', color: 'grey-5', key: 'no_picks' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 2, ready: false, quorumRequired: true }),
    { icon: 'movie_edit', color: 'positive', key: 'has_picks' },
  )
})

test('suggest: how_to_vote positive when required seat is ready', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 0, ready: true, quorumRequired: true }),
    { icon: 'how_to_vote', color: 'positive', key: 'ready' },
  )
})

test('suggest: optional seats stay on movie_edit even if ready is stale', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 1, ready: true, quorumRequired: false }),
    { icon: 'movie_edit', color: 'positive', key: 'has_picks' },
  )
})

test('voting: ballot grey/green for required voters', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: true, hasVoted: false }),
    { icon: 'ballot', color: 'grey-5', key: 'not_voted' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: true, hasVoted: true }),
    { icon: 'ballot', color: 'positive', key: 'voted' },
  )
})

test('voting: optional seats are watchers', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: false, hasVoted: false }),
    { icon: 'visibility', color: 'grey-5', key: 'watching' },
  )
})

test('results and unknown phases have no progress cue', () => {
  assert.equal(participantProgressStatus({ phase: 'results' }), null)
})
