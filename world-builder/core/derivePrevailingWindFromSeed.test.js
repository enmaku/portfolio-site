import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePrevailingWindFromSeed } from './derivePrevailingWindFromSeed.js'

test('derivePrevailingWindFromSeed returns 0-359 and is deterministic', () => {
  const first = derivePrevailingWindFromSeed(42)
  const second = derivePrevailingWindFromSeed(42)
  const other = derivePrevailingWindFromSeed(43)

  assert.ok(first >= 0 && first <= 359)
  assert.ok(second >= 0 && second <= 359)
  assert.strictEqual(first, second)
  assert.notStrictEqual(first, other)
})
