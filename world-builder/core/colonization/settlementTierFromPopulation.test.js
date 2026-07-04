import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SETTLEMENT_TIER_THRESHOLDS,
  settlementTierFromPopulation,
} from './settlementTierFromPopulation.js'

test('settlementTierFromPopulation returns null below living headcount', () => {
  assert.strictEqual(settlementTierFromPopulation(0), null)
  assert.strictEqual(settlementTierFromPopulation(-1), null)
})

test('settlementTierFromPopulation maps absolute headcount bands', () => {
  for (let i = 0; i < SETTLEMENT_TIER_THRESHOLDS.length; i += 1) {
    const band = SETTLEMENT_TIER_THRESHOLDS[i]
    const nextMin = SETTLEMENT_TIER_THRESHOLDS[i + 1]?.min
    assert.strictEqual(settlementTierFromPopulation(band.min), band.tier)
    if (nextMin != null) {
      assert.strictEqual(settlementTierFromPopulation(nextMin - 1), band.tier)
    }
  }
})
