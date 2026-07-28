import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../../biomeIds.js'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'
import { isCellVisited } from '../visitStatus/visitRaster.js'
import { foundDaughterSettlement } from './foundDaughterSettlement.js'

const LAND_ELEVATION = SEA_LEVEL + 0.08

test('foundDaughterSettlement persists computed corridor instead of expedition march', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(LAND_ELEVATION)

  for (let x = 2; x <= 5; x += 1) {
    elevation[4 * width + x] = LAND_ELEVATION + 0.5
  }

  const worldDocument = {
    gridWidth: width,
    gridHeight: height,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    roads: [],
  }

  const slice = {
    ...createDefaultColonizationSlice(),
    settlements: [{ id: 'origin', x: 1, y: 4, status: 'living', tier: 'capital', mapNumber: 1 }],
    roads: [],
    logisticsNodeSurvey: [{ x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false }],
  }

  const expeditionRoute = [
    { x: 1, y: 4 },
    { x: 2, y: 4 },
    { x: 3, y: 4 },
    { x: 4, y: 4 },
    { x: 5, y: 4 },
    { x: 6, y: 4 },
  ]

  const result = foundDaughterSettlement({
    slice,
    worldDocument,
    candidate: {
      x: 6,
      y: 4,
      node: { x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false },
    },
    originSettlementId: 'origin',
    epoch: 1,
    expeditionRoute,
    progressIndex: 5,
    mode: 'land',
  })

  const segment = result.slice.roads?.[0]
  assert.ok(segment)
  assert.ok(segment.cells.length > 1)
  const crossesRidge = segment.cells.some((cell) => cell.y === 4 && cell.x >= 2 && cell.x <= 5)
  assert.ok(!crossesRidge, 'computed corridor should avoid steep ridge on marched row')
  const daughter = result.slice.settlements.find((settlement) => settlement.id !== 'origin')
  assert.equal(daughter?.mapNumber, 2)
})

test('foundDaughterSettlement clears exploration fog along route corridor', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(LAND_ELEVATION)

  for (let x = 2; x <= 5; x += 1) {
    elevation[4 * width + x] = LAND_ELEVATION + 0.5
  }

  const worldDocument = {
    gridWidth: width,
    gridHeight: height,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    roads: [],
  }

  const slice = {
    ...createDefaultColonizationSlice(),
    settlements: [{ id: 'origin', x: 1, y: 4, status: 'living', tier: 'capital', mapNumber: 1 }],
    roads: [],
    logisticsNodeSurvey: [{ x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false }],
  }

  const result = foundDaughterSettlement({
    slice,
    worldDocument,
    candidate: {
      x: 6,
      y: 4,
      node: { x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false },
    },
    originSettlementId: 'origin',
    epoch: 1,
    expeditionRoute: [{ x: 1, y: 4 }, { x: 6, y: 4 }],
    progressIndex: 1,
    mode: 'land',
  })

  const visited = result.slice.visitedCells
  assert.ok(visited)
  assert.ok(isCellVisited(visited, 3, 3, width), 'corridor neighbor should be visited')
})

test('foundDaughterSettlement joins origin faction as vassal when origin has a faction', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const worldDocument = {
    gridWidth: width,
    gridHeight: height,
    fields: { elevation: new Float32Array(cellCount).fill(LAND_ELEVATION) },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    roads: [],
  }
  const slice = {
    ...createDefaultColonizationSlice(),
    settlements: [
      {
        id: 'origin',
        x: 1,
        y: 4,
        status: 'living',
        tier: 'town',
        mapNumber: 1,
        factionId: 'faction-a',
      },
    ],
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 'origin',
        settlementIds: ['origin'],
        status: 'active',
        emergedEpoch: 1,
      },
    ],
    roads: [],
    logisticsNodeSurvey: [{ x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false }],
  }

  const result = foundDaughterSettlement({
    slice,
    worldDocument,
    candidate: {
      x: 6,
      y: 4,
      node: { x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false },
    },
    originSettlementId: 'origin',
    epoch: 2,
    expeditionRoute: [{ x: 1, y: 4 }, { x: 6, y: 4 }],
    progressIndex: 1,
    mode: 'land',
  })

  const daughter = result.slice.settlements.find((s) => s.id !== 'origin')
  assert.strictEqual(daughter.factionId, 'faction-a')
  assert.strictEqual(daughter.vassalLiegeSettlementId, 'origin')
  assert.ok(result.slice.factions[0].settlementIds.includes(daughter.id))
})

test('foundDaughterSettlement stays unaligned when origin has no faction', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const worldDocument = {
    gridWidth: width,
    gridHeight: height,
    fields: { elevation: new Float32Array(cellCount).fill(LAND_ELEVATION) },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    movementCost: new Float32Array(cellCount).fill(1),
    roads: [],
  }
  const slice = {
    ...createDefaultColonizationSlice(),
    settlements: [{ id: 'origin', x: 1, y: 4, status: 'living', tier: 'village', mapNumber: 1 }],
    roads: [],
    logisticsNodeSurvey: [{ x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false }],
  }

  const result = foundDaughterSettlement({
    slice,
    worldDocument,
    candidate: {
      x: 6,
      y: 4,
      node: { x: 6, y: 4, primaryType: 'inland', exhausted: false, founded: false },
    },
    originSettlementId: 'origin',
    epoch: 2,
    expeditionRoute: [{ x: 1, y: 4 }, { x: 6, y: 4 }],
    progressIndex: 1,
    mode: 'land',
  })

  const daughter = result.slice.settlements.find((s) => s.id !== 'origin')
  assert.strictEqual(daughter.factionId, null)
  assert.strictEqual(daughter.vassalLiegeSettlementId, null)
  assert.ok(!result.slice.factions.some((f) => f.settlementIds.includes(daughter.id)))
})
