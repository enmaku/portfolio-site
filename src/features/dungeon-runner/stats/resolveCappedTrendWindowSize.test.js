import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCappedTrendWindowSize } from './resolveCappedTrendWindowSize.js'

test('resolveCappedTrendWindowSize caps min, max, and default by length', () => {
  assert.deepEqual(resolveCappedTrendWindowSize(2, { min: 2, default: 10, maxCap: 100 }), {
    status: 'ok',
    min: 2,
    max: 2,
    default: 2,
  })
})

test('resolveCappedTrendWindowSize uses full config when length allows', () => {
  assert.deepEqual(resolveCappedTrendWindowSize(10, { min: 2, default: 10, maxCap: 100 }), {
    status: 'ok',
    min: 2,
    max: 10,
    default: 10,
  })
})

test('resolveCappedTrendWindowSize returns error for invalid length', () => {
  assert.deepEqual(resolveCappedTrendWindowSize(0, { min: 1, default: 3, maxCap: 52 }), {
    status: 'error',
  })
})
