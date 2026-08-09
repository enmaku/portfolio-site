import assert from 'node:assert/strict'
import test from 'node:test'
import { onMapGoodsBilateralCpByPair } from './onMapGoodsBilateralCpByPair.js'

test('sums absolute on-map goods cp both ways under sorted pair key', () => {
  const byPair = onMapGoodsBilateralCpByPair([
    { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 40, kind: 'goods' },
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: 60, kind: 'goods' },
  ])
  assert.deepStrictEqual(byPair, { 'a|b': 100 })
})

test('excludes tolls, tax, and non-positive amounts', () => {
  const byPair = onMapGoodsBilateralCpByPair([
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: 50, kind: 'goods' },
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: 12, kind: 'toll' },
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: 8, kind: 'tax' },
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: 0, kind: 'goods' },
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: -5, kind: 'goods' },
  ])
  assert.deepStrictEqual(byPair, { 'a|b': 50 })
})

test('ignores self pairs and incomplete rows', () => {
  const byPair = onMapGoodsBilateralCpByPair([
    { fromSettlementId: 'a', toSettlementId: 'a', amountCp: 99, kind: 'goods' },
    { fromSettlementId: 'a', amountCp: 10, kind: 'goods' },
    { toSettlementId: 'b', amountCp: 10, kind: 'goods' },
    null,
  ])
  assert.deepStrictEqual(byPair, {})
})

test('returns empty for missing deltas', () => {
  assert.deepStrictEqual(onMapGoodsBilateralCpByPair(null), {})
  assert.deepStrictEqual(onMapGoodsBilateralCpByPair(undefined), {})
  assert.deepStrictEqual(onMapGoodsBilateralCpByPair([]), {})
})
