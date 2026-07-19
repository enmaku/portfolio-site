import assert from 'node:assert/strict'
import test from 'node:test'
import { referencePriceCp } from '../economy/commodityCatalog.js'
import { buildRealmEconomyStatus } from './buildRealmEconomyStatus.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'

test('buildRealmEconomyStatus ranks local prices and combined wealth', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'a', status: 'living', population: 10, x: 0, y: 0 },
    { id: 'b', status: 'living', population: 20, x: 1, y: 0 },
    { id: 'c', status: 'ruin', population: 0, x: 2, y: 0 },
  ]
  slice.externalTradeAccounts = { a: 50, b: 0 }
  slice.lastTradeEpochResult = {
    flows: [],
    offMapTrades: [],
    settlementCommodityRoles: {},
    localPricesBySettlementId: {
      a: { fish: 3, grain: 1 },
      b: { fish: 1.5, grain: 2 },
    },
    obligationDeltas: [],
    externalAccountDeltas: {},
    effectiveDelivered: {},
    realmBalancesCp: { a: 100, b: -20 },
    nettedObligations: [],
  }

  const status = buildRealmEconomyStatus(slice)
  const fish = status.commodities.find((row) => row.commodityId === 'fish')
  assert.ok(fish)
  assert.deepEqual(fish.highest, { settlementId: 'a', valueCp: 3 })
  assert.deepEqual(fish.lowest, { settlementId: 'b', valueCp: 1.5 })

  assert.deepEqual(status.wealthiest, { settlementId: 'a', valueCp: 150 })
  assert.deepEqual(status.poorest, { settlementId: 'b', valueCp: -20 })
})

test('buildRealmEconomyStatus falls back to reference prices and zero balances', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [{ id: 'a', status: 'living', population: 10, x: 0, y: 0 }]
  slice.lastTradeEpochResult = null

  const status = buildRealmEconomyStatus(slice)
  const grain = status.commodities.find((row) => row.commodityId === 'grain')
  assert.ok(grain)
  assert.deepEqual(grain.highest, {
    settlementId: 'a',
    valueCp: referencePriceCp('grain'),
  })
  assert.deepEqual(grain.lowest, {
    settlementId: 'a',
    valueCp: referencePriceCp('grain'),
  })
  assert.deepEqual(status.wealthiest, { settlementId: 'a', valueCp: 0 })
  assert.deepEqual(status.poorest, { settlementId: 'a', valueCp: 0 })
})
