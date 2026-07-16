import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LOCAL_PRICE_MULTIPLIER_MAX,
  LOCAL_PRICE_MULTIPLIER_MIN,
  computeConnectedMarketPrices,
  localPriceMultiplier,
} from './localPrices.js'
import { referencePriceCp } from './commodityCatalog.js'

test('local price multiplier handles empty and one-sided markets', () => {
  assert.strictEqual(localPriceMultiplier(0, 0), 1)
  assert.strictEqual(localPriceMultiplier(100, 0), LOCAL_PRICE_MULTIPLIER_MIN)
  assert.strictEqual(localPriceMultiplier(0, 100), LOCAL_PRICE_MULTIPLIER_MAX)
})

test('local price multiplier clamps sqrt(demand / supply) to bounds', () => {
  assert.strictEqual(localPriceMultiplier(100, 100), 1)
  assert.strictEqual(localPriceMultiplier(1, 100), LOCAL_PRICE_MULTIPLIER_MAX)
  assert.strictEqual(localPriceMultiplier(100, 1), LOCAL_PRICE_MULTIPLIER_MIN)
  assert.ok(Math.abs(localPriceMultiplier(100, 400) - 2) < 1e-9)
})

test('connected market aggregates supply and demand across candidate edges', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const production = {
    a: { grain: 200000, fish: 0, salt: 0, timber: 0, baseMetals: 0, copper: 0, silver: 0, gold: 0, diamonds: 0 },
    b: { grain: 0, fish: 0, salt: 0, timber: 0, baseMetals: 0, copper: 0, silver: 0, gold: 0, diamonds: 0 },
  }
  const edges = [{ fromSettlementId: 'a', toSettlementId: 'b' }]

  const prices = computeConnectedMarketPrices({ settlements, edges, production })

  // Both settlements share the same market, so identical prices.
  assert.deepStrictEqual(prices.a, prices.b)
  // Salt has demand but zero supply market-wide → upper clamp.
  assert.strictEqual(prices.a.salt, referencePriceCp('salt') * LOCAL_PRICE_MULTIPLIER_MAX)
})

test('disconnected settlements price their own markets independently', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const production = {
    a: { grain: 999999999, fish: 0, salt: 0, timber: 0, baseMetals: 0, copper: 0, silver: 0, gold: 0, diamonds: 0 },
    b: { grain: 0, fish: 0, salt: 0, timber: 0, baseMetals: 0, copper: 0, silver: 0, gold: 0, diamonds: 0 },
  }

  const prices = computeConnectedMarketPrices({ settlements, edges: [], production })

  // a is flooded with grain → lower clamp; b has demand but no supply → upper clamp.
  assert.strictEqual(prices.a.grain, referencePriceCp('grain') * LOCAL_PRICE_MULTIPLIER_MIN)
  assert.strictEqual(prices.b.grain, referencePriceCp('grain') * LOCAL_PRICE_MULTIPLIER_MAX)
})
