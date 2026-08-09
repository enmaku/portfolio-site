import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { HISTORY_KIND_FACTION_EMERGED, HISTORY_KIND_FACTION_ABSORPTION } from './historyKinds.js'
import { UNALIGNED_CRYSTALLIZE_EPOCHS } from './politicsConstants.js'
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

test('lone unaligned crystallizes after sustained viability stretch', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 40
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.unalignedViabilityStreak = { u: UNALIGNED_CRYSTALLIZE_EPOCHS }
  slice.settlements = [
    {
      id: 'u',
      x: 2,
      y: 2,
      population: 1200,
      status: 'living',
      tier: 'town',
      factionId: null,
    },
  ]

  const { slice: next } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(10, 10),
    primaryClaim: {},
  })

  assert.ok(next.settlements[0].factionId)
  assert.ok(next.historyLog.some((e) => e.kind === HISTORY_KIND_FACTION_EMERGED))
})

test('lone unaligned re-absorbs as vassal when dependence asserts first', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 40
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
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'faction-a' },
    {
      id: 'u',
      x: 4,
      y: 2,
      population: 200,
      status: 'living',
      tier: 'village',
      factionId: null,
    },
  ]

  const { slice: next } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
    survivalBySettlementId: {
      u: { foodSurplus: -10, ok: false, dependsOnFactionId: 'faction-a' },
    },
  })

  const unaligned = next.settlements.find((s) => s.id === 'u')
  assert.strictEqual(unaligned.factionId, 'faction-a')
  assert.strictEqual(unaligned.vassalLiegeSettlementId, 'a')
  assert.ok(
    next.historyLog.some(
      (e) => e.kind === HISTORY_KIND_FACTION_ABSORPTION && e.cause === 'unaligned_reabsorb',
    ),
  )
})

test('capital succession passes to next highest-tier living member', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 40
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.factions = [
    {
      id: 'faction-a',
      capitalSettlementId: 'dead',
      settlementIds: ['dead', 'heir'],
      status: 'active',
      emergedEpoch: 12,
    },
  ]
  slice.settlements = [
    {
      id: 'dead',
      x: 2,
      y: 2,
      population: 0,
      status: 'ruin',
      tier: null,
      factionId: 'faction-a',
    },
    {
      id: 'heir',
      x: 4,
      y: 2,
      population: 1200,
      status: 'living',
      tier: 'town',
      factionId: 'faction-a',
      vassalLiegeSettlementId: 'dead',
    },
  ]

  const { slice: next } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
  })

  const faction = next.factions.find((f) => f.id === 'faction-a')
  assert.strictEqual(faction.capitalSettlementId, 'heir')
  assert.strictEqual(next.settlements.find((s) => s.id === 'heir').vassalLiegeSettlementId, null)
})
