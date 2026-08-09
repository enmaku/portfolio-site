import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildColonizationSimStatus,
  buildFoundingChronicle,
  shouldShowSimStatusPanel,
  shouldShowValidationAdvisory,
} from './buildColonizationSimStatus.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'

test('buildColonizationSimStatus reports census counters and population extremes', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 3
  slice.settlements = [
    { id: 'a', status: 'living', population: 10, x: 0, y: 0 },
    { id: 'b', status: 'ruin', population: 0, x: 1, y: 0 },
    { id: 'c', status: 'living', population: 40, x: 2, y: 0 },
  ]
  slice.expeditions = [
    {
      id: 'e1',
      settlementId: 'a',
      status: 'active',
      mode: 'land',
      route: [],
      progressIndex: 0,
      bearing: 0,
    },
  ]
  slice.roads = [{ cells: [{ x: 0, y: 0 }], settlementIds: ['a', 'c'] }]
  slice.tradeRouteState = {
    candidates: [],
    activeFlows: [{ edgeId: 'f1', fromSettlementId: 'a', toSettlementId: 'c', commodityId: 'grain', amount: 1 }],
  }
  slice.lastTradeEpochResult = {
    flows: slice.tradeRouteState.activeFlows,
    offMapTrades: [
      { settlementId: 'a', commodityId: 'salt', direction: 'import', amount: 10, unitPriceCp: 5 },
      { settlementId: 'a', commodityId: 'grain', direction: 'export', amount: 100, unitPriceCp: 0.5 },
    ],
    settlementCommodityRoles: {},
    localPricesBySettlementId: {},
    obligationDeltas: [],
    externalAccountDeltas: {},
    effectiveDelivered: {},
    realmBalancesCp: {},
    nettedObligations: [],
  }
  slice.frontierExhausted = true

  const status = buildColonizationSimStatus(slice)
  assert.strictEqual(status.epoch, 3)
  assert.strictEqual(status.livingSettlementCount, 2)
  assert.strictEqual(status.ruinCount, 1)
  assert.strictEqual(status.activeExpeditionCount, 1)
  assert.strictEqual(status.roadSegmentCount, 1)
  assert.strictEqual(status.activeTradeFlowCount, 1)
  assert.strictEqual(status.offMapTradeVolumeCp, 100)
  assert.strictEqual(status.totalPopulation, 50)
  assert.deepEqual(status.highestPopulation, { settlementId: 'c', value: 40 })
  assert.deepEqual(status.lowestPopulation, { settlementId: 'a', value: 10 })
  assert.equal('frontierExhausted' in status, false)
})

test('buildColonizationSimStatus ties population extremes by settlement id', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'b', status: 'living', population: 10, x: 0, y: 0 },
    { id: 'a', status: 'living', population: 10, x: 1, y: 0 },
  ]
  const status = buildColonizationSimStatus(slice)
  assert.deepEqual(status.highestPopulation, { settlementId: 'a', value: 10 })
  assert.deepEqual(status.lowestPopulation, { settlementId: 'a', value: 10 })
})

test('buildColonizationSimStatus resource claims count salt and metals in primary claim', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [{ id: 'a', status: 'living', population: 5, x: 0, y: 0 }]
  slice.primaryClaim = {
    a: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
  }
  const worldDocument = {
    gridWidth: 10,
    saltNodes: [
      { id: 's1', x: 1, y: 0, score: 1 },
      { id: 's2', x: 9, y: 0, score: 1 },
    ],
    metalNodes: [
      { id: 'm1', x: 2, y: 0, score: 1, kind: 'copper' },
      { id: 'm2', x: 3, y: 0, score: 1, kind: 'copper' },
      { id: 'm3', x: 4, y: 0, score: 1, kind: 'silver' },
    ],
  }

  const status = buildColonizationSimStatus(slice, worldDocument)
  assert.deepEqual(status.resourceClaims, [
    { key: 'salt', claimed: 1, total: 2 },
    { key: 'copper', claimed: 1, total: 2 },
    { key: 'silver', claimed: 0, total: 1 },
  ])
})

test('buildColonizationSimStatus omits resource rows with zero world total', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [{ id: 'a', status: 'living', population: 5, x: 0, y: 0 }]
  const status = buildColonizationSimStatus(slice, {
    gridWidth: 4,
    saltNodes: [],
    metalNodes: [],
  })
  assert.deepEqual(status.resourceClaims, [])
})

test('buildFoundingChronicle filters founding-related history kinds', () => {
  const slice = createDefaultColonizationSlice()
  slice.historyLog = [
    { kind: 'founding', epoch: 0 },
    { kind: 'settlement_founded', epoch: 2, settlementId: 's2' },
    { kind: 'settlement_abandoned', epoch: 3, settlementId: 's3' },
    { kind: 'settlement_merged', epoch: 4, settlementId: 'survivor' },
    { kind: 'other', epoch: 1 },
  ]
  const chronicle = buildFoundingChronicle(slice)
  assert.strictEqual(chronicle.length, 3)
  assert.strictEqual(chronicle[1].settlementId, 's2')
  assert.strictEqual(chronicle[2].kind, 'settlement_abandoned')
})

test('shouldShowSimStatusPanel for entire running phase including epoch 0', () => {
  assert.strictEqual(shouldShowSimStatusPanel('running'), true)
  assert.strictEqual(shouldShowSimStatusPanel('setup'), false)
  assert.strictEqual(shouldShowSimStatusPanel('terrain'), false)
})

test('shouldShowValidationAdvisory hides after epoch 0 in running', () => {
  assert.strictEqual(shouldShowValidationAdvisory('running', 0, 1), true)
  assert.strictEqual(shouldShowValidationAdvisory('running', 1, 1), false)
})

test('buildFoundingChronicle includes faction politics history kinds', () => {
  const slice = createDefaultColonizationSlice()
  slice.historyLog = [
    { kind: 'increment3_latched', epoch: 5 },
    { kind: 'faction_emerged', epoch: 7, factionId: 'faction-a' },
    { kind: 'vassal_defection', epoch: 8, settlementId: 's2', cause: 'spawn' },
    { kind: 'other', epoch: 9 },
  ]
  const chronicle = buildFoundingChronicle(slice)
  assert.strictEqual(chronicle.length, 3)
  assert.strictEqual(chronicle[0].kind, 'increment3_latched')
  assert.strictEqual(chronicle[1].factionId, 'faction-a')
  assert.strictEqual(chronicle[2].cause, 'spawn')
})

test('buildFoundingChronicle includes war and rebellion kinds but not economic contest', () => {
  const slice = createDefaultColonizationSlice()
  slice.historyLog = [
    {
      kind: 'major_war_start',
      epoch: 10,
      attackerFactionId: 'fa',
      contestedSettlementId: 's1',
    },
    {
      kind: 'major_war_end',
      epoch: 10,
      winner: 'attacker',
      fought: true,
      contestedSettlementId: 's1',
    },
    {
      kind: 'rebellion_end',
      epoch: 11,
      winner: 'rebel',
      fought: false,
      contestedSettlementId: 's2',
    },
    { kind: 'treaty_peace', epoch: 12, aFactionId: 'fa', bFactionId: 'fb' },
    { kind: 'economic_contest', epoch: 10, intensity: 12 },
  ]
  const chronicle = buildFoundingChronicle(slice)
  assert.equal(chronicle.length, 4)
  assert.ok(chronicle.every((row) => row.kind !== 'economic_contest'))
  assert.ok(chronicle.some((row) => row.kind === 'major_war_end' && row.winner === 'attacker'))
  assert.ok(chronicle.some((row) => row.kind === 'treaty_peace'))
})
