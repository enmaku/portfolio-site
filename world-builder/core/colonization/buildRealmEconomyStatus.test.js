import assert from 'node:assert/strict'
import test from 'node:test'
import { referencePriceCp } from '../economy/commodityCatalog.js'
import { buildRealmEconomyStatus } from './buildRealmEconomyStatus.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'

test('buildRealmEconomyStatus ranks local prices and combined wealth', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'a', status: 'living', population: 10, x: 0, y: 0, maritimeRole: 'port' },
    { id: 'b', status: 'living', population: 20, x: 1, y: 0, maritimeRole: 'none' },
    { id: 'c', status: 'ruin', population: 0, x: 2, y: 0, maritimeRole: 'port' },
  ]
  slice.externalTradeAccounts = { a: 50, b: 0 }
  slice.tradeAccounts = {
    obligations: [],
    balancesBySettlementId: { a: 100, b: -20 },
  }
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
    realmBalancesCp: {},
    nettedObligations: [],
    portTollIncomeCpBySettlementId: { a: 40, b: 99 },
  }

  const status = buildRealmEconomyStatus(slice)
  const fish = status.commodities.find((row) => row.commodityId === 'fish')
  assert.ok(fish)
  assert.deepEqual(fish.highest, { settlementId: 'a', valueCp: 3 })
  assert.deepEqual(fish.lowest, { settlementId: 'b', valueCp: 1.5 })
  assert.ok(!status.commodities.some((row) => row.commodityId === 'gold'))

  assert.deepEqual(status.wealthiest, { settlementId: 'a', valueCp: 150 })
  assert.deepEqual(status.poorest, { settlementId: 'b', valueCp: -20 })
  assert.deepEqual(status.highestTolls, { settlementId: 'a', valueCp: 40 })
  assert.deepEqual(status.lowestTolls, { settlementId: 'a', valueCp: 40 })
})

test('buildRealmEconomyStatus ranks living port toll income and ignores inland', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'a', status: 'living', population: 10, x: 0, y: 0, maritimeRole: 'port' },
    { id: 'b', status: 'living', population: 20, x: 1, y: 0, maritimeRole: 'port' },
    { id: 'c', status: 'living', population: 15, x: 2, y: 0, maritimeRole: 'none' },
  ]
  slice.lastTradeEpochResult = {
    flows: [],
    offMapTrades: [],
    settlementCommodityRoles: {},
    localPricesBySettlementId: {},
    obligationDeltas: [],
    externalAccountDeltas: {},
    effectiveDelivered: {},
    tradeAccounts: { balancesBySettlementId: {} },
    nettedObligations: [],
    portTollIncomeCpBySettlementId: { a: 10, b: 80, c: 999 },
  }

  const status = buildRealmEconomyStatus(slice)
  assert.deepEqual(status.highestTolls, { settlementId: 'b', valueCp: 80 })
  assert.deepEqual(status.lowestTolls, { settlementId: 'a', valueCp: 10 })
})

test('buildRealmEconomyStatus omits toll extremes when no living ports', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [{ id: 'a', status: 'living', population: 10, x: 0, y: 0, maritimeRole: 'none' }]
  slice.lastTradeEpochResult = {
    flows: [],
    offMapTrades: [],
    settlementCommodityRoles: {},
    localPricesBySettlementId: {},
    obligationDeltas: [],
    externalAccountDeltas: {},
    effectiveDelivered: {},
    tradeAccounts: { balancesBySettlementId: {} },
    nettedObligations: [],
    portTollIncomeCpBySettlementId: { a: 50 },
  }

  const status = buildRealmEconomyStatus(slice)
  assert.equal(status.highestTolls, null)
  assert.equal(status.lowestTolls, null)
})

test('buildRealmEconomyStatus includes pin commodities when world has pins', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [{ id: 'a', status: 'living', population: 10, x: 0, y: 0 }]
  const status = buildRealmEconomyStatus(slice, {
    metalNodes: [{ id: 'g1', x: 0, y: 0, score: 1, kind: 'gold' }],
  })
  assert.ok(status.commodities.some((row) => row.commodityId === 'gold'))
  assert.ok(!status.commodities.some((row) => row.commodityId === 'diamonds'))
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
  assert.equal(status.highestTolls, null)
  assert.equal(status.lowestTolls, null)
})
