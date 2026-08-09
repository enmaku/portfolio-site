import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAllianceMembership } from './applyAllianceMembership.js'
import {
  HISTORY_KIND_ALLIANCE,
  HISTORY_KIND_FACTION_EMERGED,
} from '../historyKinds.js'
import { MAX_ACTIVE_FACTIONS } from '../factionCap.js'
import { undirectedSettlementPairKey } from './primaryClaimAdjacency.js'
import { createDefaultColonizationSlice } from '../../createDefaultColonizationSlice.js'

/**
 * @param {Partial<import('../../createDefaultColonizationSlice.js').ColonizationSlice>} patch
 */
function baseSlice(patch = {}) {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 20
  Object.assign(slice, patch)
  return slice
}

/**
 * @param {string[]} ids
 */
function pairSet(ids) {
  /** @type {Set<string>} */
  const pairs = new Set()
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.add(undirectedSettlementPairKey(ids[i], ids[j]))
    }
  }
  return pairs
}

test('join-existing seats vassal not trade partner', () => {
  const slice = baseSlice({
    settlements: [
      { id: 'cap', factionId: 'fa', status: 'living', population: 200 },
      { id: 'm', factionId: 'fa', status: 'living', population: 120 },
      { id: 'free', factionId: null, status: 'living', population: 60 },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap',
        settlementIds: ['cap', 'm'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    politicalPressureArmedBySettlementId: { free: 'fa' },
    politicalPressureStreak: { free: 3 },
  })

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: { free: 'fa' },
    claimAdjacencyPairs: new Set(),
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  const free = next.settlements.find((s) => s.id === 'free')
  assert.equal(free.factionId, 'fa')
  assert.equal(free.isTradePartner, false)
  assert.equal(free.vassalLiegeSettlementId, 'cap')
  assert.ok(next.factions[0].settlementIds.includes('free'))
  assert.equal(next.recentAllianceBySettlementId.free.kind, 'join_existing')
  assert.equal(next.recentAllianceBySettlementId.free.allianceEpoch, 20)
  assert.equal(next.politicalPressureArmedBySettlementId.free, undefined)
  assert.ok(
    next.membershipCooldown.some(
      (c) => c.subjectId === 'free' && c.kind === 'alliance' && c.untilEpoch === 22,
    ),
  )
  assert.ok(
    next.historyLog.some(
      (e) =>
        e.kind === HISTORY_KIND_ALLIANCE &&
        e.settlementId === 'free' &&
        e.cause === 'join_existing',
    ),
  )
})

test('multi-pin capital refuses alliance-flip', () => {
  const slice = baseSlice({
    settlements: [
      { id: 'cap-a', factionId: 'fa', status: 'living', population: 200 },
      { id: 'm-a', factionId: 'fa', status: 'living', population: 100 },
      { id: 'cap-b', factionId: 'fb', status: 'living', population: 220 },
      { id: 'm-b', factionId: 'fb', status: 'living', population: 110 },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap-a',
        settlementIds: ['cap-a', 'm-a'],
        status: 'active',
        emergedEpoch: 0,
      },
      {
        id: 'fb',
        capitalSettlementId: 'cap-b',
        settlementIds: ['cap-b', 'm-b'],
        status: 'active',
        emergedEpoch: 1,
      },
    ],
  })

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: { 'cap-a': 'fb' },
    claimAdjacencyPairs: new Set(),
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  const capA = next.settlements.find((s) => s.id === 'cap-a')
  assert.equal(capA.factionId, 'fa')
  assert.equal(capA.vassalLiegeSettlementId ?? null, null)
  assert.ok(!next.historyLog.some((e) => e.kind === HISTORY_KIND_ALLIANCE))
})

test('non-capital peel joins as vassal', () => {
  const slice = baseSlice({
    settlements: [
      { id: 'cap-a', factionId: 'fa', status: 'living', population: 200 },
      { id: 'm-a', factionId: 'fa', status: 'living', population: 90 },
      {
        id: 'peel',
        factionId: 'fa',
        status: 'living',
        population: 70,
        isTradePartner: true,
        vassalLiegeSettlementId: null,
      },
      { id: 'cap-b', factionId: 'fb', status: 'living', population: 210 },
      { id: 'm-b', factionId: 'fb', status: 'living', population: 100 },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap-a',
        settlementIds: ['cap-a', 'm-a', 'peel'],
        status: 'active',
        emergedEpoch: 0,
      },
      {
        id: 'fb',
        capitalSettlementId: 'cap-b',
        settlementIds: ['cap-b', 'm-b'],
        status: 'active',
        emergedEpoch: 1,
      },
    ],
  })

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: { peel: 'fb' },
    claimAdjacencyPairs: new Set(),
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  const peel = next.settlements.find((s) => s.id === 'peel')
  assert.equal(peel.factionId, 'fb')
  assert.equal(peel.isTradePartner, false)
  assert.equal(peel.vassalLiegeSettlementId, 'cap-b')
  assert.ok(!next.factions.find((f) => f.id === 'fa').settlementIds.includes('peel'))
  assert.ok(next.factions.find((f) => f.id === 'fb').settlementIds.includes('peel'))
})

test('peer mint capital and ordinary co-founders', () => {
  const slice = baseSlice({
    settlements: [
      { id: 'a', factionId: 'solo-a', status: 'living', population: 80, tier: 'village' },
      { id: 'b', factionId: 'solo-b', status: 'living', population: 150, tier: 'town' },
      { id: 'c', factionId: null, status: 'living', population: 40, tier: 'hamlet' },
    ],
    factions: [
      {
        id: 'solo-a',
        capitalSettlementId: 'a',
        settlementIds: ['a'],
        status: 'active',
        emergedEpoch: 1,
      },
      {
        id: 'solo-b',
        capitalSettlementId: 'b',
        settlementIds: ['b'],
        status: 'active',
        emergedEpoch: 2,
      },
    ],
  })
  const pairs = pairSet(['a', 'b', 'c'])

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: {},
    claimAdjacencyPairs: pairs,
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  const a = next.settlements.find((s) => s.id === 'a')
  const b = next.settlements.find((s) => s.id === 'b')
  const c = next.settlements.find((s) => s.id === 'c')
  assert.equal(a.factionId, b.factionId)
  assert.equal(b.factionId, c.factionId)
  assert.ok(a.factionId)
  const minted = next.factions.find((f) => f.id === a.factionId)
  assert.equal(minted.capitalSettlementId, 'b')
  assert.equal(minted.status, 'active')
  for (const pin of [a, b, c]) {
    assert.equal(pin.isTradePartner, false)
    assert.equal(pin.vassalLiegeSettlementId, null)
  }
  assert.equal(next.factions.find((f) => f.id === 'solo-a').status, 'extinct')
  assert.equal(next.factions.find((f) => f.id === 'solo-b').status, 'extinct')
  assert.equal(next.recentAllianceBySettlementId.a.kind, 'peer_mint')
  assert.equal(next.recentAllianceBySettlementId.b.kind, 'peer_mint')
})

test('join-existing wins when both join and peer mint could fire', () => {
  const slice = baseSlice({
    settlements: [
      { id: 'cap', factionId: 'empire', status: 'living', population: 300 },
      { id: 'm', factionId: 'empire', status: 'living', population: 200 },
      { id: 'border', factionId: null, status: 'living', population: 70 },
      { id: 'buddy', factionId: 'solo-buddy', status: 'living', population: 60 },
    ],
    factions: [
      {
        id: 'empire',
        capitalSettlementId: 'cap',
        settlementIds: ['cap', 'm'],
        status: 'active',
        emergedEpoch: 0,
      },
      {
        id: 'solo-buddy',
        capitalSettlementId: 'buddy',
        settlementIds: ['buddy'],
        status: 'active',
        emergedEpoch: 3,
      },
    ],
  })
  const claimPairs = new Set([
    undirectedSettlementPairKey('border', 'buddy'),
    undirectedSettlementPairKey('border', 'cap'),
  ])

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: { border: 'empire' },
    claimAdjacencyPairs: claimPairs,
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  const border = next.settlements.find((s) => s.id === 'border')
  const buddy = next.settlements.find((s) => s.id === 'buddy')
  assert.equal(border.factionId, 'empire')
  assert.equal(border.vassalLiegeSettlementId, 'cap')
  assert.equal(buddy.factionId, 'solo-buddy')
  assert.ok(
    next.historyLog.some(
      (e) => e.kind === HISTORY_KIND_ALLIANCE && e.cause === 'join_existing',
    ),
  )
  assert.ok(!next.historyLog.some((e) => e.cause === 'peer_mint'))
  assert.ok(!next.historyLog.some((e) => e.cause === 'alliance_peer_mint'))
})

test('active faction cap blocks peer mint', () => {
  const fillers = Array.from({ length: MAX_ACTIVE_FACTIONS }, (_, i) => ({
    id: `fill-${i}`,
    capitalSettlementId: `fs-${i}`,
    settlementIds: [`fs-${i}`],
    status: 'active',
    emergedEpoch: i,
  }))
  const fillerSettlements = fillers.map((f) => ({
    id: f.capitalSettlementId,
    factionId: f.id,
    status: 'living',
    population: 30,
  }))
  const slice = baseSlice({
    settlements: [
      ...fillerSettlements,
      { id: 'x', factionId: null, status: 'living', population: 50 },
      { id: 'y', factionId: null, status: 'living', population: 55 },
    ],
    factions: fillers,
  })

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: {},
    claimAdjacencyPairs: pairSet(['x', 'y']),
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  assert.equal(next.settlements.find((s) => s.id === 'x').factionId, null)
  assert.equal(next.settlements.find((s) => s.id === 'y').factionId, null)
  assert.equal(next.factions.filter((f) => f.status === 'active').length, MAX_ACTIVE_FACTIONS)
  assert.ok(!next.historyLog.some((e) => e.cause === 'alliance_peer_mint'))
})

test('alliance and faction_emerged history kinds present on peer mint', () => {
  const slice = baseSlice({
    settlements: [
      { id: 'p', factionId: null, status: 'living', population: 90 },
      { id: 'q', factionId: null, status: 'living', population: 100 },
    ],
    factions: [],
  })

  const { slice: next } = applyAllianceMembership({
    slice,
    armedBySettlementId: {},
    claimAdjacencyPairs: pairSet(['p', 'q']),
    corridorPairs: new Set(),
    gridWidth: 8,
    gridHeight: 8,
  })

  const alliances = next.historyLog.filter((e) => e.kind === HISTORY_KIND_ALLIANCE)
  assert.equal(alliances.length, 2)
  assert.ok(alliances.every((e) => e.cause === 'peer_mint'))
  assert.ok(
    next.historyLog.some(
      (e) => e.kind === HISTORY_KIND_FACTION_EMERGED && e.cause === 'alliance_peer_mint',
    ),
  )
})
