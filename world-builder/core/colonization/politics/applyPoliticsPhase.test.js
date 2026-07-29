import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { HISTORY_KIND_INCREMENT3_LATCHED } from './historyKinds.js'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'
import { resetConflictTuning, setConflictTuning } from './conflict/conflictTuning.js'

test.afterEach(() => {
  resetConflictTuning()
})

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

test('applyPoliticsPhase leaves membership empty before latch conditions hold', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 5
  slice.settlements = [
    { id: 'a', x: 5, y: 5, population: 100, status: 'living', tier: 'village' },
    { id: 'b', x: 6, y: 5, population: 100, status: 'living', tier: 'village' },
  ]
  const { slice: next, events } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
  })

  assert.strictEqual(next.increment3LatchedEpoch, null)
  assert.deepStrictEqual(next.factions, [])
  assert.ok(!events.some((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED))
})

test('applyPoliticsPhase latches once and records history', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 8
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 100, status: 'living', tier: 'village' },
    { id: 'b', x: 35, y: 35, population: 100, status: 'living', tier: 'village' },
  ]
  const doc = flatLandDoc(40, 40)
  const first = await applyPoliticsPhase({
    slice,
    worldDocument: doc,
    primaryClaim: {},
  })
  assert.strictEqual(first.slice.increment3LatchedEpoch, 8)
  assert.ok(first.slice.historyLog.some((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED))

  const second = await applyPoliticsPhase({
    slice: first.slice,
    worldDocument: doc,
    primaryClaim: {},
  })
  assert.strictEqual(second.slice.increment3LatchedEpoch, 8)
  assert.strictEqual(
    second.slice.historyLog.filter((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED).length,
    1,
  )
})

test('applyPoliticsPhase can escalate conquest before latch when unaligned stakes exist', async () => {
  setConflictTuning({
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.6,
    distantUnalignedHaulFraction: 0.75,
    warThreshold: 10,
  })
  const edges = [
    {
      id: 'a1-free',
      fromSettlementId: 'a1',
      toSettlementId: 'free',
      mode: 'road',
      haulDistanceFraction: 0.4,
      capacityLb: 1,
      transportCostCpPerLb: 1,
      directionalFrictionAtoB: 1,
      directionalFrictionBtoA: 1,
    },
  ]
  const slice = createDefaultColonizationSlice()
  slice.epoch = 6
  slice.increment3LatchedEpoch = null
  slice.colonistSettings.threeDayHaulDistance = 100
  slice.settlements = [
    {
      id: 'a1',
      x: 2,
      y: 2,
      factionId: 'fa',
      status: 'living',
      population: 800,
      tier: 'town',
    },
    {
      id: 'free',
      x: 3,
      y: 2,
      factionId: null,
      status: 'living',
      population: 60,
      tier: 'hamlet',
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'a1',
      settlementIds: ['a1'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.tradeRouteState = { candidates: edges, activeFlows: [] }
  slice.lastTradeEpochResult = {
    realmBalancesCp: { a1: 0, free: 0 },
    portTollIncomeCpBySettlementId: { free: 3_000 },
    factionTaxNetCpBySettlementId: {},
    effectiveDelivered: {},
  }

  const { slice: next, events } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    candidateEdges: edges,
    survivalBySettlementId: {
      a1: { foodSurplus: 10, ok: true },
      free: { foodSurplus: 8, ok: true },
    },
  })

  assert.strictEqual(next.increment3LatchedEpoch, null)
  assert.ok(events.some((e) => e.kind === 'major_war_start'))
  assert.equal(next.settlements.find((s) => s.id === 'free').factionId, 'fa')
})

test('applyPoliticsPhase emits politics substeps and matches output with or without yieldToUi', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 5
  slice.settlements = [
    { id: 'a', x: 5, y: 5, population: 100, status: 'living', tier: 'village' },
  ]
  const doc = flatLandDoc(20, 20)
  /** @type {string[]} */
  const substepIds = []
  let yieldCount = 0

  const withYield = await applyPoliticsPhase(
    { slice, worldDocument: doc, primaryClaim: {} },
    {
      yieldToUi: async () => {
        yieldCount += 1
      },
      hooks: {
        onPoliticsSubstep(payload) {
          if (payload.type === 'substep-start') {
            substepIds.push(payload.substepId)
          }
        },
      },
    },
  )
  const withoutYield = await applyPoliticsPhase({
    slice,
    worldDocument: doc,
    primaryClaim: {},
  })

  assert.deepStrictEqual(substepIds, [
    'latch',
    'membership',
    'conflict',
    'absorption',
    'palette',
  ])
  assert.ok(yieldCount >= substepIds.length)
  assert.deepStrictEqual(withYield.slice.factions, withoutYield.slice.factions)
  assert.strictEqual(withYield.slice.increment3LatchedEpoch, withoutYield.slice.increment3LatchedEpoch)
})

test('applyPoliticsPhase emits membership and absorption m/n item progress when latched', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 50
  slice.increment3LatchedEpoch = 10
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.settlements = [
    {
      id: 'a',
      x: 2,
      y: 2,
      population: 200,
      status: 'living',
      tier: 'town',
      factionId: 'fa',
    },
    {
      id: 'b',
      x: 4,
      y: 2,
      population: 200,
      status: 'living',
      tier: 'town',
      factionId: 'fb',
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'fb',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 12,
    },
  ]

  /** @type {Array<{ substepId: string, itemIndex: number, itemCount: number }>} */
  const membershipItems = []
  /** @type {Array<{ substepId: string, itemIndex: number, itemCount: number }>} */
  const absorptionItems = []

  await applyPoliticsPhase(
    {
      slice,
      worldDocument: flatLandDoc(20, 20),
      primaryClaim: {},
      survivalBySettlementId: {
        a: { ok: true, foodSurplus: 1 },
        b: { ok: true, foodSurplus: 1 },
      },
    },
    {
      yieldToUi: async () => {},
      hooks: {
        onPoliticsSubstep(payload) {
          if (payload.type !== 'substep-item') return
          if (payload.substepId === 'membership') {
            membershipItems.push({
              substepId: payload.substepId,
              itemIndex: payload.itemIndex ?? 0,
              itemCount: payload.itemCount ?? 0,
            })
          }
          if (payload.substepId === 'absorption') {
            absorptionItems.push({
              substepId: payload.substepId,
              itemIndex: payload.itemIndex ?? 0,
              itemCount: payload.itemCount ?? 0,
            })
          }
        },
      },
    },
  )

  assert.ok(membershipItems.length > 1, 'expected membership item progress')
  assert.equal(membershipItems[0].itemIndex, 1)
  assert.equal(membershipItems.at(-1)?.itemIndex, membershipItems[0].itemCount)
  assert.ok(
    membershipItems.every((item) => item.itemCount === membershipItems[0].itemCount),
  )

  assert.ok(absorptionItems.length > 1, 'expected absorption item progress')
  assert.equal(absorptionItems[0].itemIndex, 1)
  assert.equal(absorptionItems.at(-1)?.itemIndex, absorptionItems[0].itemCount)
  assert.ok(
    absorptionItems.every((item) => item.itemCount === absorptionItems[0].itemCount),
  )
})
