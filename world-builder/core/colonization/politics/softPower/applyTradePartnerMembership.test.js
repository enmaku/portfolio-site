import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPeacefulTradePartnerJoins,
  applyTradePartnerPeels,
} from './applyTradePartnerMembership.js'
import {
  HISTORY_KIND_FACTION_EXTINCT,
  HISTORY_KIND_TRADE_PARTNER_JOIN,
  HISTORY_KIND_TRADE_PARTNER_PEEL,
} from '../historyKinds.js'
import { createDefaultColonizationSlice } from '../../createDefaultColonizationSlice.js'

test('peaceful join converts map-gray pin to trade partner with history', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 10
  slice.settlements = [
    { id: 'cap', factionId: 'fa', status: 'living', population: 100 },
    { id: 'm', factionId: 'fa', status: 'living', population: 80 },
    { id: 'free', factionId: null, status: 'living', population: 50 },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'm'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.softPowerJoinEligibleBySettlementId = { free: 'fa' }

  const result = applyPeacefulTradePartnerJoins({ slice })
  const free = result.slice.settlements.find((s) => s.id === 'free')
  assert.equal(free.factionId, 'fa')
  assert.equal(free.isTradePartner, true)
  assert.equal(free.vassalLiegeSettlementId, null)
  assert.ok(result.slice.factions[0].settlementIds.includes('free'))
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_TRADE_PARTNER_JOIN))
  assert.equal(result.slice.recentTradePartnerJoinBySettlementId.free.joinedEpoch, 10)
  assert.equal(result.slice.softPowerJoinEligibleBySettlementId.free, undefined)
})

test('peaceful join extinguishes singleton faction of joining capital', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 8
  slice.settlements = [
    { id: 'cap', factionId: 'fa', status: 'living', population: 100 },
    { id: 'm', factionId: 'fa', status: 'living', population: 80 },
    { id: 'solo', factionId: 'solo-f', status: 'living', population: 40 },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'm'],
      status: 'active',
      emergedEpoch: 0,
    },
    {
      id: 'solo-f',
      capitalSettlementId: 'solo',
      settlementIds: ['solo'],
      status: 'active',
      emergedEpoch: 1,
    },
  ]
  slice.softPowerJoinEligibleBySettlementId = { solo: 'fa' }

  const result = applyPeacefulTradePartnerJoins({ slice })
  const solo = result.slice.settlements.find((s) => s.id === 'solo')
  assert.equal(solo.factionId, 'fa')
  assert.equal(solo.isTradePartner, true)
  const extinct = result.slice.factions.find((f) => f.id === 'solo-f')
  assert.equal(extinct.status, 'extinct')
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_FACTION_EXTINCT))
})

test('trade partner peels when host dominance clears and re-arms', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 12
  slice.settlements = [
    { id: 'cap', factionId: 'fa', status: 'living', population: 100 },
    { id: 'm', factionId: 'fa', status: 'living', population: 80 },
    {
      id: 'tp',
      factionId: 'fa',
      isTradePartner: true,
      status: 'living',
      population: 50,
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'm', 'tp'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.softPowerPaintBySettlementId = {}
  slice.tradePartnerPeelClearStreak = { tp: 1 }

  const result = applyTradePartnerPeels({
    slice,
    scores: { tp: { dominantFactionId: null } },
  })
  const tp = result.slice.settlements.find((s) => s.id === 'tp')
  assert.equal(tp.factionId, null)
  assert.equal(tp.isTradePartner, false)
  assert.ok(!result.slice.factions[0].settlementIds.includes('tp'))
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_TRADE_PARTNER_PEEL))
  assert.ok(
    result.slice.membershipCooldown.some(
      (c) => c.subjectId === 'tp' && c.kind === 'trade_partner_peel',
    ),
  )
})

test('trade partner does not hop to rival banner in one step', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 12
  slice.settlements = [
    { id: 'cap', factionId: 'fa', status: 'living', population: 100 },
    { id: 'm', factionId: 'fa', status: 'living', population: 80 },
    {
      id: 'tp',
      factionId: 'fa',
      isTradePartner: true,
      status: 'living',
      population: 50,
    },
    { id: 'rb', factionId: 'fb', status: 'living', population: 100 },
    { id: 'rb2', factionId: 'fb', status: 'living', population: 80 },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'm', 'tp'],
      status: 'active',
      emergedEpoch: 0,
    },
    {
      id: 'fb',
      capitalSettlementId: 'rb',
      settlementIds: ['rb', 'rb2'],
      status: 'active',
      emergedEpoch: 1,
    },
  ]

  const result = applyTradePartnerPeels({
    slice,
    scores: { tp: { dominantFactionId: 'fb' } },
  })
  const tp = result.slice.settlements.find((s) => s.id === 'tp')
  // Still host or peeled — never directly fb trade partner.
  assert.notEqual(tp.factionId === 'fb' && tp.isTradePartner === true, true)
})
