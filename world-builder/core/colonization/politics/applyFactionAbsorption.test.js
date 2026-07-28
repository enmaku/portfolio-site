import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { HISTORY_KIND_FACTION_ABSORPTION, HISTORY_KIND_FACTION_EXTINCT } from './historyKinds.js'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'

function flatLandDoc(width, height) {
  const n = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(n).fill(2),
    timberRaster: new Float32Array(n).fill(1),
    fields: {
      elevation: new Float32Array(n).fill(0.6),
      movementCost: new Float32Array(n).fill(1),
    },
    lakeMask: new Uint8Array(n),
    riverCorridorMask: new Uint8Array(n),
  }
}

function baseSlice() {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 50
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  return slice
}

test('asymmetric survival dependence absorbs weaker into stronger', () => {
  const slice = baseSlice()
  slice.factions = [
    {
      id: 'strong',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'weak',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 14,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 2000, status: 'living', tier: 'town', factionId: 'strong' },
    { id: 'b', x: 4, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'weak' },
  ]
  slice.factionDependenceStreak = { 'weak->strong': 3 }

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
    survivalBySettlementId: {
      a: { foodSurplus: 100, ok: true },
      b: { foodSurplus: -50, ok: false, dependsOnFactionId: 'strong' },
    },
  })

  assert.strictEqual(next.factions.find((f) => f.id === 'weak')?.status, 'extinct')
  assert.strictEqual(next.settlements.find((s) => s.id === 'b').factionId, 'strong')
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_FACTION_ABSORPTION))
})

test('heavy trade alone without dependence does not absorb separate factions', () => {
  const slice = baseSlice()
  slice.factions = [
    {
      id: 'a-faction',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'b-faction',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 14,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'a-faction' },
    { id: 'b', x: 35, y: 35, population: 1200, status: 'living', tier: 'town', factionId: 'b-faction' },
  ]

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    survivalBySettlementId: {
      a: { foodSurplus: 50, ok: true },
      b: { foodSurplus: 50, ok: true },
    },
  })

  assert.strictEqual(next.factions.filter((f) => f.status === 'active').length, 2)
  assert.ok(!next.historyLog.some((e) => e.kind === HISTORY_KIND_FACTION_ABSORPTION))
})

test('war outcome absorbs loser into winner', () => {
  const slice = baseSlice()
  slice.factions = [
    {
      id: 'winner',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'loser',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 14,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'winner' },
    { id: 'b', x: 35, y: 35, population: 1200, status: 'living', tier: 'town', factionId: 'loser' },
  ]

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    warOutcomes: [{ loserFactionId: 'loser', winnerFactionId: 'winner' }],
  })

  assert.strictEqual(next.factions.find((f) => f.id === 'loser')?.status, 'extinct')
  assert.strictEqual(next.settlements.find((s) => s.id === 'b').factionId, 'winner')
  assert.ok(
    next.historyLog.some(
      (e) => e.kind === HISTORY_KIND_FACTION_ABSORPTION && e.cause === 'war',
    ),
  )
})

test('faction with no living members becomes extinct', () => {
  const slice = baseSlice()
  slice.factions = [
    {
      id: 'dead',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 0, status: 'ruin', tier: null, factionId: 'dead' },
  ]

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(10, 10),
    primaryClaim: {},
  })

  assert.strictEqual(next.factions.find((f) => f.id === 'dead')?.status, 'extinct')
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_FACTION_EXTINCT))
})

test('mutual re-integration keeps senior lineage as survivor', () => {
  const slice = baseSlice()
  slice.factions = [
    {
      id: 'senior',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'junior',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 20,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'senior' },
    { id: 'b', x: 4, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'junior' },
  ]
  slice.mutualReintegrationStreak = { 'junior|senior': 3 }

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
    survivalBySettlementId: {
      a: { foodSurplus: 10, ok: true, tradeDependenceOnFactionId: 'junior' },
      b: { foodSurplus: 10, ok: true, tradeDependenceOnFactionId: 'senior' },
    },
  })

  assert.strictEqual(next.factions.find((f) => f.id === 'junior')?.status, 'extinct')
  assert.strictEqual(next.settlements.find((s) => s.id === 'b').factionId, 'senior')
  assert.ok(
    next.historyLog.some(
      (e) =>
        e.kind === HISTORY_KIND_FACTION_ABSORPTION && e.cause === 'mutual_reintegration',
    ),
  )
})
