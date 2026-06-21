import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES_COUNT } from './biomeIds.js'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { DEFAULT_GRID_SIZE, PIPELINE_STAGE_DERIVED_GEOGRAPHY } from './types.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
}

test('generateDerivedGeography defaults to 1024 grid', () => {
  const doc = generateDerivedGeography({
    geographySeed: 42,
    prevailingWindDegrees: 180,
  })
  assert.strictEqual(doc.gridWidth, DEFAULT_GRID_SIZE)
  assert.strictEqual(doc.gridHeight, DEFAULT_GRID_SIZE)
})

test('generateDerivedGeography returns extended world document shape', () => {
  const doc = generateDerivedGeography(params)
  const cellCount = params.width * params.height

  assert.strictEqual(doc.gridWidth, 256)
  assert.strictEqual(doc.gridHeight, 256)
  assert.strictEqual(doc.geographySeed, 12345)
  assert.strictEqual(doc.prevailingWindDegrees, 90)
  assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_DERIVED_GEOGRAPHY)
  assert.strictEqual(doc.biomeCatalog.length, BIOMES_COUNT)
  assert.strictEqual(doc.fields.elevation.length, cellCount)
  assert.strictEqual(doc.fields.drainage.length, cellCount)
  assert.strictEqual(doc.biomes.length, cellCount)
  assert.ok(doc.riverGraph)
  assert.ok(Array.isArray(doc.riverGraph.nodes))
  assert.ok(Array.isArray(doc.riverGraph.edges))
  assert.ok(doc.lakeMask)
  assert.strictEqual(doc.lakeMask.length, cellCount)
  assert.ok(doc.coastNavigability)
  assert.ok(Array.isArray(doc.coastalNodes))
  assert.ok(Array.isArray(doc.saltNodes))
  assert.ok(doc.generationReport)
  assert.strictEqual(typeof doc.generationReport.erosionStepCount, 'number')
  assert.ok(Array.isArray(doc.generationReport.validationRows))
  assert.ok(Array.isArray(doc.erosionSnapshots))
  assert.ok(doc.erosionSnapshots.length > 0)
})

test('generateDerivedGeography is deterministic for same seed and wind', () => {
  const first = generateDerivedGeography(params)
  const second = generateDerivedGeography(params)

  assert.deepStrictEqual(first.biomes, second.biomes)
  assert.deepStrictEqual(first.fields.elevation, second.fields.elevation)
  assert.deepStrictEqual(first.fields.drainage, second.fields.drainage)
  assert.strictEqual(first.generationReport.navigableRiverEdgeCount,
    second.generationReport.navigableRiverEdgeCount)
})

test('generateDerivedGeography differs for different seeds', () => {
  const first = generateDerivedGeography(params)
  const second = generateDerivedGeography({ ...params, geographySeed: 99999 })

  let same = true
  for (let i = 0; i < first.biomes.length; i += 1) {
    if (first.biomes[i] !== second.biomes[i]) {
      same = false
      break
    }
  }
  assert.strictEqual(same, false)
})

test('generateDerivedGeography uses flow-derived drainage not noise', () => {
  const small = { ...params, width: 64, height: 64 }
  const doc = generateDerivedGeography(small)
  const baseline = generatePhysicalTerrainBaseline(small)

  let differs = false
  for (let i = 0; i < doc.fields.drainage.length; i += 1) {
    if (doc.fields.drainage[i] !== baseline.fields.drainage[i]) {
      differs = true
      break
    }
  }
  assert.strictEqual(differs, true)
})
