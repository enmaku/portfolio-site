import assert from 'node:assert/strict'
import test from 'node:test'
import { assertKnownParams } from './assertKnownParams.js'

test('assertKnownParams accepts only declared keys', () => {
  assert.doesNotThrow(() =>
    assertKnownParams('exampleFn', { a: 1, b: 2 }, ['a', 'b']),
  )
})

test('assertKnownParams rejects unknown keys with a labeled error', () => {
  assert.throws(
    () => assertKnownParams('exampleFn', { a: 1, extra: true }, ['a']),
    /exampleFn received unknown parameter: extra/,
  )
})
