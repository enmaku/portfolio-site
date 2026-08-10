import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isParticipantNameTaken,
  normalizeParticipantName,
  participantNameKey,
} from './participantName.js'

test('normalizeParticipantName trims', () => {
  assert.equal(normalizeParticipantName('  Alex  '), 'Alex')
  assert.equal(normalizeParticipantName(''), '')
  assert.equal(normalizeParticipantName(null), '')
})

test('participant name uniqueness is case-insensitive', () => {
  const seats = [{ id: 'h', name: 'Alex' }]
  assert.equal(isParticipantNameTaken('alex', seats), true)
  assert.equal(isParticipantNameTaken('Alex', seats), true)
  assert.equal(isParticipantNameTaken('Sam', seats), false)
  assert.equal(participantNameKey('  ALEX '), 'alex')
})
