import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMatchesPerWeekTrendWindowSize } from './resolveMatchesPerWeekTrendWindowSize.js'

test('resolveMatchesPerWeekTrendWindowSize caps default and max by week count', () => {
  assert.deepEqual(resolveMatchesPerWeekTrendWindowSize(2), {
    status: 'ok',
    min: 1,
    max: 2,
    default: 2,
  })
})

test('resolveMatchesPerWeekTrendWindowSize uses three-week default when series is long enough', () => {
  assert.deepEqual(resolveMatchesPerWeekTrendWindowSize(3), {
    status: 'ok',
    min: 1,
    max: 3,
    default: 3,
  })
})

test('resolveMatchesPerWeekTrendWindowSize returns error for empty series', () => {
  assert.deepEqual(resolveMatchesPerWeekTrendWindowSize(0), { status: 'error' })
})
