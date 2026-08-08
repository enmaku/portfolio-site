import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONQUEST_CAUSE_CONQUEST,
  CONQUEST_CAUSE_QUASHED_REBELLION,
  resolveConquestCause,
} from './conquestCause.js'
import { transferSettlementAsVassal } from './transferSettlementAsVassal.js'

test('resolveConquestCause is ordinary conquest when epoch-start banner differs', () => {
  assert.equal(
    resolveConquestCause(
      { bannerMembershipHistoryBySettlementId: { border: ['fb', 'fb'] } },
      'border',
      'fa',
    ),
    CONQUEST_CAUSE_CONQUEST,
  )
})

test('resolveConquestCause is ordinary conquest for free town with no prior banner', () => {
  assert.equal(
    resolveConquestCause(
      { bannerMembershipHistoryBySettlementId: { free: ['', ''] } },
      'free',
      'fa',
    ),
    CONQUEST_CAUSE_CONQUEST,
  )
})

test('resolveConquestCause is quashed rebellion when start and winner banners match', () => {
  assert.equal(
    resolveConquestCause(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', ''] } },
      'pin',
      'fa',
    ),
    CONQUEST_CAUSE_QUASHED_REBELLION,
  )
})

test('resolveConquestCause is quashed after mid-epoch foreign affiliation when start matches winner', () => {
  assert.equal(
    resolveConquestCause(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', 'fa'] } },
      'pin',
      'fa',
    ),
    CONQUEST_CAUSE_QUASHED_REBELLION,
  )
})

test('transferSettlementAsVassal stamps quashed_rebellion cause', () => {
  const slice = {
    epoch: 14,
    historyLog: [],
    bannerMembershipHistoryBySettlementId: {
      free: ['fa', ''],
    },
    settlements: [
      { id: 'cap', factionId: 'fa', status: 'living', population: 1000, tier: 'town' },
      { id: 'free', factionId: null, status: 'living', population: 400, tier: 'village' },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap',
        settlementIds: ['cap'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    recentConquestBySettlementId: {},
  }
  const next = transferSettlementAsVassal({
    slice,
    settlementId: 'free',
    winnerFactionId: 'fa',
    conqueredEpoch: 14,
  })
  assert.equal(next.recentConquestBySettlementId.free.cause, CONQUEST_CAUSE_QUASHED_REBELLION)
})

test('transferSettlementAsVassal stamps conquest cause for ordinary grabs', () => {
  const slice = {
    epoch: 8,
    historyLog: [],
    bannerMembershipHistoryBySettlementId: {
      free: ['', ''],
    },
    settlements: [
      { id: 'cap', factionId: 'fa', status: 'living', population: 1000, tier: 'town' },
      { id: 'free', factionId: null, status: 'living', population: 400, tier: 'village' },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap',
        settlementIds: ['cap'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    recentConquestBySettlementId: {},
  }
  const next = transferSettlementAsVassal({
    slice,
    settlementId: 'free',
    winnerFactionId: 'fa',
    conqueredEpoch: 8,
  })
  assert.equal(next.recentConquestBySettlementId.free.cause, CONQUEST_CAUSE_CONQUEST)
})
