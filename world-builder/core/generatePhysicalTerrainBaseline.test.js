import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES_COUNT } from './biomeIds.js'
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { DEFAULT_GRID_SIZE, PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE } from './types.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
}

test('generatePhysicalTerrainBaseline defaults to 1024 grid', () => {
  const doc = generatePhysicalTerrainBaseline({
    geographySeed: 42,
    prevailingWindDegrees: 180,
  })
  assert.strictEqual(doc.gridWidth, DEFAULT_GRID_SIZE)
  assert.strictEqual(doc.gridHeight, DEFAULT_GRID_SIZE)
  assert.strictEqual(DEFAULT_GRID_SIZE, 1024)
})
test('generatePhysicalTerrainBaseline returns world document with expected shape', () => {
  const doc = generatePhysicalTerrainBaseline(params)
  const cellCount = params.width * params.height

  assert.strictEqual(doc.gridWidth, 256)
  assert.strictEqual(doc.gridHeight, 256)
  assert.strictEqual(doc.geographySeed, 12345)
  assert.strictEqual(doc.prevailingWindDegrees, 90)
  assert.strictEqual(doc.pipelineStage, PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE)
  assert.strictEqual(doc.biomeCatalog.length, BIOMES_COUNT)
  assert.strictEqual(doc.fields.elevation.length, cellCount)
  assert.strictEqual(doc.fields.temperature.length, cellCount)
  assert.strictEqual(doc.fields.rainfall.length, cellCount)
  assert.strictEqual(doc.fields.drainage.length, cellCount)
  assert.strictEqual(doc.fields.salidity.length, cellCount)
  assert.strictEqual(doc.biomes.length, cellCount)
  assert.ok(typeof doc.generatedAt === 'string')
})

test('generatePhysicalTerrainBaseline is deterministic for same seed and wind', () => {
  const first = generatePhysicalTerrainBaseline(params)
  const second = generatePhysicalTerrainBaseline(params)

  assert.deepStrictEqual(first.biomes, second.biomes)
  assert.deepStrictEqual(first.fields.elevation, second.fields.elevation)
  assert.deepStrictEqual(first.fields.rainfall, second.fields.rainfall)
})

test('generatePhysicalTerrainBaseline differs for different seeds', () => {
  const first = generatePhysicalTerrainBaseline(params)
  const second = generatePhysicalTerrainBaseline({ ...params, geographySeed: 99999 })

  let same = true
  for (let i = 0; i < first.biomes.length; i += 1) {
    if (first.biomes[i] !== second.biomes[i]) {
      same = false
      break
    }
  }
  assert.strictEqual(same, false)
})

test('closed island rim cells are ocean biome', () => {
  const doc = generatePhysicalTerrainBaseline(params)
  const { gridWidth: w, gridHeight: h, biomes } = doc

  assert.strictEqual(biomes[0], 0)
  assert.strictEqual(biomes[w - 1], 0)
  assert.strictEqual(biomes[(h - 1) * w], 0)
  assert.strictEqual(biomes[h * w - 1], 0)
})
