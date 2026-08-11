import assert from 'node:assert/strict'
import test from 'node:test'
import { participantProgressStatus } from './participantProgressStatus.js'

test('suggest: no_picks until picks exist', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 0, ready: false, quorumRequired: true }),
    { key: 'no_picks' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 2, ready: false, quorumRequired: true }),
    { key: 'has_picks' },
  )
})

test('suggest: ready when required seat is ready', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 0, ready: true, quorumRequired: true }),
    { key: 'ready' },
  )
})

test('suggest: optional seats stay on has_picks even if ready is stale', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 1, ready: true, quorumRequired: false }),
    { key: 'has_picks' },
  )
})

test('voting: not_voted / voted for required voters', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: true, hasVoted: false }),
    { key: 'not_voted' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: true, hasVoted: true }),
    { key: 'voted' },
  )
})

test('voting: optional seats are watchers', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: false, hasVoted: false }),
    { key: 'watching' },
  )
})

test('results and unknown phases have no progress cue', () => {
  assert.equal(participantProgressStatus({ phase: 'results' }), null)
})
