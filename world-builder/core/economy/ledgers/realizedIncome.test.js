import assert from 'node:assert/strict'
import test from 'node:test'
import {
  realizedOnMapIncomeCpBySettlementId,
  realizedPortTollIncomeCpBySettlementId,
} from './realizedIncome.js'

test('sums creditor goods and toll amounts per settlement', () => {
  const income = realizedOnMapIncomeCpBySettlementId([
    { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 100, kind: 'goods' },
    { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 5, kind: 'toll' },
    { fromSettlementId: 'a', toSettlementId: 'c', amountCp: 40, kind: 'goods' },
  ])
  assert.deepStrictEqual(income, { a: 105, c: 40 })
})

test('ignores import spends and non positive amounts', () => {
  const income = realizedOnMapIncomeCpBySettlementId([
    { fromSettlementId: 'a', toSettlementId: 'b', amountCp: 50, kind: 'goods' },
    { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 0, kind: 'goods' },
    { fromSettlementId: 'b', toSettlementId: 'a', amountCp: -10, kind: 'goods' },
    { fromSettlementId: 'x', toSettlementId: 'y', amountCp: 9, kind: 'other' },
  ])
  assert.deepStrictEqual(income, { b: 50 })
})

test('returns empty object for missing or empty deltas', () => {
  assert.deepStrictEqual(realizedOnMapIncomeCpBySettlementId(null), {})
  assert.deepStrictEqual(realizedOnMapIncomeCpBySettlementId(undefined), {})
  assert.deepStrictEqual(realizedOnMapIncomeCpBySettlementId([]), {})
})

test('sums on-map toll obligations and off-map toll credits', () => {
  const income = realizedPortTollIncomeCpBySettlementId(
    [
      { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 12, kind: 'toll' },
      { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 100, kind: 'goods' },
      { fromSettlementId: 'c', toSettlementId: 'a', amountCp: 3, kind: 'toll' },
    ],
    { a: 7, d: 20 },
  )
  assert.deepStrictEqual(income, { a: 22, d: 20 })
})

test('port toll helper ignores non-positive and empty inputs', () => {
  assert.deepStrictEqual(realizedPortTollIncomeCpBySettlementId(null, null), {})
  assert.deepStrictEqual(
    realizedPortTollIncomeCpBySettlementId(
      [{ toSettlementId: 'a', amountCp: 0, kind: 'toll' }],
      { a: -1, b: 0 },
    ),
    {},
  )
})
