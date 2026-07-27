import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateTradeAwareFounding } from './evaluateTradeAwareFounding.js'

test('freshwater failure rejects regardless of surplus', () => {
  const result = evaluateTradeAwareFounding({
    production: { grain: 1_000_000, salt: 1_000_000 },
    population: 25,
    hasFreshwater: false,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: { transportCostCpPerLb: 0 },
  })
  assert.strictEqual(result.viable, false)
  assert.strictEqual(result.reason, 'freshwater')
})

test('local food and salt cover survival without any link', () => {
  const result = evaluateTradeAwareFounding({
    production: { grain: 20_000, salt: 500 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: {},
    foundingLink: null,
  })
  assert.strictEqual(result.viable, true)
  assert.strictEqual(result.reason, 'local')
})

test('salt surplus buys food shortfall over the founding link at parent prices', () => {
  const result = evaluateTradeAwareFounding({
    production: { grain: 0, fish: 0, salt: 100_000 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: { transportCostCpPerLb: 0.1, capacityLb: 1e9 },
  })
  assert.strictEqual(result.viable, true)
  assert.strictEqual(result.reason, 'import')
  assert.ok(result.foodShortfallLb > 0)
  assert.ok(result.exportableSurplusCp >= result.importCostCp)
})

test('no exportable surplus cannot fund the shortfall', () => {
  const result = evaluateTradeAwareFounding({
    production: { grain: 0, fish: 0, salt: 0 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: { transportCostCpPerLb: 0.1, capacityLb: 1e9 },
  })
  assert.strictEqual(result.viable, false)
  assert.strictEqual(result.reason, 'insufficient')
  assert.strictEqual(result.exportableSurplusCp, 0)
})

test('shortfall without any link is not viable', () => {
  const result = evaluateTradeAwareFounding({
    production: { salt: 100_000 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: null,
  })
  assert.strictEqual(result.viable, false)
  assert.strictEqual(result.reason, 'no-link')
})

test('transport exceeding goods value makes the import unprofitable', () => {
  const result = evaluateTradeAwareFounding({
    production: { salt: 100_000 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: { transportCostCpPerLb: 5, capacityLb: 1e9 },
  })
  assert.strictEqual(result.viable, false)
  assert.strictEqual(result.reason, 'unprofitable')
})

test('link capacity below the shortfall blocks founding', () => {
  const result = evaluateTradeAwareFounding({
    production: { salt: 1_000_000 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: { transportCostCpPerLb: 0.01, capacityLb: 10 },
  })
  assert.strictEqual(result.viable, false)
  assert.strictEqual(result.reason, 'insufficient')
})

test('deterministic for identical inputs', () => {
  const params = {
    production: { grain: 5_000, salt: 100_000 },
    population: 25,
    hasFreshwater: true,
    parentLocalPrices: { grain: 1, salt: 5 },
    foundingLink: { transportCostCpPerLb: 0.1, capacityLb: 1e9 },
  }
  assert.deepStrictEqual(
    evaluateTradeAwareFounding(params),
    evaluateTradeAwareFounding(params),
  )
})
