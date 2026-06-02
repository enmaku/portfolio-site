import assert from 'node:assert/strict'
import test from 'node:test'
import { computeRollingWeekAverage } from './computeRollingWeekAverage.js'

test('computeRollingWeekAverage uses expanding window at series start', () => {
  const result = computeRollingWeekAverage([2, 4, 6])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.values, [2, (2 + 4) / 2, (2 + 4 + 6) / 3])
})

test('computeRollingWeekAverage caps lookback at three weeks', () => {
  const result = computeRollingWeekAverage([1, 2, 3, 4, 5])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.values, [
    1,
    (1 + 2) / 2,
    (1 + 2 + 3) / 3,
    (2 + 3 + 4) / 3,
    (3 + 4 + 5) / 3,
  ])
})

test('computeRollingWeekAverage returns null for weeks with no matches', () => {
  const result = computeRollingWeekAverage([2, 0, 6, 3])
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.values, [2, null, (2 + 0 + 6) / 3, (0 + 6 + 3) / 3])
})

test('computeRollingWeekAverage returns error for empty or invalid series', () => {
  assert.deepEqual(computeRollingWeekAverage([]), { status: 'error' })
  assert.deepEqual(computeRollingWeekAverage([1, -1]), { status: 'error' })
})
