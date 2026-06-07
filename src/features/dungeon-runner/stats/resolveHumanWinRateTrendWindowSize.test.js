import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHumanWinRateTrendWindowSize } from './resolveHumanWinRateTrendWindowSize.js'

test('resolveHumanWinRateTrendWindowSize caps default and max by series length', () => {
  assert.deepEqual(resolveHumanWinRateTrendWindowSize(2), {
    status: 'ok',
    min: 2,
    max: 2,
    default: 2,
  })
})

test('resolveHumanWinRateTrendWindowSize uses twenty-match default when series is long enough', () => {
  assert.deepEqual(resolveHumanWinRateTrendWindowSize(20), {
    status: 'ok',
    min: 2,
    max: 20,
    default: 20,
  })
})

test('resolveHumanWinRateTrendWindowSize caps default when series is shorter than twenty', () => {
  assert.deepEqual(resolveHumanWinRateTrendWindowSize(5), {
    status: 'ok',
    min: 2,
    max: 5,
    default: 5,
  })
})

test('resolveHumanWinRateTrendWindowSize returns error for empty series', () => {
  assert.deepEqual(resolveHumanWinRateTrendWindowSize(0), { status: 'error' })
})
