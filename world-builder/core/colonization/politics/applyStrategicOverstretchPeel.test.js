import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'
import { applyStrategicOverstretchPeel } from './applyStrategicOverstretchPeel.js'
import { OVERSTRETCH_STREAK_EPOCHS } from './politicsConstants.js'

function chainWorld(n) {
  const width = Math.max(20, n * 3)
  const height = 10
  const cellCount = width * height
  const settlements = []
  const roads = []
  for (let i = 0; i < n; i += 1) {
    const id = `s${i}`
    settlements.push({
      id,
      x: 2 + i * 2,
      y: 5,
      population: i === 0 ? 2000 : 1200,
      status: 'living',
      tier: i === 0 ? 'capital' : 'town',
      factionId: 'faction-a',
      vassalLiegeSettlementId: i === 0 ? null : 's0',
    })
    if (i > 0) {
      roads.push({
        mode: 'land',
        settlementIds: [`s${i - 1}`, id],
        cells: [
          { x: 2 + (i - 1) * 2, y: 5 },
          { x: 2 + i * 2, y: 5 },
        ],
      })
    }
  }
  return {
    worldDocument: {
      gridWidth: width,
      gridHeight: height,
      fields: { elevation: new Float32Array(cellCount).fill(0.4) },
      lakeMask: new Uint8Array(cellCount),
      riverCorridorMask: new Uint8Array(cellCount),
      sailMask: new Uint8Array(cellCount),
    },
    settlements,
    roads,
  }
}

test('strategic overstretch peels hinterland after sustained span breach', () => {
  const { worldDocument, settlements, roads } = chainWorld(14)
  let slice = {
    ...createDefaultColonizationSlice(),
    epoch: 10,
    colonistSettings: {
      ...createDefaultColonizationSlice().colonistSettings,
      threeDayHaulDistance: 3,
      strategicOverstretchSpan: 12,
    },
    settlements,
    roads,
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 's0',
        settlementIds: settlements.map((s) => s.id),
        status: 'active',
        emergedEpoch: 0,
      },
    ],
  }

  for (let i = 0; i < OVERSTRETCH_STREAK_EPOCHS - 1; i += 1) {
    slice = { ...slice, epoch: slice.epoch + 1 }
    const mid = applyStrategicOverstretchPeel({ slice, worldDocument })
    slice = mid.slice
    assert.equal(
      mid.events.filter((e) => e.cause === 'strategic_overstretch_peel').length,
      0,
    )
  }

  slice = { ...slice, epoch: slice.epoch + 1 }
  const peeled = applyStrategicOverstretchPeel({ slice, worldDocument })
  const emerge = peeled.events.find((e) => e.cause === 'strategic_overstretch_peel')
  assert.ok(emerge)
  assert.ok(peeled.slice.factions.some((f) => f.id === emerge.factionId && f.status === 'active'))
  const parent = peeled.slice.factions.find((f) => f.id === 'faction-a')
  const child = peeled.slice.factions.find((f) => f.id === emerge.factionId)
  assert.ok(parent.settlementIds.length >= 1)
  assert.ok(child.settlementIds.length >= 2)
  assert.ok(!parent.settlementIds.includes(child.capitalSettlementId))
  const seed = peeled.slice.settlements.find((s) => s.id === child.capitalSettlementId)
  assert.strictEqual(seed.vassalLiegeSettlementId, null)
  assert.strictEqual(seed.factionId, child.id)
  assert.ok(
    peeled.slice.rivalryEdges.some(
      (e) =>
        (e.aFactionId === 'faction-a' && e.bFactionId === child.id) ||
        (e.bFactionId === 'faction-a' && e.aFactionId === child.id),
    ),
  )
})

test('strategic overstretch streak clears when membership drops under span', () => {
  const { worldDocument, settlements, roads } = chainWorld(14)
  let slice = {
    ...createDefaultColonizationSlice(),
    epoch: 1,
    colonistSettings: {
      ...createDefaultColonizationSlice().colonistSettings,
      threeDayHaulDistance: 3,
      strategicOverstretchSpan: 12,
    },
    settlements,
    roads,
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 's0',
        settlementIds: settlements.map((s) => s.id),
        status: 'active',
        emergedEpoch: 0,
      },
    ],
  }
  slice = applyStrategicOverstretchPeel({ slice, worldDocument }).slice
  assert.equal(slice.factionOverstretchStreak['faction-a'], 1)

  // Shrink under span
  slice = {
    ...slice,
    settlements: slice.settlements.map((s, i) =>
      i < 5 ? s : { ...s, factionId: null, population: 0, status: 'ruin' },
    ),
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 's0',
        settlementIds: settlements.slice(0, 5).map((s) => s.id),
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    epoch: slice.epoch + 1,
  }
  slice = applyStrategicOverstretchPeel({ slice, worldDocument }).slice
  assert.equal(slice.factionOverstretchStreak['faction-a'], undefined)
})

test('strategic overstretch skips peels that would mint a singleton faction', () => {
  const { worldDocument, settlements, roads } = chainWorld(13)
  // Only capital is town-tier; others villages — no town seed beyond capital
  const villageSettlements = settlements.map((s, i) =>
    i === 0 ? s : { ...s, tier: 'village', population: 400 },
  )
  let slice = {
    ...createDefaultColonizationSlice(),
    epoch: 5,
    colonistSettings: {
      ...createDefaultColonizationSlice().colonistSettings,
      threeDayHaulDistance: 3,
      strategicOverstretchSpan: 6,
    },
    settlements: villageSettlements,
    roads,
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 's0',
        settlementIds: villageSettlements.map((s) => s.id),
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    factionOverstretchStreak: { 'faction-a': OVERSTRETCH_STREAK_EPOCHS },
  }
  const result = applyStrategicOverstretchPeel({ slice, worldDocument })
  assert.equal(result.events.length, 0)
  assert.equal(result.slice.factions.length, 1)
})
