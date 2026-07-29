import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createColonizationEpochContext,
  runColonizationEpochTaxPhase,
} from './applyColonizationEpoch.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'
import { createEmptyTradeAccounts } from '../economy/ledgers/bilateralObligations.js'

test('tax phase books obligations and merges tax into prior realized income', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'cap', status: 'living', population: 100, factionId: 'f1' },
    { id: 'a', status: 'living', population: 50, factionId: 'f1' },
  ]
  slice.factions = [
    {
      id: 'f1',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'a'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.tradeAccounts = createEmptyTradeAccounts()
  slice.priorRealizedIncomeCp = { cap: 200, a: 1000 }
  slice.lastTradeEpochResult = {
    settlementCommodityRoles: {},
    localPricesBySettlementId: {},
    effectiveDelivered: {},
    realmBalancesCp: { cap: 0, a: 0 },
    offMapTrades: [],
    portTollIncomeCpBySettlementId: {},
    factionTaxNetCpBySettlementId: {},
  }

  const ctx = createColonizationEpochContext(slice, {
    gridWidth: 4,
    gridHeight: 4,
  })
  ctx.tradeClearingActive = true
  ctx.taxAssessmentIncomeCp = { cap: 50, a: 1000 }
  ctx.slice.priorRealizedIncomeCp = { cap: 200, a: 800 }

  runColonizationEpochTaxPhase(ctx)

  assert.equal(ctx.slice.tradeAccounts.balancesBySettlementId.cap, 100)
  assert.equal(ctx.slice.tradeAccounts.balancesBySettlementId.a, -100)
  assert.equal(ctx.slice.lastTradeEpochResult.factionTaxNetCpBySettlementId.cap, 100)
  assert.equal(ctx.slice.lastTradeEpochResult.factionTaxNetCpBySettlementId.a, -100)
  assert.equal(ctx.slice.priorRealizedIncomeCp.cap, 300)
  assert.equal(ctx.slice.priorRealizedIncomeCp.a, 800)
})

test('tax phase skips booking when trade clearing was inactive', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'cap', status: 'living', population: 100, factionId: 'f1' },
    { id: 'a', status: 'living', population: 50, factionId: 'f1' },
  ]
  slice.factions = [
    {
      id: 'f1',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'a'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.tradeAccounts = createEmptyTradeAccounts()
  slice.priorRealizedIncomeCp = { a: 1000 }
  slice.lastTradeEpochResult = {
    settlementCommodityRoles: {},
    localPricesBySettlementId: {},
    effectiveDelivered: {},
    realmBalancesCp: {},
    offMapTrades: [],
    portTollIncomeCpBySettlementId: {},
    factionTaxNetCpBySettlementId: { cap: 7, a: -7 },
  }

  const ctx = createColonizationEpochContext(slice, {
    gridWidth: 4,
    gridHeight: 4,
  })
  ctx.tradeClearingActive = false
  ctx.taxAssessmentIncomeCp = { a: 1000 }

  runColonizationEpochTaxPhase(ctx)

  assert.deepStrictEqual(ctx.slice.tradeAccounts.obligations, [])
  assert.equal(ctx.slice.lastTradeEpochResult.factionTaxNetCpBySettlementId.cap, 7)
  assert.equal(ctx.slice.priorRealizedIncomeCp.a, 1000)
})

test('tax phase skips trade partners', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'cap', status: 'living', population: 100, factionId: 'f1' },
    { id: 'a', status: 'living', population: 50, factionId: 'f1' },
    {
      id: 'tp',
      status: 'living',
      population: 50,
      factionId: 'f1',
      isTradePartner: true,
    },
  ]
  slice.factions = [
    {
      id: 'f1',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'a', 'tp'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.tradeAccounts = createEmptyTradeAccounts()
  slice.priorRealizedIncomeCp = { cap: 0, a: 1000, tp: 1000 }
  slice.lastTradeEpochResult = {
    settlementCommodityRoles: {},
    localPricesBySettlementId: {},
    effectiveDelivered: {},
    realmBalancesCp: {},
    offMapTrades: [],
    portTollIncomeCpBySettlementId: {},
    factionTaxNetCpBySettlementId: {},
  }

  const ctx = createColonizationEpochContext(slice, { gridWidth: 4, gridHeight: 4 })
  ctx.tradeClearingActive = true
  ctx.taxAssessmentIncomeCp = { a: 1000, tp: 1000 }

  runColonizationEpochTaxPhase(ctx)

  assert.equal(ctx.slice.lastTradeEpochResult.factionTaxNetCpBySettlementId.a, -100)
  assert.equal(ctx.slice.lastTradeEpochResult.factionTaxNetCpBySettlementId.tp ?? 0, 0)
  assert.equal(ctx.slice.tradeAccounts.balancesBySettlementId.tp ?? 0, 0)
})
