import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom, deriveFieldSeed } from './seededRandom.js'

test('createSeededRandom reaches the upper half of [0, 1)', () => {
  const random = createSeededRandom(deriveFieldSeed(1, 'population-collapse:0:s1'))
  let max = 0
  let aboveHalf = 0
  for (let i = 0; i < 10_000; i += 1) {
    const value = random()
    if (value > max) {
      max = value
    }
    if (value >= 0.5) {
      aboveHalf += 1
    }
  }
  assert.ok(max > 0.5)
  assert.ok(aboveHalf > 0)
})
