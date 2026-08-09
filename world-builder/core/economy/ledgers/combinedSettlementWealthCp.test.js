import assert from 'node:assert/strict'
import { test } from 'node:test'
import { combinedSettlementWealthCp } from './combinedSettlementWealthCp.js'

test('sums realm balance and nonnegative external claim', () => {
  assert.equal(
    combinedSettlementWealthCp({
      settlementId: 'a',
      balancesBySettlementId: { a: -100 },
      externalTradeAccounts: { a: 400 },
    }),
    300,
  )
})

test('floors negative external to zero', () => {
  assert.equal(
    combinedSettlementWealthCp({
      settlementId: 'a',
      balancesBySettlementId: { a: 50 },
      externalTradeAccounts: { a: -20 },
    }),
    50,
  )
})

test('uses live trade-account balances only', () => {
  assert.equal(
    combinedSettlementWealthCp({
      settlementId: 'a',
      balancesBySettlementId: { a: 12 },
      externalTradeAccounts: { a: 3 },
    }),
    15,
  )
})

test('missing accounts treat as zero', () => {
  assert.equal(combinedSettlementWealthCp({ settlementId: 'missing' }), 0)
})
