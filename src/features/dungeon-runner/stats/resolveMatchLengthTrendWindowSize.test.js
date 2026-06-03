import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMatchLengthTrendWindowSize } from './resolveMatchLengthTrendWindowSize.js'

test('resolveMatchLengthTrendWindowSize caps default and max by series length', () => {
  assert.deepEqual(resolveMatchLengthTrendWindowSize(2), {
    status: 'ok',
    min: 2,
    max: 2,
    default: 2,
  })
})

test('resolveMatchLengthTrendWindowSize uses ten-match default when series is long enough', () => {
  assert.deepEqual(resolveMatchLengthTrendWindowSize(10), {
    status: 'ok',
    min: 2,
    max: 10,
    default: 10,
  })
})

test('resolveMatchLengthTrendWindowSize caps default when series is shorter than ten', () => {
  assert.deepEqual(resolveMatchLengthTrendWindowSize(5), {
    status: 'ok',
    min: 2,
    max: 5,
    default: 5,
  })
})

test('resolveMatchLengthTrendWindowSize returns error for empty series', () => {
  assert.deepEqual(resolveMatchLengthTrendWindowSize(0), { status: 'error' })
})
