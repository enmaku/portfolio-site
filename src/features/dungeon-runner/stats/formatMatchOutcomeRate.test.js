import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatMatchOutcomeRate,
  MATCH_OUTCOME_RATE_UNAVAILABLE,
} from './formatMatchOutcomeRate.js'

test('formatMatchOutcomeRate returns rounded whole percent', () => {
  assert.equal(formatMatchOutcomeRate(2, 3), '67%')
  assert.equal(formatMatchOutcomeRate(1, 3), '33%')
  assert.equal(formatMatchOutcomeRate(1, 2), '50%')
  assert.equal(formatMatchOutcomeRate(12, 12), '100%')
  assert.equal(formatMatchOutcomeRate(0, 10), '0%')
})

test('formatMatchOutcomeRate rounds halves away from zero at boundaries', () => {
  assert.equal(formatMatchOutcomeRate(1, 6), '17%')
  assert.equal(formatMatchOutcomeRate(5, 6), '83%')
  assert.equal(formatMatchOutcomeRate(49, 100), '49%')
  assert.equal(formatMatchOutcomeRate(50, 100), '50%')
  assert.equal(formatMatchOutcomeRate(51, 100), '51%')
})

test('formatMatchOutcomeRate returns unavailable sentinel when denominator is zero', () => {
  assert.equal(formatMatchOutcomeRate(0, 0), MATCH_OUTCOME_RATE_UNAVAILABLE)
  assert.equal(formatMatchOutcomeRate(5, 0), MATCH_OUTCOME_RATE_UNAVAILABLE)
})

test('formatMatchOutcomeRate returns unavailable sentinel for invalid denominator', () => {
  for (const denominator of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatMatchOutcomeRate(1, denominator), MATCH_OUTCOME_RATE_UNAVAILABLE)
  }
})
