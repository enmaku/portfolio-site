import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { HISTORY_KIND_FACTION_EMERGED, HISTORY_KIND_INCREMENT3_LATCHED } from './historyKinds.js'
import { FACTION_MINT_STAGGER_EPOCHS } from './politicsConstants.js'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'

function flatLandDoc(width, height, arableFill = 2) {
  const n = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(n).fill(arableFill),
    timberRaster: new Float32Array(n).fill(1),
    fields: {
      elevation: new Float32Array(n).fill(0.6),
      movementCost: new Float32Array(n).fill(1),
    },
    lakeMask: new Uint8Array(n),
    riverCorridorMask: new Uint8Array(n),
  }
}

test('post-latch stagger queues components without minting all on the latch epoch', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 10
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town' },
    { id: 'b', x: 35, y: 2, population: 1200, status: 'living', tier: 'town' },
    { id: 'c', x: 2, y: 35, population: 1200, status: 'living', tier: 'town' },
  ]
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
  })

  assert.strictEqual(next.increment3LatchedEpoch, 10)
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED))
  assert.ok(next.pendingComponentMints.length >= 2)
  assert.strictEqual(next.factions.filter((f) => f.status === 'active').length, 0)
  assert.ok(next.settlements.every((s) => s.factionId == null))
})

test('pending component crystallizes into one faction on its due epoch', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 10
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.pendingComponentMints = [
    { componentKey: 'a|b', settlementIds: ['a', 'b'], dueEpoch: 10 + FACTION_MINT_STAGGER_EPOCHS },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town' },
    { id: 'b', x: 4, y: 2, population: 200, status: 'living', tier: 'village' },
  ]

  const beforeDue = applyPoliticsPhase({
    slice: { ...slice, epoch: 10 + FACTION_MINT_STAGGER_EPOCHS - 1 },
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
  })
  assert.strictEqual(beforeDue.slice.factions.length, 0)

  const onDue = applyPoliticsPhase({
    slice: { ...beforeDue.slice, epoch: 10 + FACTION_MINT_STAGGER_EPOCHS },
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
  })
  assert.strictEqual(onDue.slice.factions.length, 1)
  assert.strictEqual(onDue.slice.factions[0].capitalSettlementId, 'a')
  assert.deepStrictEqual(
    [...onDue.slice.factions[0].settlementIds].sort(),
    ['a', 'b'],
  )
  assert.ok(onDue.slice.historyLog.some((e) => e.kind === HISTORY_KIND_FACTION_EMERGED))
  assert.strictEqual(onDue.slice.settlements.find((s) => s.id === 'a').factionId, onDue.slice.factions[0].id)
  assert.strictEqual(onDue.slice.settlements.find((s) => s.id === 'b').factionId, onDue.slice.factions[0].id)
  assert.strictEqual(onDue.slice.pendingComponentMints.length, 0)
})

test('maritime peel mints the drain city faction immediately on latch', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 7
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.settlements = [
    {
      id: 'port',
      x: 5,
      y: 5,
      population: 1000,
      status: 'living',
      tier: 'town',
      logisticsNodePrimaryType: 'drain_city',
    },
    { id: 'inland', x: 8, y: 5, population: 1200, status: 'living', tier: 'town' },
  ]
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20, 0),
    primaryClaim: { port: [{ x: 5, y: 5 }], inland: [{ x: 8, y: 5 }] },
  })

  assert.strictEqual(next.increment3LatchedEpoch, 7)
  const peelFaction = next.factions.find((f) => f.settlementIds.includes('port'))
  assert.ok(peelFaction)
  assert.strictEqual(peelFaction.capitalSettlementId, 'port')
  assert.strictEqual(next.settlements.find((s) => s.id === 'port').factionId, peelFaction.id)
})

test('latch fracture keeps founding faction capital component and detaches isolated towns', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 10
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.factions = [
    {
      id: 'faction-founding-a',
      capitalSettlementId: 'a',
      settlementIds: ['a', 'b', 'c'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-founding-a' },
    { id: 'b', x: 35, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-founding-a' },
    { id: 'c', x: 2, y: 35, population: 1200, status: 'living', tier: 'town', factionId: 'faction-founding-a' },
  ]
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
  })

  assert.strictEqual(next.increment3LatchedEpoch, 10)
  assert.strictEqual(next.settlements.find((s) => s.id === 'a').factionId, 'faction-founding-a')
  assert.ok(next.factions.find((f) => f.id === 'faction-founding-a').settlementIds.includes('a'))
  assert.strictEqual(next.settlements.find((s) => s.id === 'b').factionId, null)
  assert.strictEqual(next.settlements.find((s) => s.id === 'c').factionId, null)
  assert.ok(next.pendingComponentMints.length >= 2)
  assert.strictEqual(next.factions.filter((f) => f.status === 'active').length, 1)
})

test('maritime peel detaches drain city from founding faction with inland peers', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 7
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.factions = [
    {
      id: 'faction-founding-port',
      capitalSettlementId: 'port',
      settlementIds: ['port', 'inland'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.settlements = [
    {
      id: 'port',
      x: 5,
      y: 5,
      population: 1000,
      status: 'living',
      tier: 'town',
      logisticsNodePrimaryType: 'drain_city',
      factionId: 'faction-founding-port',
    },
    {
      id: 'inland',
      x: 8,
      y: 5,
      population: 1200,
      status: 'living',
      tier: 'town',
      factionId: 'faction-founding-port',
      vassalLiegeSettlementId: 'port',
    },
  ]
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20, 0),
    primaryClaim: { port: [{ x: 5, y: 5 }], inland: [{ x: 8, y: 5 }] },
  })

  assert.strictEqual(next.increment3LatchedEpoch, 7)
  const peelFaction = next.factions.find(
    (f) => f.status === 'active' && f.settlementIds.includes('port') && f.id !== 'faction-founding-port',
  )
  assert.ok(peelFaction)
  assert.strictEqual(next.settlements.find((s) => s.id === 'port').factionId, peelFaction.id)
  assert.ok(!next.factions.find((f) => f.id === 'faction-founding-port')?.settlementIds.includes('port'))
})
