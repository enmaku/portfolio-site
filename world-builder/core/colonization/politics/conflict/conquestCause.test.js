import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONQUEST_CAUSE_CONQUEST,
  CONQUEST_CAUSE_QUASHED_REBELLION,
  resolveConquestCause,
} from './conquestCause.js'
import { HISTORY_KIND_VASSAL_DEFECTION } from '../historyKinds.js'
import { transferSettlementAsVassal } from './transferSettlementAsVassal.js'

test('resolveConquestCause is ordinary conquest for rival stake', () => {
  assert.equal(
    resolveConquestCause({ historyLog: [] }, 'border', 'fa', 12, 'fb'),
    CONQUEST_CAUSE_CONQUEST,
  )
})

test('resolveConquestCause is ordinary conquest for free town without soft-unalign', () => {
  assert.equal(
    resolveConquestCause({ historyLog: [] }, 'free', 'fa', 8, null),
    CONQUEST_CAUSE_CONQUEST,
  )
})

test('resolveConquestCause is quashed rebellion after same-epoch soft-unalign from winner', () => {
  assert.equal(
    resolveConquestCause(
      {
        historyLog: [
          {
            kind: HISTORY_KIND_VASSAL_DEFECTION,
            epoch: 14,
            settlementId: 'pin',
            fromFactionId: 'fa',
            cause: 'soft_unaligned',
          },
        ],
      },
      'pin',
      'fa',
      14,
      null,
    ),
    CONQUEST_CAUSE_QUASHED_REBELLION,
  )
})

test('resolveConquestCause stays conquest when another banner takes the soft-unaligned pin', () => {
  assert.equal(
    resolveConquestCause(
      {
        historyLog: [
          {
            kind: HISTORY_KIND_VASSAL_DEFECTION,
            epoch: 14,
            settlementId: 'pin',
            fromFactionId: 'fa',
            cause: 'soft_unaligned',
          },
        ],
      },
      'pin',
      'fb',
      14,
      null,
    ),
    CONQUEST_CAUSE_CONQUEST,
  )
})

test('transferSettlementAsVassal stamps quashed_rebellion cause', () => {
  const slice = {
    epoch: 14,
    historyLog: [
      {
        kind: HISTORY_KIND_VASSAL_DEFECTION,
        epoch: 14,
        settlementId: 'free',
        fromFactionId: 'fa',
        cause: 'soft_unaligned',
      },
    ],
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
