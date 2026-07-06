import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'
import { SAIL_EXPEDITION_DISPATCH_PROBABILITY } from './selectSailExpeditionStep.js'

test('coastal dispatch uses ~60% sail split over seeded rolls', () => {
  let sailCount = 0
  const rolls = 200
  for (let i = 0; i < rolls; i += 1) {
    const random = createSeededRandom(deriveFieldSeed(4242, `dispatch-mode-${i}`))
    if (random() < SAIL_EXPEDITION_DISPATCH_PROBABILITY) {
      sailCount += 1
    }
  }
  const ratio = sailCount / rolls
  assert.ok(ratio > 0.5 && ratio < 0.7, `expected ~60% sail, got ${ratio}`)
})
