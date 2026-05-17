import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_VOTING_METHOD,
  VOTING_METHOD_OPTIONS,
  normalizeVotingMethod,
} from './votingMethod.js'

test('default voting method is instant-runoff voting', () => {
  assert.equal(DEFAULT_VOTING_METHOD, 'irv')
})

test('normalizeVotingMethod accepts standard ids', () => {
  assert.equal(normalizeVotingMethod('irv'), 'irv')
  assert.equal(normalizeVotingMethod('borda'), 'borda')
  assert.equal(normalizeVotingMethod('condorcet'), 'condorcet')
})

test('normalizeVotingMethod falls back to default for unknown values', () => {
  assert.equal(normalizeVotingMethod('ranked-points'), 'irv')
  assert.equal(normalizeVotingMethod(null), 'irv')
  assert.equal(normalizeVotingMethod(undefined), 'irv')
})

test('voting method option labels match glossary terms', () => {
  const labels = VOTING_METHOD_OPTIONS.map((o) => o.label)
  assert.deepEqual(labels, ['Instant-runoff voting', 'Borda count', 'Condorcet method'])
})
