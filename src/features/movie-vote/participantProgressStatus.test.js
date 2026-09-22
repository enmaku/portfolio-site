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

test('suggest: ready when seat is ready, regardless of quorumRequired', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 0, ready: true, quorumRequired: true }),
    { key: 'ready' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'suggest', pickCount: 1, ready: true, quorumRequired: false }),
    { key: 'ready' },
  )
})

test('voting: always voted / not_voted based on hasVoted', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: true, hasVoted: false }),
    { key: 'not_voted' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: true, hasVoted: true }),
    { key: 'voted' },
  )
})

test('voting: optional seats use not_voted / voted, no watching', () => {
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: false, hasVoted: false }),
    { key: 'not_voted' },
  )
  assert.deepEqual(
    participantProgressStatus({ phase: 'voting', quorumRequired: false, hasVoted: true }),
    { key: 'voted' },
  )
})

test('results and unknown phases have no progress cue', () => {
  assert.equal(participantProgressStatus({ phase: 'results' }), null)
})
