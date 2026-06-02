import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRollingWindowSize } from './resolveRollingWindowSize.js'

test('resolveRollingWindowSize returns configured bounds for long series', () => {
  assert.deepEqual(resolveRollingWindowSize(50), {
    status: 'ok',
    min: 5,
    max: 50,
    default: 10,
  })
})

test('resolveRollingWindowSize clamps default and max for short archives', () => {
  assert.deepEqual(resolveRollingWindowSize(7), {
    status: 'ok',
    min: 5,
    max: 7,
    default: 7,
  })
})

test('resolveRollingWindowSize errors when fewer than five matches', () => {
  assert.deepEqual(resolveRollingWindowSize(4), { status: 'error' })
  assert.deepEqual(resolveRollingWindowSize(0), { status: 'error' })
})
