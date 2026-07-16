import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COMMODITIES,
  COMMODITY_IDS,
  CP_PER_GP,
  CP_PER_SP,
  cargoLbPerUnit,
  commodityUnit,
  referencePriceCp,
} from './commodityCatalog.js'

test('catalog exposes every baseline commodity id', () => {
  assert.deepStrictEqual(
    [...COMMODITY_IDS],
    ['grain', 'fish', 'salt', 'timber', 'baseMetals', 'copper', 'silver', 'gold', 'diamonds'],
  )
})

test('reference prices match locked CONTEXT catalog (cp per catalog unit)', () => {
  assert.strictEqual(referencePriceCp('grain'), 1)
  assert.strictEqual(referencePriceCp('fish'), 2)
  assert.strictEqual(referencePriceCp('salt'), 5)
  assert.strictEqual(referencePriceCp('timber'), 0.5)
  assert.strictEqual(referencePriceCp('baseMetals'), 1 * CP_PER_SP)
  assert.strictEqual(referencePriceCp('copper'), 5 * CP_PER_SP)
  assert.strictEqual(referencePriceCp('silver'), 5 * CP_PER_GP)
  assert.strictEqual(referencePriceCp('gold'), 50 * CP_PER_GP)
  assert.strictEqual(referencePriceCp('diamonds'), 5000 * CP_PER_GP)
})

test('typed deposit extraction units carry Fifth Edition gp values', () => {
  assert.strictEqual(referencePriceCp('copper') / CP_PER_GP, 0.5)
  assert.strictEqual(referencePriceCp('silver') / CP_PER_GP, 5)
  assert.strictEqual(referencePriceCp('gold') / CP_PER_GP, 50)
  assert.strictEqual(referencePriceCp('diamonds') / CP_PER_GP, 5000)
})

test('metals are weighed by the pound; diamonds are whole gems at 0.1 lb cargo', () => {
  for (const id of ['grain', 'fish', 'salt', 'timber', 'baseMetals', 'copper', 'silver', 'gold']) {
    assert.strictEqual(commodityUnit(id), 'lb')
    assert.strictEqual(cargoLbPerUnit(id), 1)
  }
  assert.strictEqual(commodityUnit('diamonds'), 'gem')
  assert.strictEqual(cargoLbPerUnit('diamonds'), 0.1)
})

test('catalog definitions are frozen against mutation', () => {
  assert.ok(Object.isFrozen(COMMODITIES))
  assert.ok(Object.isFrozen(COMMODITIES.grain))
})
