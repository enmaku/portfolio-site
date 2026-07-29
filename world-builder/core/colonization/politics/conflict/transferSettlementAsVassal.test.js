import assert from 'node:assert/strict'
import test from 'node:test'
import { transferSettlementAsVassal } from './transferSettlementAsVassal.js'

test('conquest victory vassalizes only the stake pin; other loser pins remain', () => {
  const slice = {
    epoch: 12,
    settlements: [
      {
        id: 'cap-a',
        factionId: 'fa',
        status: 'living',
        population: 2000,
        tier: 'city',
      },
      {
        id: 'border',
        factionId: 'fb',
        status: 'living',
        population: 800,
        tier: 'town',
        vassalLiegeSettlementId: 'cap-b',
      },
      {
        id: 'cap-b',
        factionId: 'fb',
        status: 'living',
        population: 1500,
        tier: 'city',
      },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap-a',
        settlementIds: ['cap-a'],
        status: 'active',
        emergedEpoch: 0,
      },
      {
        id: 'fb',
        capitalSettlementId: 'cap-b',
        settlementIds: ['cap-b', 'border'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    recentConquestBySettlementId: {},
  }

  const next = transferSettlementAsVassal({
    slice,
    settlementId: 'border',
    winnerFactionId: 'fa',
    conqueredEpoch: 12,
  })

  const border = next.settlements.find((s) => s.id === 'border')
  const capB = next.settlements.find((s) => s.id === 'cap-b')
  const fa = next.factions.find((f) => f.id === 'fa')
  const fb = next.factions.find((f) => f.id === 'fb')

  assert.equal(border.factionId, 'fa')
  assert.equal(border.vassalLiegeSettlementId, 'cap-a')
  assert.equal(capB.factionId, 'fb')
  assert.ok(fa.settlementIds.includes('border'))
  assert.ok(!fb.settlementIds.includes('border'))
  assert.ok(fb.settlementIds.includes('cap-b'))
  assert.equal(next.recentConquestBySettlementId.border.conqueredEpoch, 12)
  assert.equal(next.recentConquestBySettlementId.border.priorFactionId, 'fb')
})

test('unaligned stake can be vassalized without a prior faction', () => {
  const slice = {
    epoch: 8,
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
  assert.equal(next.settlements.find((s) => s.id === 'free').factionId, 'fa')
  assert.equal(next.recentConquestBySettlementId.free.priorFactionId, null)
})
