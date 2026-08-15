import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSettlementNameAnnotations,
  stripEmptyJson,
} from './buildSettlementNameAnnotations.js'
import { createDefaultColonizationSlice } from '../core/colonization/createDefaultColonizationSlice.js'

test('stripEmptyJson drops nulls, empties, and empty objects', () => {
  assert.deepEqual(
    stripEmptyJson({
      a: 1,
      b: null,
      c: '',
      d: [],
      e: { f: null },
      g: [null, 2],
    }),
    { a: 1, g: [2] },
  )
})

test('buildSettlementNameAnnotations stays lean and ranked', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = 'running'
  slice.epoch = 4
  slice.settlements = [
    {
      id: 's1',
      mapNumber: 1,
      x: 10,
      y: 12,
      status: 'living',
      tier: 'city',
      population: 4000,
      maritimeRole: 'port',
      foundedEpoch: 0,
      factionId: 'f1',
      membershipBand: 'capital',
    },
    {
      id: 's2',
      mapNumber: 2,
      x: 40,
      y: 80,
      status: 'living',
      tier: 'town',
      population: 1200,
      maritimeRole: 'none',
      foundedEpoch: 2,
      originSettlementId: 's1',
      factionId: 'f1',
      membershipBand: 'member',
    },
  ]
  slice.factions = [
    {
      id: 'f1',
      capitalSettlementId: 's1',
      settlementIds: ['s1', 's2'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.rivalryEdges = []
  slice.historyLog = [
    { kind: 'founding', epoch: 0 },
    { kind: 'faction_emerged', epoch: 0, factionId: 'f1', capitalSettlementId: 's1', cause: 'founding' },
  ]
  slice.roads = [
    { mode: 'land', settlementIds: ['s1', 's2'], cells: [{ x: 10, y: 12 }, { x: 40, y: 80 }] },
  ]
  slice.tradeRouteState = {
    candidates: [],
    activeFlows: [
      {
        edgeId: 'e1',
        fromSettlementId: 's1',
        toSettlementId: 's2',
        commodityId: 'grain',
        amount: 50,
        mode: 'road',
      },
    ],
  }
  slice.tradeAccounts = { obligations: [], balancesBySettlementId: { s1: 100, s2: -20 } }
  slice.primaryClaim = {
    s1: [{ x: 10, y: 12 }],
    s2: [{ x: 40, y: 80 }],
  }

  const worldDocument = {
    gridWidth: 100,
    gridHeight: 100,
    biomes: new Uint8Array(100 * 100),
    saltNodes: [],
    metalNodes: [],
  }

  const annotations = buildSettlementNameAnnotations(slice, worldDocument)
  assert.equal(annotations.settlements.length, 2)
  assert.equal(annotations.settlements[0].id, 's1')
  assert.equal(annotations.settlements[0].n, 1)
  assert.equal(annotations.settlements[0].popRank, 1)
  assert.equal(annotations.settlements[0].originN, undefined)
  assert.equal(annotations.settlements[1].originN, 1)
  assert.equal(annotations.settlements[0].wealth, undefined)
  assert.equal(annotations.settlements[0].supplies, undefined)
  assert.equal(annotations.settlements[0].history, undefined)
  assert.ok(Array.isArray(annotations.chronicle))
  assert.ok(annotations.chronicle.some((row) => row.kind === 'faction_emerged'))
  assert.equal(annotations.tradeFlows.length, 1)
  assert.equal(annotations.tradeFlows[0].from, 1)
  assert.equal(annotations.tradeFlows[0].to, 2)
  assert.equal(annotations.routes.length, 1)
  assert.deepEqual(annotations.factions[0].capitalN, 1)
})

test('buildSettlementNameAnnotations includes ruins with status only', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = 'running'
  slice.epoch = 5
  slice.settlements = [
    {
      id: 'alive',
      mapNumber: 1,
      x: 5,
      y: 5,
      status: 'living',
      tier: 'town',
      population: 900,
      foundedEpoch: 0,
      factionId: 'f1',
    },
    {
      id: 'dead',
      mapNumber: 2,
      x: 20,
      y: 20,
      status: 'ruin',
      tier: 'town',
      population: 0,
      foundedEpoch: 1,
      factionId: null,
    },
  ]
  slice.factions = [
    {
      id: 'f1',
      capitalSettlementId: 'alive',
      settlementIds: ['alive'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.historyLog = [
    { kind: 'founding', epoch: 0 },
    { kind: 'settlement_abandoned', epoch: 4, settlementId: 'dead' },
  ]
  slice.primaryClaim = { alive: [{ x: 5, y: 5 }] }
  slice.tradeAccounts = { obligations: [], balancesBySettlementId: { alive: 10 } }

  const annotations = buildSettlementNameAnnotations(slice, {
    gridWidth: 40,
    gridHeight: 40,
    biomes: new Uint8Array(40 * 40),
    saltNodes: [],
    metalNodes: [],
  })

  assert.equal(annotations.settlements.length, 2)
  assert.equal(annotations.ruinCount, 1)
  const ruin = annotations.settlements.find((row) => row.id === 'dead')
  assert.equal(ruin.status, 'ruin')
  assert.equal(ruin.pop, undefined)
  assert.equal(ruin.factionId, undefined)
  assert.equal(ruin.n, 2)
})
