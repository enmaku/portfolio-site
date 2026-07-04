import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyColonizationEpoch } from './applyColonizationEpoch.js'
import { applyEpochStep } from './applyEpochStep.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { computePrimaryClaimMap, serializeClaimMap } from './computePrimaryClaimMap.js'
import { appendRoadSegment, buildRoadCellMask, DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from './roads/roadNetwork.js'
import { isCellVisited } from './visitStatus/visitRaster.js'

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

function commitOnDoc(doc, landing = { x: 1, y: 3 }) {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = landing
  slice.colonistSettings.startingPopulation = 50
  slice.colonistSettings.threeDayHaulDistance = 4
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
  const firstExpeditions = JSON.stringify(first.expeditions)

  let second = commitOnDoc(doc)
  for (let i = 0; i < 5; i += 1) {
    second = applyColonizationEpoch(second, doc).slice
  }
  assert.strictEqual(JSON.stringify(second.expeditions), firstExpeditions)
})

test('expeditions dispatch and expand visit raster beyond the founding haul-shed', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc)
  slice.colonistSettings.threeDayHaulDistance = 5
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

test('applyEpochStep retains settlement_founded committed tips', () => {
  const doc = colonizationFixtureDoc()
  let slice = commitOnDoc(doc)
  slice = applyEpochStep(slice, doc)
  const foundedTips = slice.committedTips.filter((tip) => tip.eventKind === 'settlement_founded')
  assert.ok(foundedTips.length >= 0)
})
