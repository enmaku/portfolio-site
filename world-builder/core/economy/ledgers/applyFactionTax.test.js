import assert from 'node:assert/strict'
import test from 'node:test'
import { applyFactionTax } from './applyFactionTax.js'
import { createEmptyTradeAccounts } from './bilateralObligations.js'

test('multi-member faction pays floor of 10% to capital', () => {
  const result = applyFactionTax({
    settlements: [
      { id: 'cap', factionId: 'f1', population: 100, status: 'living' },
      { id: 'a', factionId: 'f1', population: 50, status: 'living' },
      { id: 'b', factionId: 'f1', population: 40, status: 'living' },
    ],
    factions: [{ id: 'f1', capitalSettlementId: 'cap', status: 'active' }],
    tradeAccounts: createEmptyTradeAccounts(),
    taxAssessmentIncomeCp: { a: 1000, b: 555, cap: 9000 },
  })

  assert.equal(result.factionTaxNetCpBySettlementId.a, -100)
  assert.equal(result.factionTaxNetCpBySettlementId.b, -55)
  assert.equal(result.factionTaxNetCpBySettlementId.cap, 155)
  assert.equal(result.taxIncomeCpBySettlementId.cap, 155)
  assert.equal(result.tradeAccounts.balancesBySettlementId.cap, 155)
  assert.equal(result.tradeAccounts.balancesBySettlementId.a, -100)
  assert.equal(result.tradeAccounts.balancesBySettlementId.b, -55)
})

test('unaligned and singleton capital pay nothing', () => {
  const result = applyFactionTax({
    settlements: [
      { id: 'solo', factionId: 'f1', population: 80, status: 'living' },
      { id: 'free', factionId: null, population: 30, status: 'living' },
    ],
    factions: [{ id: 'f1', capitalSettlementId: 'solo', status: 'active' }],
    tradeAccounts: createEmptyTradeAccounts(),
    taxAssessmentIncomeCp: { solo: 5000, free: 2000 },
  })

  assert.equal(result.factionTaxNetCpBySettlementId.solo, 0)
  assert.equal(result.factionTaxNetCpBySettlementId.free, 0)
  assert.deepStrictEqual(result.taxIncomeCpBySettlementId, {})
  assert.deepStrictEqual(result.tradeAccounts.obligations, [])
})

test('full obligation books even when payer is already in debt', () => {
  const accounts = createEmptyTradeAccounts()
  accounts.obligations = [
    { creditorSettlementId: 'other', debtorSettlementId: 'a', amountCp: 500 },
  ]
  accounts.balancesBySettlementId = { other: 500, a: -500 }

  const result = applyFactionTax({
    settlements: [
      { id: 'cap', factionId: 'f1', population: 100, status: 'living' },
      { id: 'a', factionId: 'f1', population: 50, status: 'living' },
    ],
    factions: [{ id: 'f1', capitalSettlementId: 'cap', status: 'active' }],
    tradeAccounts: accounts,
    taxAssessmentIncomeCp: { a: 200 },
  })

  assert.equal(result.factionTaxNetCpBySettlementId.a, -20)
  assert.equal(result.tradeAccounts.balancesBySettlementId.a, -520)
  assert.equal(result.tradeAccounts.balancesBySettlementId.cap, 20)
})

test('zero income and fractional floor skip dust obligations', () => {
  const result = applyFactionTax({
    settlements: [
      { id: 'cap', factionId: 'f1', population: 100, status: 'living' },
      { id: 'a', factionId: 'f1', population: 50, status: 'living' },
      { id: 'b', factionId: 'f1', population: 50, status: 'living' },
    ],
    factions: [{ id: 'f1', capitalSettlementId: 'cap', status: 'active' }],
    tradeAccounts: createEmptyTradeAccounts(),
    taxAssessmentIncomeCp: { a: 0, b: 9 },
  })

  assert.equal(result.factionTaxNetCpBySettlementId.a, 0)
  assert.equal(result.factionTaxNetCpBySettlementId.b, 0)
  assert.equal(result.factionTaxNetCpBySettlementId.cap, 0)
  assert.deepStrictEqual(result.tradeAccounts.obligations, [])
})

test('ruins and extinct factions are ignored', () => {
  const result = applyFactionTax({
    settlements: [
      { id: 'cap', factionId: 'f1', population: 100, status: 'living' },
      { id: 'dead', factionId: 'f1', population: 0, status: 'ruin' },
      { id: 'ghost', factionId: 'gone', population: 40, status: 'living' },
    ],
    factions: [
      { id: 'f1', capitalSettlementId: 'cap', status: 'active' },
      { id: 'gone', capitalSettlementId: 'ghost', status: 'extinct' },
    ],
    tradeAccounts: createEmptyTradeAccounts(),
    taxAssessmentIncomeCp: { dead: 9999, ghost: 9999 },
  })

  assert.equal(result.factionTaxNetCpBySettlementId.cap, 0)
  assert.equal(result.factionTaxNetCpBySettlementId.ghost, 0)
  assert.deepStrictEqual(result.tradeAccounts.obligations, [])
})
