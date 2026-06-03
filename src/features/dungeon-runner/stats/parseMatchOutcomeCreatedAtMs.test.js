import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMatchOutcomeCreatedAtMs } from './parseMatchOutcomeCreatedAtMs.js'

test('parseMatchOutcomeCreatedAtMs parses ISO strings', () => {
  const ms = parseMatchOutcomeCreatedAtMs('2026-05-21T12:00:00.000Z')
  assert.equal(ms, Date.parse('2026-05-21T12:00:00.000Z'))
})

test('parseMatchOutcomeCreatedAtMs parses firestore-like seconds', () => {
  assert.equal(parseMatchOutcomeCreatedAtMs({ seconds: 1000, nanoseconds: 500000000 }), 1000500)
})
