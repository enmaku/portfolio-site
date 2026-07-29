import assert from 'node:assert/strict'
import test from 'node:test'
import { applyConquestResolution } from './applyConquestResolution.js'
import { selectResourceConquest } from './selectResourceConquest.js'
import { resetConflictTuning, setConflictTuning } from './conflictTuning.js'
import {
  HISTORY_KIND_MAJOR_WAR_END,
  HISTORY_KIND_MAJOR_WAR_START,
} from '../historyKinds.js'

test.afterEach(() => {
  resetConflictTuning()
})

function edge(partial) {
  return {
    id: partial.id,
    fromSettlementId: partial.fromSettlementId,
    toSettlementId: partial.toSettlementId,
    mode: 'road',
    haulDistanceFraction: partial.haulDistanceFraction ?? 1,
    capacityLb: 1,
    transportCostCpPerLb: 1,
    directionalFrictionAtoB: 1,
    directionalFrictionBtoA: 1,
  }
}

const reach = { overland: 20, road: 20, inlandWater: 20, openSea: 20 }

function twoFactionSlice() {
  return {
    epoch: 15,
    historyLog: [],
    colonistSettings: {
      threeDayHaulDistance: 3,
      landExpeditionRange: 4,
      inlandSailExpeditionRange: 4,
      openSeaExpeditionRange: 6,
    },
    settlements: [
      {
        id: 'a1',
        factionId: 'fa',
        status: 'living',
        population: 3000,
        tier: 'city',
      },
      {
        id: 'b1',
        factionId: 'fb',
        status: 'living',
        population: 500,
        tier: 'village',
        vassalLiegeSettlementId: 'b2',
      },
      {
        id: 'b2',
        factionId: 'fb',
        status: 'living',
        population: 2000,
        tier: 'town',
      },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'a1',
        settlementIds: ['a1'],
        status: 'active',
        emergedEpoch: 0,
      },
      {
        id: 'fb',
        capitalSettlementId: 'b2',
        settlementIds: ['b2', 'b1'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    warExhaustionBySettlementId: {},
    belligerentTradeBlocks: [],
    recentConquestBySettlementId: {},
    tradeRouteState: { candidates: [], activeFlows: [] },
  }
}

test('resource conquest takes only the contested pin and records major war history', () => {
  const slice = twoFactionSlice()
  const edges = [
    edge({ id: 'a1-b1', fromSettlementId: 'a1', toSettlementId: 'b1' }),
    edge({ id: 'b1-b2', fromSettlementId: 'b1', toSettlementId: 'b2' }),
  ]
  const result = applyConquestResolution({
    slice,
    attackerFactionId: 'fa',
    contestedSettlementId: 'b1',
    capacityBySettlementId: { a1: 3000, b1: 200, b2: 100 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
  })

  assert.equal(result.winner, 'attacker')
  assert.equal(result.fought, true)
  const b1 = result.slice.settlements.find((s) => s.id === 'b1')
  const b2 = result.slice.settlements.find((s) => s.id === 'b2')
  assert.equal(b1.factionId, 'fa')
  assert.equal(b2.factionId, 'fb')
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_MAJOR_WAR_START))
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_MAJOR_WAR_END))
  assert.equal(result.slice.belligerentTradeBlocks.length, 1)
  assert.ok(result.slice.warExhaustionBySettlementId.a1)
})

test('unaligned stake needs no rivalry edge and defends alone', () => {
  const slice = twoFactionSlice()
  slice.settlements.push({
    id: 'free',
    factionId: null,
    status: 'living',
    population: 100,
    tier: 'hamlet',
  })
  const edges = [edge({ id: 'a1-free', fromSettlementId: 'a1', toSettlementId: 'free' })]
  const result = applyConquestResolution({
    slice,
    attackerFactionId: 'fa',
    contestedSettlementId: 'free',
    capacityBySettlementId: { a1: 2000, free: 50 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
  })
  assert.equal(result.winner, 'attacker')
  assert.equal(result.slice.settlements.find((s) => s.id === 'free').factionId, 'fa')
  assert.equal(result.slice.belligerentTradeBlocks.length, 0)
})

test('selectResourceConquest respects cadence and intensity threshold', () => {
  setConflictTuning({
    warThreshold: 50,
    rivalBonus: 0,
    mightIntensityCap: 40,
    mightIntensityDivisor: 10,
    requireAttackerEdge: false,
    preferWinnableStakes: false,
    maxConquestsPerEpoch: 1,
    requireBorderNeighbor: false,
  })
  const slice = twoFactionSlice()
  const edges = [edge({ id: 'a1-b1', fromSettlementId: 'a1', toSettlementId: 'b1' })]
  const below = selectResourceConquest({
    slice,
    capacityBySettlementId: { a1: 100, b1: 50, b2: 50 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
    resourceScoreBySettlementId: { b1: 10 },
  })
  assert.equal(below, null)

  const busy = selectResourceConquest({
    slice,
    capacityBySettlementId: { a1: 5000, b1: 50, b2: 50 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
    resourceScoreBySettlementId: { b1: 100 },
    busyFactionIds: new Set(['fa']),
  })
  assert.equal(busy, null)

  const picked = selectResourceConquest({
    slice,
    capacityBySettlementId: { a1: 5000, b1: 50, b2: 50 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
    resourceScoreBySettlementId: { b1: 100 },
  })
  assert.ok(picked)
  assert.equal(picked.attackerFactionId, 'fa')
  assert.equal(picked.contestedSettlementId, 'b1')
})
