import assert from 'node:assert/strict'
import test from 'node:test'
import {
  projectEconomyEpochSnapshot,
  resolveEconomyEpochSnapshot,
} from './economyEpochSnapshot.js'

test('projectEconomyEpochSnapshot keeps inspect fields only', () => {
  const snapshot = projectEconomyEpochSnapshot({
    flows: [{ id: 'flow' }],
    settlementCommodityRoles: { a: { grain: 'export' } },
    localPricesBySettlementId: { a: { grain: 1 } },
    obligationDeltas: [{ kind: 'goods' }],
    externalAccountDeltas: { a: 1 },
    effectiveDelivered: { a: { foodLb: 10, saltLb: 1 } },
    realmBalancesCp: { a: 5 },
    offMapTrades: [{ commodityId: 'timber', direction: 'export' }],
    portTollIncomeCpBySettlementId: { a: 2 },
    nettedObligations: [{ fromSettlementId: 'a', toSettlementId: 'b' }],
  })
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'effectiveDelivered',
    'factionTaxNetCpBySettlementId',
    'localPricesBySettlementId',
    'offMapTrades',
    'portTollIncomeCpBySettlementId',
    'realmBalancesCp',
    'settlementCommodityRoles',
  ].sort())
  assert.equal(snapshot.realmBalancesCp.a, 5)
  assert.equal(snapshot.offMapTrades.length, 1)
  assert.deepEqual(snapshot.factionTaxNetCpBySettlementId, {})
})

test('resolveEconomyEpochSnapshot rejects non-objects and fills defaults', () => {
  assert.equal(resolveEconomyEpochSnapshot(null), null)
  assert.equal(resolveEconomyEpochSnapshot(12), null)
  const snapshot = resolveEconomyEpochSnapshot({ realmBalancesCp: { a: 3 } })
  assert.equal(snapshot?.realmBalancesCp.a, 3)
  assert.deepEqual(snapshot?.offMapTrades, [])
  assert.deepEqual(snapshot?.settlementCommodityRoles, {})
})
