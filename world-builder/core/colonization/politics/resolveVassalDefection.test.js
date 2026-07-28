import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { isVassalLocallyIndependent, resolveVassalDefection } from './resolveVassalDefection.js'
import { HISTORY_KIND_FACTION_EMERGED, HISTORY_KIND_VASSAL_DEFECTION } from './historyKinds.js'
import {
  MEMBERSHIP_REFRACTORY_EPOCHS,
  VASSAL_INDEPENDENCE_EPOCHS,
} from './politicsConstants.js'
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

/**
 * Road-linked capital + vassal in one founding faction (same logistics component).
 * @param {{
 *   latched?: boolean,
 *   vassalTier?: string,
 *   vassalPopulation?: number,
 *   independenceStreak?: number,
 *   epoch?: number,
 * }} [opts]
 */
function roadLinkedVassalSlice(opts = {}) {
  const slice = createDefaultColonizationSlice()
  slice.epoch = opts.epoch ?? 20
  slice.colonistSettings.threeDayHaulDistance = 3
  if (opts.latched !== false) {
    slice.increment3LatchedEpoch = 10
  }
  slice.factions = [
    {
      id: 'faction-founding-a',
      capitalSettlementId: 'a',
      settlementIds: ['a', 'v'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.settlements = [
    {
      id: 'a',
      x: 2,
      y: 2,
      population: 1200,
      status: 'living',
      tier: 'town',
      factionId: 'faction-founding-a',
    },
    {
      id: 'v',
      x: 5,
      y: 2,
      population: opts.vassalPopulation ?? 1200,
      status: 'living',
      tier: opts.vassalTier ?? 'town',
      factionId: 'faction-founding-a',
      vassalLiegeSettlementId: 'a',
    },
  ]
  slice.roads = [
    {
      cells: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
      ],
      mode: 'land',
      settlementIds: ['a', 'v'],
    },
  ]
  if (opts.independenceStreak != null) {
    slice.vassalIndependenceStreak = { v: opts.independenceStreak }
  }
  return slice
}

test('isVassalLocallyIndependent requires positive localFoodSurplus', () => {
  assert.equal(isVassalLocallyIndependent({ localFoodSurplus: 1 }), true)
  assert.equal(isVassalLocallyIndependent({ localFoodSurplus: 0 }), false)
  assert.equal(isVassalLocallyIndependent({ localFoodSurplus: -3 }), false)
  assert.equal(isVassalLocallyIndependent({ foodSurplus: 10 }), false)
  assert.equal(isVassalLocallyIndependent(null), false)
})

test('connectivity merge alone does not change sticky faction membership', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 20
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'faction-b',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 14,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-a' },
    { id: 'b', x: 20, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-b' },
  ]
  slice.roads = [
    {
      cells: Array.from({ length: 19 }, (_, i) => ({ x: 2 + i, y: 2 })),
      mode: 'land',
      settlementIds: ['a', 'b'],
    },
  ]

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
  })

  assert.strictEqual(next.settlements.find((s) => s.id === 'a').factionId, 'faction-a')
  assert.strictEqual(next.settlements.find((s) => s.id === 'b').factionId, 'faction-b')
  assert.strictEqual(next.factions.filter((f) => f.status === 'active').length, 2)
})

test('resolveVassalDefection joins adjacent faction when still corridor-dependent', () => {
  const decision = resolveVassalDefection({
    settlement: {
      id: 'v',
      population: 200,
      tier: 'village',
      factionId: 'faction-a',
      vassalLiegeSettlementId: 'a',
    },
    linkedToLiege: false,
    adjacentFactionId: 'faction-b',
    corridorDependentOnAdjacent: true,
  })
  assert.deepStrictEqual(decision, { action: 'join', targetFactionId: 'faction-b' })
})

test('resolveVassalDefection spawns when independent and town-tier ready', () => {
  const decision = resolveVassalDefection({
    settlement: {
      id: 'v',
      population: 1200,
      tier: 'town',
      factionId: 'faction-a',
      vassalLiegeSettlementId: 'a',
    },
    linkedToLiege: false,
    adjacentFactionId: null,
    corridorDependentOnAdjacent: false,
  })
  assert.deepStrictEqual(decision, { action: 'spawn' })
})

test('resolveVassalDefection soft-unaligns when independent but not faction-ready', () => {
  const decision = resolveVassalDefection({
    settlement: {
      id: 'v',
      population: 80,
      tier: 'hamlet',
      factionId: 'faction-a',
      vassalLiegeSettlementId: 'a',
    },
    linkedToLiege: false,
    adjacentFactionId: null,
    corridorDependentOnAdjacent: false,
  })
  assert.deepStrictEqual(decision, { action: 'soft_unaligned' })
})

test('vassal defection spawn writes history and sets refractory cooldown', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 30
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'a',
      settlementIds: ['a', 'v'],
      status: 'active',
      emergedEpoch: 12,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-a' },
    {
      id: 'v',
      x: 35,
      y: 35,
      population: 1200,
      status: 'living',
      tier: 'town',
      factionId: 'faction-a',
      vassalLiegeSettlementId: 'a',
    },
  ]

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
  })

  const vassal = next.settlements.find((s) => s.id === 'v')
  assert.ok(vassal.factionId)
  assert.notStrictEqual(vassal.factionId, 'faction-a')
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_VASSAL_DEFECTION))
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_FACTION_EMERGED))
  assert.ok(
    next.membershipCooldown.some(
      (c) => c.subjectId === 'v' && c.untilEpoch >= 30 + MEMBERSHIP_REFRACTORY_EPOCHS,
    ),
  )
})

test('road-linked vassal with sustained local independence spawns a faction', () => {
  const slice = roadLinkedVassalSlice({
    independenceStreak: VASSAL_INDEPENDENCE_EPOCHS - 1,
  })
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    survivalBySettlementId: {
      a: { localFoodSurplus: 10, foodSurplus: 10 },
      v: { localFoodSurplus: 5, foodSurplus: 5 },
    },
  })

  const vassal = next.settlements.find((s) => s.id === 'v')
  assert.ok(vassal.factionId)
  assert.notStrictEqual(vassal.factionId, 'faction-founding-a')
  assert.strictEqual(vassal.vassalLiegeSettlementId, null)
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_VASSAL_DEFECTION))
  assert.ok(next.factions.some((f) => f.id === vassal.factionId && f.status === 'active'))
})

test('road-linked vassal below independence streak stays loyal', () => {
  const slice = roadLinkedVassalSlice({
    independenceStreak: VASSAL_INDEPENDENCE_EPOCHS - 2,
  })
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    survivalBySettlementId: {
      v: { localFoodSurplus: 5, foodSurplus: 5 },
    },
  })

  const vassal = next.settlements.find((s) => s.id === 'v')
  assert.strictEqual(vassal.factionId, 'faction-founding-a')
  assert.strictEqual(vassal.vassalLiegeSettlementId, 'a')
  assert.strictEqual(next.vassalIndependenceStreak.v, VASSAL_INDEPENDENCE_EPOCHS - 1)
})

test('import-dependent road-linked vassal stays loyal', () => {
  const slice = roadLinkedVassalSlice({
    independenceStreak: VASSAL_INDEPENDENCE_EPOCHS,
  })
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    survivalBySettlementId: {
      v: { localFoodSurplus: -20, foodSurplus: 0 },
    },
  })

  const vassal = next.settlements.find((s) => s.id === 'v')
  assert.strictEqual(vassal.factionId, 'faction-founding-a')
  assert.strictEqual(next.vassalIndependenceStreak.v ?? 0, 0)
})

test('road-linked independent hamlet soft-unaligns', () => {
  const slice = roadLinkedVassalSlice({
    vassalTier: 'hamlet',
    vassalPopulation: 80,
    independenceStreak: VASSAL_INDEPENDENCE_EPOCHS - 1,
  })
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    survivalBySettlementId: {
      v: { localFoodSurplus: 2, foodSurplus: 2 },
    },
  })

  const vassal = next.settlements.find((s) => s.id === 'v')
  assert.strictEqual(vassal.factionId, null)
  assert.strictEqual(vassal.vassalLiegeSettlementId, null)
})

test('pre-latch founding faction allows independent vassal spawn', () => {
  const slice = roadLinkedVassalSlice({
    latched: false,
    independenceStreak: VASSAL_INDEPENDENCE_EPOCHS - 1,
  })
  assert.strictEqual(slice.increment3LatchedEpoch, null)

  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    survivalBySettlementId: {
      v: { localFoodSurplus: 8, foodSurplus: 8 },
    },
  })

  // Road keeps land latch false; spawn still fires from founding faction politics.
  assert.strictEqual(next.increment3LatchedEpoch, null)
  const vassal = next.settlements.find((s) => s.id === 'v')
  assert.ok(vassal.factionId)
  assert.notStrictEqual(vassal.factionId, 'faction-founding-a')
})

test('anti-churn blocks inverse membership flip during refractory', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 40
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.membershipCooldown = [
    { subjectId: 'v', untilEpoch: 40 + MEMBERSHIP_REFRACTORY_EPOCHS, kind: 'vassal_defection' },
  ]
  slice.factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'faction-v',
      capitalSettlementId: 'v',
      settlementIds: ['v'],
      status: 'active',
      emergedEpoch: 30,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-a' },
    {
      id: 'v',
      x: 35,
      y: 35,
      population: 1200,
      status: 'living',
      tier: 'town',
      factionId: 'faction-v',
    },
  ]

  const before = slice.settlements.find((s) => s.id === 'v').factionId
  const { slice: next } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
  })
  assert.strictEqual(next.settlements.find((s) => s.id === 'v').factionId, before)
})
