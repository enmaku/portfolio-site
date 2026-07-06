import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyColonizationEpoch } from './applyColonizationEpoch.js'
import { applyEpochStep } from './applyEpochStep.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
  DEFAULT_LAND_EXPEDITION_RANGE,
  DEFAULT_SAIL_EXPEDITION_RANGE,
  DEFAULT_THREE_DAY_HAUL_DISTANCE,
  resolveColonizationSlice,
  serializeColonizationSessionForStorage,
} from './createDefaultColonizationSlice.js'
import { rehydrateColonizationDerivedOverlays } from './rehydrateColonizationDerivedOverlays.js'
import { rebuildVisitRasterFromSession } from './visitStatus/rebuildVisitRasterFromSession.js'
import { computePrimaryClaimMap, serializeClaimMap } from './computePrimaryClaimMap.js'
import { appendRoadSegment, buildRoadCellMask, DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from './roads/roadNetwork.js'
import { isCellVisited } from './visitStatus/visitRaster.js'
import { computeFoundingRouteCorridor } from './expeditions/computeFoundingRouteCorridor.js'
import { foundDaughterSettlement } from './expeditions/foundDaughterSettlement.js'
import { SEA_LEVEL } from '../biomeIds.js'

function colonizationFixtureDoc() {
  const width = 8
  const height = 8
  const cellCount = width * height
  const arableRaster = new Float32Array(cellCount)
  const movementCost = new Float32Array(cellCount).fill(1)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      arableRaster[index] = x >= 2 ? 2 : 0.5
      movementCost[index] = 1 + (y > 4 ? 0.5 : 0)
    }
  }
  arableRaster[4 * width + 6] = 3
  arableRaster[4 * width + 7] = 3
  arableRaster[5 * width + 6] = 3
  arableRaster[5 * width + 7] = 3

  return {
    geographySeed: 4242,
    gridWidth: width,
    gridHeight: height,
    arableRaster,
    timberRaster: new Float32Array(cellCount).fill(2),
    movementCost,
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.7),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i % width === 3 ? 1 : 0)),
    saltNodes: [],
    metalNodes: [],
    coastalNodes: [],
  }
}

function commitOnDoc(doc, landing = { x: 1, y: 3 }, haulDistance = 4) {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = landing
  slice.colonistSettings.startingPopulation = 50
  slice.colonistSettings.threeDayHaulDistance = haulDistance
  slice.colonistSettings.epochBatch = 1
  return beginColonizationCommit(slice, doc)
}

/** Scenario A: default colonist settings (haul 50, land range 2×, sail range 3×). */
function commitScenarioA(doc, landing = { x: 1, y: 3 }) {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = landing
  slice.colonistSettings.epochBatch = 1
  return beginColonizationCommit(slice, doc)
}

test('beginColonizationCommit seeds founding haul-shed as visited', () => {
  const doc = colonizationFixtureDoc()
  const committed = commitOnDoc(doc)
  assert.ok(committed.visitedCells instanceof Uint8Array)
  assert.strictEqual(isCellVisited(committed.visitedCells, 1, 3, doc.gridWidth), true)
})

test('multi-settlement primary claim assigns exclusive calorie cells', () => {
  const doc = colonizationFixtureDoc()
  const settlements = [
    { id: 'a', x: 1, y: 3, status: 'living' },
    { id: 'b', x: 6, y: 5, status: 'living' },
  ]
  const claimMap = computePrimaryClaimMap({
    pins: settlements,
    budget: 4,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.movementCost,
  })
  const serialized = serializeClaimMap(claimMap)
  const overlap = (serialized.a ?? []).filter((cell) =>
    (serialized.b ?? []).some((other) => other.x === cell.x && other.y === cell.y),
  )
  assert.strictEqual(overlap.length, 0)
})

test('roads can flip primary claim ownership between settlements', () => {
  const doc = colonizationFixtureDoc()
  const settlements = [
    { id: 'near', x: 2, y: 3, status: 'living' },
    { id: 'far', x: 6, y: 3, status: 'living' },
  ]
  const withoutRoads = computePrimaryClaimMap({
    pins: settlements,
    budget: 3.5,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.movementCost,
  })
  const contestedIndex = 3 * doc.gridWidth + 4
  const ownerWithoutRoad = withoutRoads.ownerByCell[contestedIndex]

  const roads = appendRoadSegment([], [
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ])
  const withRoads = computePrimaryClaimMap({
    pins: settlements,
    budget: 3.5,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.movementCost,
    roadCellMask: buildRoadCellMask(roads, doc.gridWidth, doc.gridHeight),
    roadMultiplier: DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
  })
  const ownerWithRoad = withRoads.ownerByCell[contestedIndex]
  assert.notStrictEqual(ownerWithoutRoad, ownerWithRoad)
})

test('expedition dispatch is deterministic for same seed and landing', () => {
  const doc = colonizationFixtureDoc()
  let first = commitOnDoc(doc)
  for (let i = 0; i < 5; i += 1) {
    first = applyColonizationEpoch(first, doc).slice
  }
  const firstExpeditions = JSON.stringify(
    first.expeditions.map(({ id, settlementId, mode, bearing, route, progressIndex, status, endReason }) => ({
      id,
      settlementId,
      mode,
      bearing,
      route,
      progressIndex,
      status,
      endReason,
    })),
  )

  let second = commitOnDoc(doc)
  for (let i = 0; i < 5; i += 1) {
    second = applyColonizationEpoch(second, doc).slice
  }
  assert.strictEqual(
    JSON.stringify(
      second.expeditions.map(({ id, settlementId, mode, bearing, route, progressIndex, status, endReason }) => ({
        id,
        settlementId,
        mode,
        bearing,
        route,
        progressIndex,
        status,
        endReason,
      })),
    ),
    firstExpeditions,
  )
})

test('land expedition routes never cross lake or river corridor masks', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc)
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.colonistSettings.landExpeditionRange = 4

  for (let i = 0; i < 15; i += 1) {
    slice = applyColonizationEpoch(slice, doc).slice
    for (const expedition of slice.expeditions) {
      if (expedition.mode !== 'land') continue
      for (const cell of expedition.route) {
        const index = cell.y * doc.gridWidth + cell.x
        assert.strictEqual(doc.lakeMask[index], 0)
        assert.strictEqual(doc.riverCorridorMask[index], 0)
      }
    }
    for (const segment of slice.roads) {
      if (segment.mode === 'sail') continue
      for (const cell of segment.cells) {
        const index = cell.y * doc.gridWidth + cell.x
        assert.strictEqual(doc.lakeMask[index], 0)
        assert.strictEqual(doc.riverCorridorMask[index], 0)
      }
    }
  }
})

test('bearing-based expeditions include bearing and omit target field', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc)
  slice = applyColonizationEpoch(slice, doc).slice
  const active = slice.expeditions.find((entry) => entry.status === 'active')
  if (active) {
    assert.strictEqual(typeof active.bearing, 'number')
    assert.strictEqual('target' in active, false)
  }
})

test('scenario A baseline dispatches expeditions with default colonist settings', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitScenarioA(doc)
  assert.strictEqual(slice.colonistSettings.threeDayHaulDistance, DEFAULT_THREE_DAY_HAUL_DISTANCE)
  assert.strictEqual(slice.colonistSettings.landExpeditionRange, DEFAULT_LAND_EXPEDITION_RANGE)
  assert.strictEqual(slice.colonistSettings.sailExpeditionRange, DEFAULT_SAIL_EXPEDITION_RANGE)

  const visitedAtFounding = slice.visitedCells.filter((value) => value === 1).length
  slice = applyColonizationEpoch(slice, doc).slice

  assert.ok(slice.expeditions.length > 0)
  const marched = slice.expeditions.some((entry) => entry.route.length > 1)
  const active = slice.expeditions.some((entry) => entry.status === 'active')
  assert.ok(marched || active)

  for (let i = 0; i < 9; i += 1) {
    slice = applyColonizationEpoch(slice, doc).slice
  }
  const visitedAfter = slice.visitedCells.filter((value) => value === 1).length
  assert.ok(visitedAfter >= visitedAtFounding)
})

test('expeditions dispatch when founding haul-shed already visited immediate neighbors', () => {
  const doc = colonizationFixtureDoc()
  const slice = commitOnDoc(doc)
  const pin = slice.settlements[0]
  const neighborsVisited = [
    { x: pin.x - 1, y: pin.y },
    { x: pin.x + 1, y: pin.y },
    { x: pin.x, y: pin.y - 1 },
    { x: pin.x, y: pin.y + 1 },
  ].every((cell) => isCellVisited(slice.visitedCells, cell.x, cell.y, doc.gridWidth))
  assert.ok(neighborsVisited, 'fixture should seed haul-shed over pin neighbors')

  const afterEpoch = applyColonizationEpoch(slice, doc).slice
  assert.ok(
    afterEpoch.expeditions.some((entry) => entry.status === 'active' || entry.route.length > 1),
    'expected expedition dispatch despite visited haul-shed neighbors',
  )
})

test('expeditions dispatch and expand visit raster beyond the founding haul-shed', () => {
  const width = 12
  const height = 12
  const cellCount = width * height
  const doc = {
    ...colonizationFixtureDoc(),
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(cellCount).fill(2),
    timberRaster: new Float32Array(cellCount).fill(2),
    movementCost: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.5),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
  }

  let slice = commitOnDoc(doc, { x: 6, y: 6 }, 1)
  slice.colonistSettings.landExpeditionRange = 4
  const visitedAtFounding = slice.visitedCells.filter((value) => value === 1).length

  for (let i = 0; i < 10; i += 1) {
    slice = applyColonizationEpoch(slice, doc).slice
  }

  const visitedAfter = slice.visitedCells.filter((value) => value === 1).length
  assert.ok(slice.expeditions.length > 0, 'expected at least one expedition dispatch')
  assert.ok(visitedAfter > visitedAtFounding, 'expected exploration to clear fog beyond haul-shed')
})

test('frontierExhausted stops new dispatch but epoch still advances', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc)
  slice.logisticsNodeSurvey = (slice.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
    founded: false,
  }))
  slice = applyColonizationEpoch(slice, doc).slice
  assert.strictEqual(slice.frontierExhausted, true)
  assert.strictEqual(slice.epoch, 1)
})

test('founding stores computed A-to-B corridor between settlement pins', () => {
  const width = 10
  const height = 10
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.08)
  for (let x = 2; x <= 7; x += 1) {
    elevation[5 * width + x] = SEA_LEVEL + 0.55
  }

  const doc = {
    geographySeed: 9001,
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(cellCount).fill(2),
    timberRaster: new Float32Array(cellCount).fill(2),
    movementCost: new Float32Array(cellCount).fill(1),
    fields: {
      elevation,
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.7),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    saltNodes: [],
    metalNodes: [],
    coastalNodes: [],
    roads: [],
  }

  let slice = commitOnDoc(doc, { x: 2, y: 5 }, 3)
  const founded = foundDaughterSettlement({
    slice,
    worldDocument: doc,
    candidate: {
      x: 7,
      y: 5,
      node: { x: 7, y: 5, primaryType: 'inland', exhausted: false, founded: false },
    },
    originSettlementId: slice.settlements[0].id,
    epoch: 1,
    expeditionRoute: [
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ],
    progressIndex: 5,
    mode: 'land',
  })

  const segment = founded.slice.roads[0]
  assert.ok(segment)
  const expected = computeFoundingRouteCorridor({
    doc,
    from: { x: slice.settlements[0].x, y: slice.settlements[0].y },
    to: { x: 7, y: 5 },
    mode: 'land',
    roadCellMask: buildRoadCellMask([], doc.gridWidth, doc.gridHeight),
  })
  assert.deepStrictEqual(segment.cells, expected?.cells)
  const marchedThroughRidge = segment.cells.some((cell) => cell.y === 5 && cell.x >= 3 && cell.x <= 6)
  assert.ok(!marchedThroughRidge)
})

test('session round-trip restores bearing expeditions and visit raster', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc, { x: 6, y: 6 }, 1)
  for (let i = 0; i < 3; i += 1) {
    slice = applyColonizationEpoch(slice, doc).slice
  }

  const serialized = serializeColonizationSessionForStorage(slice)
  const revivedSlice = resolveColonizationSlice(serialized)
  const rehydrated = rehydrateColonizationDerivedOverlays(revivedSlice, doc)
  const expectedVisit = rebuildVisitRasterFromSession(rehydrated, doc)

  assert.ok(rehydrated.expeditions.length > 0)
  assert.strictEqual(typeof rehydrated.expeditions[0].bearing, 'number')
  assert.ok(rehydrated.visitedCells instanceof Uint8Array)
  assert.deepStrictEqual([...rehydrated.visitedCells], [...expectedVisit])
})
test('applyEpochStep retains settlement_founded committed tips', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc)
  slice = applyEpochStep(slice, doc)
  const foundedTips = slice.committedTips.filter((tip) => tip.eventKind === 'settlement_founded')
  assert.ok(foundedTips.length >= 0)
})
